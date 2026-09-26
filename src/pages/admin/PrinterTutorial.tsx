import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Monitor, CheckCircle2, Settings, Laptop } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const STEPS = [
  {
    title: "1. Baixar o QZ Tray e Certificado Digital para ser instalado",
    description: "Baixe o QZ Tray e o certificado digital e logo após, clique no programa que foi baixado para download. A impressora verde dê um duplo clique para abrir e abrirá a tela do QZ Tray Setup e clique em Next.",
    icon: <Monitor className="w-6 h-6 text-primary" />,
    imageUrl: "/printer-tutorial/step-0.png",
  },
  {
    title: "2. Instalação do QZ Tray",
    description: "Clique em Install.",
    icon: <Laptop className="w-6 h-6 text-primary" />,
    imageUrl: "/printer-tutorial/step-1.png",
  },
  {
    title: "3. Concluindo a instalação",
    description: "Quando a barra verde completar, o botão Close ativa. Clique em Close para finalizar a instalação.",
    icon: <CheckCircle2 className="w-6 h-6 text-primary" />,
    imageUrl: "/printer-tutorial/step-2.png",
  },
  {
    title: "4. Configurando o certificado digital na impressora para impressão silenciosa",
    description: "Clique na setinha na barra de tarefas na parte inferior, próximo à hora, que estará apontada para cima, e depois dê um clique na impressora que está destacada.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: "/printer-tutorial/step-3.png",
  },
  {
    title: "5. Acessar opções avançadas",
    description: "Clique em Advanced.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: "/printer-tutorial/step-4.png",
  },
  {
    title: "6. Abrir Site Manager",
    description: "Ao passar o mouse por cima do Advanced, abrirá outra janela e clique em Site Manager para abrir as configurações do QZ Tray.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: "/printer-tutorial/step-5.png",
  },
  {
    title: "7. Adicionar certificado",
    description: "Clique no sinal de + e depois clique em Browse.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: "/printer-tutorial/step-6.png",
  },
  {
    title: "8. Localizar o certificado",
    description: "Escolha onde foi baixado o certificado digital — sempre vai para a pasta Downloads do Windows. Clique em Downloads.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: "/printer-tutorial/step-7.png",
  },
  {
    title: "9. Abrir o certificado",
    description: "Clique no certificate e depois clique em Abrir.",
    icon: <Settings className="w-6 h-6 text-primary" />,
    imageUrl: "/printer-tutorial/step-8.png",
  },
  {
    title: "10. Finalização",
    description: "Pronto! Sua impressora está configurada ao QZ Tray para imprimir sem precisar clicar no popup de liberação. Basta clicar em Close para finalizar.",
    icon: <CheckCircle2 className="w-6 h-6 text-primary" />,
    imageUrl: "/printer-tutorial/step-9.png",
  },
];

const PrinterTutorial = () => {
  const navigate = useNavigate();



  const downloadCertificate = () => {
    try {
      const a = document.createElement("a");
      a.href = "/qz-certificate.crt";
      a.download = "override.crt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Certificado digital baixado com sucesso!");
    } catch (err) {
      console.error("Erro ao baixar certificado:", err);
      toast.error("Erro ao baixar o certificado digital");
    }
  };

  const downloadQZTray = () => {
    try {
      const officialUrl = "https://github.com/qzind/tray/releases/download/v2.2.4/qz-tray-2.2.4.exe";
      const a = document.createElement("a");
      a.href = officialUrl;
      a.download = "qz-tray-2.2.4.exe";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Iniciando download do instalador oficial do QZ Tray!");
    } catch (err) {
      window.open("https://github.com/qzind/tray/releases/download/v2.2.4/qz-tray-2.2.4.exe", "_blank");
    }
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

      <div className="flex flex-col md:flex-row items-center gap-6 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
        <div className="flex-1 space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            <span>Atenção: Janela de autorização</span>
          </div>
          <h3 className="text-base font-bold text-foreground">Apareceu a mensagem "Action Required" na sua tela?</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Se ao abrir o sistema ou tentar imprimir o Windows exibir a janela mostrada ao lado solicitando autorização do QZ Tray:
          </p>
          <ul className="text-sm space-y-2.5 text-foreground/90 pl-1">
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-800 text-xs font-bold">1</span>
              <span>
                Baixe o certificado clicando em <strong className="font-semibold text-foreground">"Baixar Certificado Digital"</strong> acima e copie o arquivo para a pasta <code className="bg-muted px-1 rounded text-xs">C:\Program Files\QZ Tray\</code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-800 text-xs font-bold">2</span>
              <span>Feche o QZ Tray (clique direito no ícone verde perto do relógio → <strong className="font-semibold text-foreground">Exit</strong>) e abra novamente.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-800 text-xs font-bold">3</span>
              <span>Recarregue a página do Noov (<strong className="font-semibold text-foreground">F5</strong>). O popup agora aparecerá com fundo <strong className="font-semibold text-emerald-600">verde</strong> (confiável).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-800 text-xs font-bold">4</span>
              <span>Marque <strong className="font-semibold text-foreground">"Remember this decision"</strong> e clique em <strong className="font-semibold text-emerald-600">"Allow"</strong>.</span>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground pt-1">
            Pronto! O popup nunca mais aparecerá e a impressão será silenciosa.
          </p>
        </div>
        <div className="shrink-0 rounded-xl overflow-hidden border border-border/80 shadow-md bg-white">
          <img 
            src="/printer-tutorial/qz-tray-allow-popup.png" 
            alt="Janela Action Required do QZ Tray com botões Allow e Remember this decision"
            className="max-w-[280px] h-auto object-contain"
          />
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
                    onError={(e) => {
                      // Fallback para storage se caminho relativo falhar
                      const target = e.currentTarget;
                      const fallback = `https://mwnjoglolbyeyrmkqqqc.supabase.co/storage/v1/object/public/public_assets/ab764dab-1d31-4f1c-9bd3-c75c00d77aca/step-${index}.png`;
                      if (target.src !== fallback) {
                        target.src = fallback;
                      }
                    }}
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
