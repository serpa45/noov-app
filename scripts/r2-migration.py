"""Copy verified images and migrate only their exact database URLs. Default: dry plan.

No secrets or image files belong in Git. Use an external --work-dir containing
backup-manifest.json (produced by the inventory backup) and --references CSV.
"""
from pathlib import Path
import argparse, csv, hashlib, json, os, shutil, subprocess, sys, urllib.parse, urllib.request, urllib.error

ACCOUNT = '88c3de75d07ceeb5bffad0346b0d232d'
BUCKET = 'noov-images'
SOURCE_HOSTS = {'mwnjoglolbyeyrmkqqqc.supabase.co', 'oiyuyqkpkcezezusxdmu.supabase.co'}
ALLOWED_TARGETS = {'noov.app.br','www.noov.app.br','noov-app.noov-serpainfo.workers.dev','noov-app-r2-preview.noov-serpainfo.workers.dev'}
IMAGE_BUCKETS = {'product-images','category-images','banners','logos','avatars','client-photos','public_assets'}
ALLOWED_FIELDS = {
    'clientes': {'foto_url'}, 'produtos': {'imagem_url','banner_url','adicionais','tamanhos','sabores'},
    'pedidos': {'items'}, 'pdv_pedidos': {'items'}, 'profiles': {'avatar_url'},
    'lojas': {'logo_url','banner_url','cupom_popup_imagem_url','popup_informativo_imagem_url','printer_steps','categorias_estilo'},
    'loja_categoria_imagens': {'imagem_url'}, 'materiais_afiliado': {'imagem_url'},
    'system_rating_settings': {'event_image_url'}, 'admin_mensagens': {'banner_url'},
}

def atomic_json(path, value):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+'.tmp'); tmp.write_text(json.dumps(value,indent=2,ensure_ascii=False),encoding='utf-8');os.replace(tmp,path)

def target_origin(value):
    parsed=urllib.parse.urlsplit(value)
    if parsed.scheme!='https' or parsed.netloc not in ALLOWED_TARGETS or parsed.path not in ['', '/'] or parsed.query or parsed.fragment:
        raise ValueError('Destination must be an approved Noov HTTPS origin without a path')
    return value.rstrip('/')

def object_key(row):
    bucket,path=row['bucket'],row['path']
    if bucket not in IMAGE_BUCKETS or not path or len(path)>1024 or any(p in ['', '.', '..'] for p in path.split('/')) or any(c in path for c in '\\%?#\x00'):
        raise ValueError('Invalid image namespace or path')
    return bucket+'/'+path

def read_verified_manifest(work_dir):
    root=Path(work_dir).resolve(); rows=json.loads((root/'backup-manifest.json').read_text(encoding='utf-8'))
    result=[]
    for row in rows:
        if row.get('status')!='verified':continue
        object_key(row)
        file=Path(row['local_file']).resolve()
        if not file.is_relative_to(root):raise ValueError('Backup file outside migration directory')
        if file.stat().st_size != int(row['bytes']) or hashlib.sha256(file.read_bytes()).hexdigest()!=row['sha256']:
            raise ValueError('Backup checksum mismatch; aborting')
        result.append(row)
    if not result:raise ValueError('No fully downloaded, checksum-verified images')
    return result

def media_url(base, row):
    return target_origin(base)+'/media/'+urllib.parse.quote(object_key(row),safe='/')

def verify_remote(url, row, missing_ok=False):
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Cache-Control':'no-cache'})
        with urllib.request.urlopen(req,timeout=45) as response:
            digest=hashlib.sha256();size=0
            while data:=response.read(65536):
                size+=len(data)
                if size>int(row['bytes']):raise ValueError('Destination content is larger than expected')
                digest.update(data)
        if size!=int(row['bytes']) or digest.hexdigest()!=row['sha256']:raise ValueError('Destination checksum mismatch')
        return True
    except urllib.error.HTTPError as error:
        if missing_ok and error.code==404:return False
        raise RuntimeError('Destination verification failed: HTTP '+str(error.code)) from None

def source_key(url):
    if not isinstance(url,str):return None
    p=urllib.parse.urlsplit(url)
    if p.scheme!='https' or p.hostname not in SOURCE_HOSTS:return None
    prefix='/storage/v1/object/public/'
    if not p.path.startswith(prefix):return None
    return urllib.parse.unquote(p.path[len(prefix):])

def replace_urls(value, image_map, public_base):
    if isinstance(value,str):
        key=source_key(value)
        return media_url(public_base,image_map[key]) if key in image_map else value
    if isinstance(value,list):return [replace_urls(x,image_map,public_base) for x in value]
    if isinstance(value,dict):return {k:replace_urls(v,image_map,public_base) for k,v in value.items()}
    return value

def read_environment(path):
    values=dict(os.environ)
    if path:
        for line in Path(path).read_text(encoding='utf-8-sig').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                k,v=line.split('=',1); values[k.strip()]=v.strip().strip('"').strip("'")
    if values.get('SUPABASE_URL','').rstrip('/')!='https://mwnjoglolbyeyrmkqqqc.supabase.co':raise ValueError('Wrong Supabase project')
    if not values.get('SUPABASE_SERVICE_ROLE_KEY'):raise ValueError('Missing server credential in local environment')
    return values

def database(values, table, query, method='GET', body=None):
    if table not in ALLOWED_FIELDS:raise ValueError('Table is not in image-migration scope')
    url=values['SUPABASE_URL'].rstrip('/')+'/rest/v1/'+table+'?'+urllib.parse.urlencode(query)
    if len(url)>14000:raise ValueError('Row is too large for safe conditional update; manual review required')
    headers={'apikey':values['SUPABASE_SERVICE_ROLE_KEY'],'Authorization':'Bearer '+values['SUPABASE_SERVICE_ROLE_KEY'],'Content-Type':'application/json','Prefer':'return=representation'}
    data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None
    try:
        with urllib.request.urlopen(urllib.request.Request(url,method=method,headers=headers,data=data),timeout=30) as response:return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('Database request failed: HTTP '+str(error.code)) from None

def build_plan(values, references, images, public_base):
    wanted={}
    for ref in references:
        table=ref['table'];column=ref['column'].split('.',1)[0].split('[',1)[0]
        if column in ALLOWED_FIELDS.get(table,set()) and ref['row_id']:
            wanted.setdefault((table,ref['row_id']),set()).add(column)
    image_map={object_key(row):row for row in images};changes=[]
    for (table,row_id),columns in wanted.items():
        rows=database(values,table,{'id':'eq.'+row_id,'select':'id,'+','.join(sorted(columns))})
        if len(rows)!=1:continue
        for column in sorted(columns):
            before=rows[0].get(column);after=replace_urls(before,image_map,public_base)
            if before!=after:changes.append({'table':table,'row_id':row_id,'column':column,'before':before,'after':after})
    return {'version':1,'supabase_project':'mwnjoglolbyeyrmkqqqc','account':ACCOUNT,'r2_bucket':BUCKET,'public_base':target_origin(public_base),'images':[{'bucket':x['bucket'],'path':x['path'],'bytes':x['bytes'],'sha256':x['sha256']} for x in images],'changes':changes}

def run_wrangler(args, cli=None):
    command=[shutil.which('node') or 'node',str(Path(cli).resolve())] if cli else [shutil.which('npx.cmd') or shutil.which('npx') or 'npx','--yes','wrangler@4.168.0']
    env=dict(os.environ);env['CLOUDFLARE_ACCOUNT_ID']=ACCOUNT;env['WRANGLER_SEND_METRICS']='false'
    result=subprocess.run(command+args,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
    if result.returncode:raise RuntimeError('Wrangler failed. Inspect its local log before retrying; no database URLs changed.')

def copy_images(images, read_base, work_dir, cli=None):
    completed=[]
    journal=Path(work_dir)/'r2-copy-verified.json'
    for i,row in enumerate(images,1):
        url=media_url(read_base,row)
        if not verify_remote(url,row,missing_ok=True):
            run_wrangler(['r2','object','put',BUCKET+'/'+object_key(row),'--file',row['local_file'],'--content-type',row['mime'],'--cache-control','public, max-age=3600','--remote'],cli)
            verify_remote(url,row)
        completed.append({'key':object_key(row),'sha256':row['sha256'],'bytes':row['bytes'],'url':url})
        atomic_json(journal,{'account':ACCOUNT,'bucket':BUCKET,'images':completed})
        print('Copied and downloaded for verification:',i,'/',len(images),flush=True)

def prepare_cutover(images, work_dir, project_dir):
    verified=json.loads((Path(work_dir)/'r2-copy-verified.json').read_text(encoding='utf-8'))
    if verified.get('account')!=ACCOUNT or verified.get('bucket')!=BUCKET:raise ValueError('Wrong R2 copy manifest')
    copied={r['key']:r['sha256'] for r in verified['images']}
    if any(copied.get(object_key(r))!=r['sha256'] for r in images):raise ValueError('R2 copy is incomplete; refusing to enable uploads')
    project=Path(project_dir).resolve();path=project/'wrangler.jsonc';config=json.loads(path.read_text(encoding='utf-8'))
    if config.get('account_id')!=ACCOUNT or config.get('name')!='noov-app':raise ValueError('Wrong Worker configuration')
    config.setdefault('vars',{})['R2_MEDIA_ENABLED']='true'
    bindings=[x for x in config.get('r2_buckets',[]) if x.get('binding')!='R2_IMAGES']
    config['r2_buckets']=bindings+[{'binding':'R2_IMAGES','bucket_name':BUCKET}]
    secrets=config.setdefault('secrets',{}).setdefault('required',[])
    if 'SUPABASE_PUBLISHABLE_KEY' not in secrets:secrets.append('SUPABASE_PUBLISHABLE_KEY')
    atomic_json(path,config)
    env=project/'.env.local';lines=env.read_text(encoding='utf-8').splitlines() if env.exists() else []
    lines=[l for l in lines if not l.startswith('VITE_MEDIA_STORAGE=')]+['VITE_MEDIA_STORAGE=r2']
    env.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print('Local production configuration prepared. Build and deploy before applying the URL plan. No remote writes.')

def apply_plan(values, plan, journal_path, rollback=False):
    if plan.get('supabase_project')!='mwnjoglolbyeyrmkqqqc' or plan.get('account')!=ACCOUNT or plan.get('r2_bucket')!=BUCKET:raise ValueError('Wrong migration plan')
    # Never substitute URLs on the strength of metadata or HEAD responses alone.
    if not rollback:
        for row in plan['images']:verify_remote(media_url(plan['public_base'],row),row)
    previous=json.loads(journal_path.read_text(encoding='utf-8')) if journal_path.exists() else {'applied':[]}
    done={(x['table'],x['row_id'],x['column']) for x in previous['applied']}
    changes=list(reversed(plan['changes'])) if rollback else plan['changes']
    for change in changes:
        key=(change['table'],change['row_id'],change['column'])
        if rollback and key not in done:continue
        if not rollback and key in done:continue
        table,column=change['table'],change['column']
        if column not in ALLOWED_FIELDS.get(table,set()):raise ValueError('Invalid field in plan')
        before,after=(change['after'],change['before']) if rollback else (change['before'],change['after'])
        # Direct eq filters take the literal value, not the extra quoting used in
        # in/or expressions. database() percent-encodes the entire query value.
        literal=before if isinstance(before,str) else json.dumps(before,ensure_ascii=False,separators=(',',':'))
        # Exact compare-and-swap: concurrent edits to this field are never overwritten.
        query={'id':'eq.'+change['row_id'],column:'is.null' if before is None else 'eq.'+literal,'select':'id,'+column}
        rows=database(values,table,query,method='PATCH',body={column:after})
        if len(rows)!=1 or rows[0].get(column)!=after:raise RuntimeError('Concurrent edit or unconfirmed update; stopped. Use the journal for safe rollback.')
        if rollback:previous['applied']=[x for x in previous['applied'] if (x['table'],x['row_id'],x['column'])!=key]
        else:previous['applied'].append(change)
        atomic_json(journal_path,previous)
    print('Rollback complete.' if rollback else 'All planned image fields updated and confirmed.')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase',choices=['plan','copy','prepare-cutover','apply','rollback'],default='plan')
    parser.add_argument('--work-dir',required=True)
    parser.add_argument('--references')
    parser.add_argument('--env-file')
    parser.add_argument('--public-base',default='https://noov.app.br')
    parser.add_argument('--read-base',default='https://noov-app-r2-preview.noov-serpainfo.workers.dev')
    parser.add_argument('--wrangler-cli')
    args=parser.parse_args();work=Path(args.work_dir).resolve();plan_file=work/'r2-url-plan.json';journal=work/'r2-url-journal.json'
    if args.phase=='copy':copy_images(read_verified_manifest(work),target_origin(args.read_base),work,args.wrangler_cli);return
    if args.phase=='prepare-cutover':prepare_cutover(read_verified_manifest(work),work,Path(__file__).resolve().parent.parent);return
    values=read_environment(args.env_file)
    if args.phase=='plan':
        if not args.references:parser.error('--references is required for a plan')
        references=list(csv.DictReader(Path(args.references).open(encoding='utf-8-sig')))
        plan=build_plan(values,references,read_verified_manifest(work),target_origin(args.public_base));atomic_json(plan_file,plan)
        print('DRY PLAN ONLY:',len(plan['images']),'verified image files;',len(plan['changes']),'database fields. No remote changes.')
    else:
        plan=json.loads(plan_file.read_text(encoding='utf-8'));apply_plan(values,plan,journal,rollback=args.phase=='rollback')

if __name__=='__main__':
    try:main()
    except Exception as error:print(type(error).__name__+': '+str(error),file=sys.stderr);raise SystemExit(1)
