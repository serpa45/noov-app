
import { motion } from "framer-motion";
import { Shield } from "lucide-react";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background py-20 px-4">
      <div className="container max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="prose prose-slate max-w-none"
        >
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-extrabold font-display m-0">Política de Privacidade</h1>
          </div>
          
          <div className="space-y-6 text-foreground/80 leading-relaxed">
            <h3 className="font-bold text-foreground underline uppercase">POLÍTICA DE PRIVACIDADE – SISTEMA NOOV</h3>
            
            <section>
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
            </section>

            <section>
              <h4 className="font-bold text-foreground">2. FINALIDADE DO USO DOS DADOS</h4>
              <p>Os dados coletados são utilizados para:</p>
              <ul className="list-disc pl-5">
                <li>Permitir o funcionamento do sistema</li>
                <li>Gerenciar pedidos e cadastros</li>
                <li>Facilitar o contato entre lojista e cliente</li>
                <li>Melhorar a experiência do usuário</li>
                <li>Garantir segurança e prevenção a fraudes</li>
              </ul>
            </section>

            <section>
              <h4 className="font-bold text-foreground">3. BASE LEGAL (LGPD)</h4>
              <p>O tratamento de dados pessoais é realizado com base na Lei nº 13.709/2018 (LGPD), considerando:</p>
              <ul className="list-disc pl-5">
                <li>Execução de contrato</li>
                <li>Legítimo interesse</li>
                <li>Consentimento do titular, quando necessário</li>
              </ul>
            </section>

            <section>
              <h4 className="font-bold text-foreground">4. COMPARTILHAMENTO DE DADOS</h4>
              <p>O NOOV não comercializa dados pessoais. Os dados poderão ser compartilhados apenas quando necessário, como:</p>
              <ul className="list-disc pl-5">
                <li>Cumprimento de obrigações legais</li>
                <li>Requisição por autoridades públicas</li>
                <li>Serviços essenciais para funcionamento da plataforma (ex: hospedagem)</li>
              </ul>
            </section>

            <section>
              <h4 className="font-bold text-foreground">5. RESPONSABILIDADE DO LOJISTA</h4>
              <p>O lojista é responsável pelos dados inseridos no sistema, devendo:</p>
              <ul className="list-disc pl-5">
                <li>Garantir que possui autorização do cliente</li>
                <li>Utilizar os dados de forma adequada</li>
                <li>Cumprir a legislação vigente de proteção de dados</li>
              </ul>
            </section>

            <section>
              <h4 className="font-bold text-foreground">6. ARMAZENAMENTO E SEGURANÇA</h4>
              <p>Os dados são armazenados em ambiente seguro, com medidas técnicas e administrativas para proteção contra:</p>
              <ul className="list-disc pl-5">
                <li>Acesso não autorizado</li>
                <li>Vazamentos</li>
                <li>Alterações indevidas</li>
              </ul>
            </section>

            <section>
              <h4 className="font-bold text-foreground">7. RETENÇÃO E EXCLUSÃO DOS DADOS</h4>
              <ul className="list-disc pl-5">
                <li>Os dados serão mantidos enquanto o contrato estiver ativo</li>
                <li>Em caso de cancelamento, os dados serão armazenados por até 3 (três) meses</li>
                <li>Após esse período, serão permanentemente excluídos</li>
              </ul>
            </section>

            <section>
              <h4 className="font-bold text-foreground">8. DIREITOS DOS TITULARES DOS DADOS</h4>
              <p>Nos termos da LGPD, os titulares podem solicitar:</p>
              <ul className="list-disc pl-5">
                <li>Acesso aos dados</li>
                <li>Correção de dados incompletos ou desatualizados</li>
                <li>Exclusão de dados (quando aplicável)</li>
                <li>Revogação do consentimento</li>
              </ul>
            </section>

            <section>
              <h4 className="font-bold text-foreground">9. COOKIES E TECNOLOGIAS DE RASTREAMENTO</h4>
              <p>O sistema poderá utilizar cookies e tecnologias similares para:</p>
              <ul className="list-disc pl-5">
                <li>Melhorar a navegação</li>
                <li>Personalizar a experiência</li>
                <li>Coletar dados estatísticos</li>
              </ul>
            </section>

            <section>
              <h4 className="font-bold text-foreground">10. ALTERAÇÕES NESTA POLÍTICA</h4>
              <p>Esta Política poderá ser atualizada a qualquer momento. Recomenda-se a revisão periódica.</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Privacy;
