
import { motion } from "framer-motion";
import { FileText } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background py-20 px-4">
      <div className="container max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="prose prose-slate max-w-none"
        >
          <div className="flex items-center gap-3 mb-8">
            <FileText className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-extrabold font-display m-0">Termos de Uso</h1>
          </div>
          
          <div className="space-y-6 text-foreground/80 leading-relaxed">
            <h3 className="font-bold text-foreground underline uppercase">Termo de Uso do Sistema NOOV</h3>
            
            <section>
              <h4 className="font-bold text-foreground">1. ACEITAÇÃO DOS TERMOS</h4>
              <p>Ao utilizar o sistema NOOV, o lojista declara estar ciente e de acordo com os presentes Termos de Uso, comprometendo-se a cumpri-los integralmente.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">2. CADASTRO E INFORMAÇÕES DO CLIENTE</h4>
              <p>O sistema poderá coletar informações básicas dos clientes, tais como nome, telefone e outros dados necessários para fins de cadastro, contato e comunicação. Essas informações serão utilizadas exclusivamente para a operação do sistema e relacionamento entre o lojista e seus clientes.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">3. RESPONSABILIDADE DO LOJISTA</h4>
              <p>Todo o conteúdo inserido no sistema é de inteira responsabilidade do lojista, incluindo, mas não se limitando a: Produtos cadastrados, Preços e valores informados, Imagens utilizadas, Descrições e informações adicionais. O sistema não se responsabiliza por quaisquer erros, inconsistências ou irregularidades nessas informações.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">4. PLANOS E PAGAMENTOS</h4>
              <p>O uso do sistema está condicionado ao pagamento dos valores contratados entre as partes. Em caso de inadimplência: O acesso ao sistema será automaticamente bloqueado; A liberação do sistema ocorrerá somente após a regularização do pagamento pendente.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">5. USO DAS INFORMAÇÕES</h4>
              <p>As informações cadastradas no sistema são de uso exclusivo da plataforma e do lojista, sendo utilizadas apenas para a operação do serviço, gerenciamento de pedidos e atendimento ao cliente.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">6. FUNCIONALIDADE DO SISTEMA</h4>
              <p>O lojista é responsável por: Cadastrar e manter atualizadas suas informações; Gerenciar os pedidos realizados pelos clientes; Garantir a veracidade das informações fornecidas.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">7. CANCELAMENTO E EXCLUSÃO DE DADOS</h4>
              <p>Caso o lojista opte por não continuar utilizando o sistema: A conta será considerada inativa após o término do período contratado; Os dados permanecerão armazenados por até 3 (três) meses; Após esse período, todas as informações serão permanentemente excluídas, incluindo dados da conta e registros associados.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">8. ALTERAÇÕES NOS TERMOS</h4>
              <p>Estes Termos de Uso poderão ser atualizados a qualquer momento, sendo responsabilidade do lojista revisá-los periodicamente.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">9. PROPRIEDADE INTELECTUAL</h4>
              <p>O sistema NOOV, incluindo sua estrutura, funcionalidades, design e código, é de propriedade exclusiva do fornecedor, sendo proibida: Cópia, Reprodução, Engenharia reversa, Distribuição sem autorização.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">10. LIMITAÇÃO DE RESPONSABILIDADE</h4>
              <p>O NOOV não se responsabiliza por: Prejuízos decorrentes do uso inadequado da plataforma; Perda de dados causada por ação do lojista; Problemas externos, como falhas de internet ou dispositivos.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">11. ALTERAÇÕES NOS TERMOS</h4>
              <p>Este Termo poderá ser atualizado a qualquer momento. O uso contínuo da plataforma após alterações implica na aceitação dos novos termos.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">12. RETENÇÃO DE HISTÓRICO DE PEDIDOS E ENTREGAS</h4>
              <p>O sistema NOOV disponibiliza exclusivamente o histórico de informações de pedidos e entregas referentes ao ano vigente (ano atual). Informações de anos anteriores não permanecem registradas no sistema e não estarão disponíveis para consulta. Da mesma forma, os gráficos e relatórios analíticos são gerados apenas com base nos dados do ano atual, não sendo gerados relatórios ou gráficos com base em dados de anos anteriores.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">13. REAJUSTE ANUAL</h4>
              <p>O valor do plano contratado será reajustado automaticamente em 2,5% (dois e meio por cento) ao completar 1 (um) ano de cadastro do lojista no sistema NOOV, contado a partir da data de ativação da conta. O reajuste será aplicado anualmente nas mesmas condições, de forma cumulativa, e comunicado previamente ao lojista.</p>
            </section>

            <section>
              <h4 className="font-bold text-foreground">14. DISPOSIÇÕES GERAIS</h4>
              <p>O uso do sistema implica na aceitação integral destes termos. Em caso de discordância, o uso do serviço deve ser imediatamente interrompido.</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Terms;
