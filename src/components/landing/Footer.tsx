import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Shield } from "lucide-react";

const footerLinks: Record<string, { label: string; href: string }[]> = {
  Produto: [
    { label: "Benefícios", href: "#beneficios" },
    { label: "Como Funciona", href: "#como-funciona" },
    { label: "Planos", href: "#planos" },
    { label: "Segmentos", href: "#segmentos" },
  ],
  Empresa: [
    { label: "Sobre", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Afiliados", href: "/afiliados" },
    { label: "Contato", href: "#" },
  ],
  Legal: [
    { label: "Termos de Uso", href: "/termos" },
    { label: "Privacidade", href: "/privacidade" },
    { label: "Cookies", href: "#" },
  ],
};

const Footer = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"terms" | "privacy">("terms");

  const handleClick = (href: string) => {
    if (href === "/termos") {
      setModalType("terms");
      setShowModal(true);
      return;
    }
    if (href === "/privacidade") {
      setModalType("privacy");
      setShowModal(true);
      return;
    }

    if (href.startsWith("/")) {
      navigate(href);
    } else if (href.startsWith("#") && href !== "#") {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="py-12 bg-foreground">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-2xl font-extrabold font-display text-background tracking-tight mb-3">N<span className="text-secondary">O</span>OV</h3>
            <p className="text-sm text-background/60">
              Seu delivery, suas regras.<br />Menos taxas, mais lucro.
            </p>
          </div>
          {Object.entries(footerLinks).map(([title, items]) => (
            <div key={title}>
              <h4 className="font-bold font-display text-background mb-3">{title}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.label}>
                    <button
                      onClick={() => handleClick(item.href)}
                      className="text-sm text-background/60 hover:text-background transition-colors"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-background/10 pt-8 text-center">
          <p className="text-sm text-background/40">
            © {new Date().getFullYear()} N<span className="text-secondary">O</span>OV. Todos os direitos reservados.
          </p>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalType === "terms" ? (
                <>
                  <FileText className="w-5 h-5 text-primary" />
                  Termos de Uso - NOOV
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 text-primary" />
                  Política de Privacidade - NOOV
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed py-4">
            {modalType === "terms" ? (
              <div className="space-y-4">
                <h3 className="font-bold text-foreground underline uppercase">Termo de Uso do Sistema NOOV</h3>
                
                <div>
                  <h4 className="font-bold text-foreground">1. ACEITAÇÃO DOS TERMOS</h4>
                  <p>Ao utilizar o sistema NOOV, o lojista declara estar ciente e de acordo com os presentes Termos de Uso, comprometendo-se a cumpri-los integralmente.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">2. CADASTRO E INFORMAÇÕES DO CLIENTE</h4>
                  <p>O sistema poderá coletar informações básicas dos clientes, tais como nome, telefone e outros dados necessários para fins de cadastro, contato e comunicação. Essas informações serão utilizadas exclusivamente para a operação do sistema e relacionamento entre o lojista e seus clientes.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">3. RESPONSABILIDADE DO LOJISTA</h4>
                  <p>Todo o conteúdo inserido no sistema é de inteira responsabilidade do lojista, incluindo, mas não se limitando a: Produtos cadastrados, Preços e valores informados, Imagens utilizadas, Descrições e informações adicionais. O sistema não se responsabiliza por quaisquer erros, inconsistências ou irregularidades nessas informações.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">4. PLANOS E PAGAMENTOS</h4>
                  <p>O uso do sistema está condicionado ao pagamento dos valores contratados entre as partes. Em caso de inadimplência: O acesso ao sistema será automaticamente bloqueado; A liberação do sistema ocorrerá somente após a regularização do pagamento pendente.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">5. USO DAS INFORMAÇÕES</h4>
                  <p>As informações cadastradas no sistema são de uso exclusivo da plataforma e do lojista, sendo utilizadas apenas para a operação do serviço, gerenciamento de pedidos e atendimento ao cliente.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">6. FUNCIONALIDADE DO SISTEMA</h4>
                  <p>O lojista é responsável por: Cadastrar e manter atualizadas suas informações; Gerenciar os pedidos realizados pelos clientes; Garantir a veracidade das informações fornecidas.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">7. CANCELAMENTO E EXCLUSÃO DE DADOS</h4>
                  <p>Caso o lojista opte por não continuar utilizando o sistema: A conta será considerada inativa após o término do período contratado; Os dados permanecerão armazenados por até 3 (três) meses; Após esse período, todas as informações serão permanentemente excluídas, incluindo dados da conta e registros associados.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">8. ALTERAÇÕES NOS TERMOS</h4>
                  <p>Estes Termos de Uso poderão ser atualizados a qualquer momento, sendo responsabilidade do lojista revisá-los periodicamente.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">9. PROPRIEDADE INTELECTUAL</h4>
                  <p>O sistema NOOV, incluindo sua estrutura, funcionalidades, design e código, é de propriedade exclusiva do fornecedor, sendo proibida: Cópia, Reprodução, Engenharia reversa, Distribuição sem autorização.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">10. LIMITAÇÃO DE RESPONSABILIDADE</h4>
                  <p>O NOOV não se responsabiliza por: Prejuízos decorrentes do uso inadequado da plataforma; Perda de dados causada por ação do lojista; Problemas externos, como falhas de internet ou dispositivos.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">11. ALTERAÇÕES NOS TERMOS</h4>
                  <p>Este Termo poderá ser atualizado a qualquer momento. O uso contínuo da plataforma após alterações implica na aceitação dos novos termos.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">12. RETENÇÃO DE HISTÓRICO DE PEDIDOS E ENTREGAS</h4>
                  <p>O sistema NOOV disponibiliza exclusivamente o histórico de informações de pedidos e entregas referentes ao ano vigente (ano atual). Informações de anos anteriores não permanecem registradas no sistema e não estarão disponíveis para consulta. Da mesma forma, os gráficos e relatórios analíticos são gerados apenas com base nos dados do ano atual, não sendo gerados relatórios ou gráficos com base em dados de anos anteriores.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">13. DISPOSIÇÕES GERAIS</h4>
                  <p>O uso do sistema implica na aceitação integral destes termos. Em caso de discordância, o uso do serviço deve ser imediatamente interrompido.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-bold text-foreground underline uppercase">POLÍTICA DE PRIVACIDADE – SISTEMA NOOV</h3>
                
                <div>
                  <h4 className="font-bold text-foreground">1. DADOS COLETADOS</h4>
                  <p>O NOOV poderá coletar os seguintes dados:</p>
                  <p className="mt-2 font-semibold">1.1. Dados de lojistas (usuários do sistema):</p>
                  <ul className="list-disc pl-5">
                    <li>Nome</li>
                    <li>E-mail</li>
                    <li>Telefone</li>
                    <li>Informações comerciais</li>
                  </ul>
                  <p className="mt-2 font-semibold">1.2. Dados de clientes finais cadastrados pelo lojista:</p>
                  <ul className="list-disc pl-5">
                    <li>Nome</li>
                    <li>Telefone</li>
                    <li>Endereço (quando aplicável)</li>
                    <li>Informações relacionadas a pedidos</li>
                  </ul>
                  <p className="mt-2 font-semibold">1.3. Dados técnicos (automáticos):</p>
                  <ul className="list-disc pl-5">
                    <li>Endereço IP</li>
                    <li>Informações do dispositivo</li>
                    <li>Dados de acesso e uso da plataforma</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">2. FINALIDADE DO USO DOS DADOS</h4>
                  <p>Os dados coletados são utilizados para:</p>
                  <ul className="list-disc pl-5">
                    <li>Permitir o funcionamento do sistema</li>
                    <li>Gerenciar pedidos e cadastros</li>
                    <li>Facilitar o contato entre lojista e cliente</li>
                    <li>Melhorar a experiência do usuário</li>
                    <li>Garantir segurança e prevenção a fraudes</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">3. BASE LEGAL (LGPD)</h4>
                  <p>O tratamento de dados pessoais é realizado com base na Lei nº 13.709/2018 (LGPD), considerando:</p>
                  <ul className="list-disc pl-5">
                    <li>Execução de contrato</li>
                    <li>Legítimo interesse</li>
                    <li>Consentimento do titular, quando necessário</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">4. COMPARTILHAMENTO DE DADOS</h4>
                  <p>O NOOV não comercializa dados pessoais. Os dados poderão ser compartilhados apenas quando necessário, como:</p>
                  <ul className="list-disc pl-5">
                    <li>Cumprimento de obrigações legais</li>
                    <li>Requisição por autoridades públicas</li>
                    <li>Serviços essenciais para funcionamento da plataforma (ex: hospedagem)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">5. RESPONSABILIDADE DO LOJISTA</h4>
                  <p>O lojista é responsável pelos dados inseridos no sistema, devendo:</p>
                  <ul className="list-disc pl-5">
                    <li>Garantir que possui autorização do cliente</li>
                    <li>Utilizar os dados de forma adequada</li>
                    <li>Cumprir a legislação vigente de proteção de dados</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">6. ARMAZENAMENTO E SEGURANÇA</h4>
                  <p>Os dados são armazenados em ambiente seguro, com medidas técnicas e administrativas para proteção contra:</p>
                  <ul className="list-disc pl-5">
                    <li>Acesso não autorizado</li>
                    <li>Vazamentos</li>
                    <li>Alterações indevidas</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">7. RETENÇÃO E EXCLUSÃO DOS DADOS</h4>
                  <ul className="list-disc pl-5">
                    <li>Os dados serão mantidos enquanto o contrato estiver ativo</li>
                    <li>Em caso de cancelamento, os dados serão armazenados por até 3 (três) meses</li>
                    <li>Após esse período, serão permanentemente excluídos</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">8. DIREITOS DOS TITULARES DOS DADOS</h4>
                  <p>Nos termos da LGPD, os titulares podem solicitar:</p>
                  <ul className="list-disc pl-5">
                    <li>Acesso aos dados</li>
                    <li>Correção de dados incompletos ou desatualizados</li>
                    <li>Exclusão de dados (quando aplicável)</li>
                    <li>Revogação do consentimento</li>
                  </ul>
                  <p className="mt-2">Solicitações podem ser feitas através do e-mail informado neste documento.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">9. COOKIES E TECNOLOGIAS DE RASTREAMENTO</h4>
                  <p>O sistema poderá utilizar cookies e tecnologias similares para:</p>
                  <ul className="list-disc pl-5">
                    <li>Melhorar a navegação</li>
                    <li>Personalizar a experiência</li>
                    <li>Coletar dados estatísticos</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">10. ALTERAÇÕES NESTA POLÍTICA</h4>
                  <p>Esta Política poderá ser atualizada a qualquer momento. Recomenda-se a revisão periódica.</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </footer>
  );
};

export default Footer;
