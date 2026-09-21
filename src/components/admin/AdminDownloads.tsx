import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload, Trash2, FileDown, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

interface StoredFile {
  name: string;
  size?: number;
  updated_at?: string;
  publicUrl: string;
}

const BUCKET = "installers";

const AdminDownloads = () => {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit: 100,
      sortBy: { column: "updated_at", order: "desc" },
    });
    if (error) {
      toast.error("Erro ao carregar arquivos");
      setLoading(false);
      return;
    }
    const items: StoredFile[] = (data || [])
      .filter((f) => f.name && !f.name.startsWith("."))
      .map((f) => ({
        name: f.name,
        size: (f as any).metadata?.size,
        updated_at: f.updated_at,
        publicUrl: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
      }));
    setFiles(items);
    setLoading(false);
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const uploadFile = async (file: File, targetName?: string, label?: string) => {
    const path = targetName || file.name;
    setUploading(label || path);
    try {
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      toast.success(`${label || path} enviado com sucesso!`);
      await loadFiles();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(null);
    }
  };

  const deleteFile = async (name: string) => {
    if (!confirm(`Remover "${name}"?`)) return;
    const { error } = await supabase.storage.from(BUCKET).remove([name]);
    if (error) {
      toast.error("Erro ao remover arquivo");
      return;
    }
    toast.success("Arquivo removido");
    await loadFiles();
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const QZ_PROGRAM = "qz-tray-setup.exe";
  const QZ_CERT = "qz-certificate.crt";

  const qzProgram = files.find((f) => f.name === QZ_PROGRAM);
  const qzCert = files.find((f) => f.name === QZ_CERT);
  const others = files.filter((f) => f.name !== QZ_PROGRAM && f.name !== QZ_CERT);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Downloads para lojistas</h2>
        <p className="text-sm text-muted-foreground">
          Arquivos disponíveis para todos os lojistas baixarem — QZ Tray, certificado digital e demais instaladores.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-primary" />
              QZ Tray (Instalador)
            </CardTitle>
            <CardDescription>Programa de impressão silenciosa para PC.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {qzProgram ? (
              <div className="text-sm space-y-1">
                <p className="font-medium truncate">{qzProgram.name}</p>
                <p className="text-muted-foreground text-xs">{formatSize(qzProgram.size)}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild size="sm" variant="default">
                    <a href={qzProgram.publicUrl} download>
                      <Download className="w-4 h-4 mr-1" /> Baixar
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyUrl(qzProgram.publicUrl)}>
                    <Copy className="w-4 h-4 mr-1" /> Copiar link
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteFile(qzProgram.name)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum instalador enviado.</p>
            )}
            <div>
              <Label htmlFor="upload-qz" className="cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md hover:bg-muted text-sm">
                  {uploading === "QZ Tray" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{qzProgram ? "Substituir instalador" : "Enviar instalador (.exe)"}</span>
                </div>
                <Input
                  id="upload-qz"
                  type="file"
                  accept=".exe"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f, QZ_PROGRAM, "QZ Tray");
                    e.target.value = "";
                  }}
                />
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-primary" />
              Certificado Digital
            </CardTitle>
            <CardDescription>Certificado para o QZ Tray imprimir sem popup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {qzCert ? (
              <div className="text-sm space-y-1">
                <p className="font-medium truncate">{qzCert.name}</p>
                <p className="text-muted-foreground text-xs">{formatSize(qzCert.size)}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild size="sm" variant="default">
                    <a href={qzCert.publicUrl} download>
                      <Download className="w-4 h-4 mr-1" /> Baixar
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyUrl(qzCert.publicUrl)}>
                    <Copy className="w-4 h-4 mr-1" /> Copiar link
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteFile(qzCert.name)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum certificado enviado.</p>
            )}
            <div>
              <Label htmlFor="upload-cert" className="cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md hover:bg-muted text-sm">
                  {uploading === "Certificado" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{qzCert ? "Substituir certificado" : "Enviar certificado (.crt/.pem)"}</span>
                </div>
                <Input
                  id="upload-cert"
                  type="file"
                  accept=".crt,.pem,.txt,.cer"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f, QZ_CERT, "Certificado");
                    e.target.value = "";
                  }}
                />
              </Label>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outros arquivos</CardTitle>
          <CardDescription>Envie qualquer arquivo adicional para disponibilizar aos lojistas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="upload-any" className="cursor-pointer">
            <div className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md hover:bg-muted text-sm w-fit">
              {uploading === "arquivo" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>Enviar novo arquivo</span>
            </div>
            <Input
              id="upload-any"
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f, f.name, "arquivo");
                e.target.value = "";
              }}
            />
          </Label>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : others.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum arquivo adicional.</p>
          ) : (
            <div className="divide-y border rounded-md">
              {others.map((f) => (
                <div key={f.name} className="flex items-center justify-between p-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(f.size)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button asChild size="sm" variant="outline">
                      <a href={f.publicUrl} download>
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copyUrl(f.publicUrl)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteFile(f.name)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDownloads;
