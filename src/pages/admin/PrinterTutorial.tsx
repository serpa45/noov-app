import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Monitor, CheckCircle2, Settings, Laptop } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const BASE = "https://mwnjoglolbyeyrmkqqqc.supabase.co/storage/v1/object/public/public_assets/ab764dab-1d31-4f1c-9bd3-c75c00d77aca";

const STEPS = [
  {
    title: "1. Baixar o QZ Tray e Certificado Digital para ser instalado",
    description: "Baixe o QZ Tray e o certificado digital e logo após, clique no programa que foi baixado para download. A impressora verde dê um duplo clique para abrir e abrirá a tela do QZ Tray Setup e clique em Next.",
    icon: <Monitor className="w-6 h-6 text-primary" />,
    imageUrl: `${BASE}/step-0-0.21286981540932903.png`,
  },
  {
    title: "2. Instalação do QZ Tray",
    description: "Clique em Install.",
    icon: <Laptop className="w-6 h-6 text-primary" />,
    imageUrl: `${BASE}/step-1-0.8965878959217585.png`,
  },
  {
    title: "3. Concluindo a instalação",
    description: "Quando a barra verde completar, o botão Close ativa. Clique em Close para finalizar a instalação.",
    icon: <CheckCircle2 className="w-6 h-6 text-primary" />,
    imageUrl: `${BASE}/step-2-0.2837359182932643.png`,
  },
  {
    title: "4. Configurando o certificado digital na impressora para impressão silenciosa",
    description: "Clique na setinha na barra de tarefas na parte inferior, próximo à hora, que estará apontada para cima, e depois dê um clique na impressora que está destacada.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: `${BASE}/step-3-0.027911725567655865.png`,
  },
  {
    title: "5. Acessar opções avançadas",
    description: "Clique em Advanced.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: `${BASE}/step-4-0.5562130900000329.png`,
  },
  {
    title: "6. Abrir Site Manager",
    description: "Ao passar o mouse por cima do Advanced, abrirá outra janela e clique em Site Manager para abrir as configurações do QZ Tray.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: `${BASE}/step-5-0.5408884574012203.png`,
  },
  {
    title: "7. Adicionar certificado",
    description: "Clique no sinal de + e depois clique em Browse.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: `${BASE}/step-6-0.9442985636040898.png`,
  },
  {
    title: "8. Localizar o certificado",
    description: "Escolha onde foi baixado o certificado digital — sempre vai para a pasta Downloads do Windows. Clique em Downloads.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: `${BASE}/step-7-0.013248021399373089.png`,
  },
  {
    title: "9. Abrir o certificado",
    description: "Clique no certificate e depois clique em Abrir.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: `${BASE}/step-8-0.5378763594724881.png`,
  },
  {
    title: "10. Finalização",
    description: "Pronto! Sua impressora está configurada ao QZ Tray para imprimir sem precisar clicar no popup de liberação. Basta clicar em Close para finalizar.",
    icon: <CheckCircle2 className="w-6 h-6 text-primary" />,
    imageUrl: `${BASE}/step-9-0.9493626432884175.png`,
  },
];

const PrinterTutorial = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [qzCertUrl, setQzCertUrl] = useState<string | null>(null);
  const [qzCertName, setQzCertName] = useState<string>("qz-certificate.crt");
  const [qzProgramUrl, setQzProgramUrl] = useState<string | null>(null);
  const [qzProgramName, setQzProgramName] = useState<string>("qz-tray-setup.exe");

  useEffect(() => {
    const loadInstallers = async () => {
      const { data, error } = await supabase.storage.from("installers").list("", { limit: 100 });
      if (error || !data) return;

      // Programa: prioriza qz-tray-setup.exe; fallback: qualquer .exe com "qz" no nome
      const program =
        data.find((f) => f.name === "qz-tray-setup.exe") ||
        data.find((f) => /qz.*\.exe$/i.test(f.name));
      if (program) {
        setQzProgramName(program.name);
        setQzProgramUrl(
          supabase.storage.from("installers").getPublicUrl(program.name).data.publicUrl
        );
      }

      // Certificado: prioriza qz-certificate.crt; fallback: .crt/.pem/.cer
      const cert =
        data.find((f) => f.name === "qz-certificate.crt") ||
        data.find((f) => /\.(crt|pem|cer)$/i.test(f.name));
      if (cert) {
        setQzCertName(cert.name);
        setQzCertUrl(
          supabase.storage.from("installers").getPublicUrl(cert.name).data.publicUrl
        );
      }
    };
    loadInstallers();
  }, [user]);

  const triggerDownload = async (path: string, filename: string) => {
    try {
      // Baixa direto do storage como Blob para forçar o download do arquivo
      // (evita que o navegador apenas abra o certificado/exe em nova aba).
      const { data, error } = await supabase.storage.from("installers").download(path);
      if (error || !data) throw error || new Error("Falha ao baixar arquivo");
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao baixar arquivo");
    }
  };

  const downloadCertificate = () => {
    if (!qzCertUrl) {
      toast.error("Certificado ainda não disponível. Contate o administrador.");
      return;
    }
    const ext = qzCertName.split(".").pop() || "crt";
    triggerDownload(qzCertName, `digital-certificate.${ext}`);
  };

  const downloadQZTray = () => {
    if (!qzProgramUrl) {
      toast.error("Instalador do QZ Tray ainda não disponível. Contate o administrador.");
      return;
    }
    triggerDownload(qzProgramName, qzProgramName);
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/lojista/configuracoes?tab=printer')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-display">Passo a passo para: instalação da impressora</h1>
          <p className="text-muted-foreground">Siga o passo a passo para instalar e configurar sua impressora para evitar o popup de liberação para imprimir</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
        <p className="text-sm font-bold text-black">
          É obrigatório baixar ambos os arquivos para a instalação e configuração da impressora.
        </p>
        <div className="flex flex-wrap gap-4">
          <Button onClick={downloadQZTray} className="gap-2">
            <Download className="w-4 h-4" />
            Baixar Programa QZ Tray
          </Button>
          <Button onClick={downloadCertificate} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Baixar Certificado Digital
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {STEPS.map((step, index) => (
          <Card key={index} className="p-6 border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                {step.icon}
              </div>
              <div className="space-y-2 flex-grow">
                <h3 className="text-lg font-bold font-display">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>

                <div className="mt-4 overflow-hidden rounded-lg border border-border bg-muted aspect-video flex items-center justify-center">
                  <img
                    src={step.imageUrl}
                    alt={step.title}
                    loading="lazy"
                    className="w-full h-full object-contain bg-black/5"
                  />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center space-y-4">
        <h2 className="text-xl font-bold">Tudo pronto?</h2>
        <p className="text-muted-foreground">Após seguir todos os passos, volte para as configurações e realize um teste de impressão.</p>
        <Button onClick={() => navigate("/lojista/configuracoes")} className="px-8">
          Voltar para Configurações
        </Button>
      </div>
    </div>
  );
};

export default PrinterTutorial;
