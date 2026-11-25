import importlib.util, pathlib, tempfile, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('migration',pathlib.Path(__file__).with_name('r2-migration.py'))
migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)

class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.image={'bucket':'product-images','path':'store/a.png','bytes':'3','sha256':'test-hash'}
        self.images={'product-images/store/a.png':self.image}
        self.old='https://mwnjoglolbyeyrmkqqqc.supabase.co/storage/v1/object/public/product-images/store/a.png'
        self.target='https://noov.app.br/media/product-images/store/a.png'
        self.plan={'supabase_project':'mwnjoglolbyeyrmkqqqc','account':migration.ACCOUNT,'r2_bucket':migration.BUCKET,'public_base':'https://noov.app.br','images':[self.image],
                   'changes':[{'table':'produtos','row_id':'row','column':'imagem_url','before':self.old,'after':self.target}]}
    def test_only_verified_image_urls_are_replaced(self):
        value={'image':self.old,'missing':self.old.replace('a.png','missing.png'),'price':14.9,'external':'https://images.unsplash.com/a.png'}
        result=migration.replace_urls(value,self.images,'https://noov.app.br')
        self.assertEqual(result['image'],self.target);self.assertEqual(result['missing'],value['missing']);self.assertEqual(result['price'],14.9);self.assertEqual(result['external'],value['external'])
    def test_legacy_project_and_cache_query_map_to_the_same_verified_file(self):
        legacy=self.old.replace('mwnjoglolbyeyrmkqqqc','oiyuyqkpkcezezusxdmu')+'?t=10'
        self.assertEqual(migration.replace_urls([legacy],self.images,'https://noov.app.br'),[self.target])
    def test_untrusted_hosts_are_not_rewritten(self):
        url=self.old.replace('mwnjoglolbyeyrmkqqqc.supabase.co','untrusted.test')
        self.assertEqual(migration.replace_urls(url,self.images,'https://noov.app.br'),url)
    def test_private_buckets_and_path_traversal_are_rejected(self):
        for row in [{'bucket':'installers','path':'a.exe'},{'bucket':'logos','path':'../a.png'},{'bucket':'logos','path':'a%2fb.png'}]:
            with self.assertRaises(ValueError):migration.object_key(row)
    def test_destination_requires_a_known_noov_https_origin(self):
        for url in ['http://noov.app.br','https://noov.app.br.evil.test','https://noov.app.br/media','https://u:p@noov.app.br']:
            with self.assertRaises(ValueError):migration.target_origin(url)
    def test_no_database_update_occurs_before_full_destination_verification(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(migration,'verify_remote',side_effect=ValueError('missing')),patch.object(migration,'database') as db:
            with self.assertRaises(ValueError):migration.apply_plan({},self.plan,pathlib.Path(folder)/'journal.json')
            db.assert_not_called()
    def test_update_uses_compare_and_swap_and_records_a_rollback_journal(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(migration,'verify_remote',return_value=True),patch.object(migration,'database',return_value=[{'id':'row','imagem_url':self.target}]) as db:
            journal=pathlib.Path(folder)/'journal.json';migration.apply_plan({},self.plan,journal)
            self.assertTrue(journal.exists());self.assertEqual(db.call_args.args[2]['imagem_url'],'eq.'+self.old)
            self.assertEqual(db.call_args.kwargs['body'],{'imagem_url':self.target})
    def test_concurrent_edits_are_not_reported_as_success(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(migration,'verify_remote',return_value=True),patch.object(migration,'database',return_value=[]):
            journal=pathlib.Path(folder)/'journal.json'
            with self.assertRaises(RuntimeError):migration.apply_plan({},self.plan,journal)
            self.assertFalse(journal.exists())
    def test_rollback_only_reverts_confirmed_changes_and_checks_current_value(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(migration,'database',return_value=[{'id':'row','imagem_url':self.old}]) as db:
            journal=pathlib.Path(folder)/'journal.json';migration.atomic_json(journal,{'applied':self.plan['changes']})
            migration.apply_plan({},self.plan,journal,rollback=True)
            self.assertEqual(db.call_args.args[2]['imagem_url'],'eq.'+self.target)
            self.assertEqual(db.call_args.kwargs['body'],{'imagem_url':self.old})
    def test_cutover_is_not_enabled_after_an_incomplete_r2_copy(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder);migration.atomic_json(root/'r2-copy-verified.json',{'account':migration.ACCOUNT,'bucket':migration.BUCKET,'images':[]})
            with self.assertRaises(ValueError):migration.prepare_cutover([self.image],root,root)
            self.assertFalse((root/'wrangler.jsonc').exists())
    def test_json_filters_preserve_nested_quotes_and_reserved_characters(self):
        import json
        before=[{'name':'Item (A), "especial"','image':self.old}];after=[{'name':'Item (A), "especial"','image':self.target}]
        self.plan['changes']=[{'table':'pedidos','row_id':'row','column':'items','before':before,'after':after}]
        with tempfile.TemporaryDirectory() as folder,patch.object(migration,'verify_remote',return_value=True),patch.object(migration,'database',return_value=[{'id':'row','items':after}]) as db:
            migration.apply_plan({},self.plan,pathlib.Path(folder)/'journal.json')
            literal=db.call_args.args[2]['items'][3:]
            self.assertEqual(json.loads(literal),before)

if __name__=='__main__':unittest.main()
