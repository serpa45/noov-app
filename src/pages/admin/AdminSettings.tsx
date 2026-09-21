import AdminPlanManager from "@/components/admin/AdminPlanManager";
import AdminAjustes from "@/components/admin/AdminAjustes";
import AdminIntegracaoMercadoPago from "@/components/admin/AdminIntegracaoMercadoPago";
import AdminDownloads from "@/components/admin/AdminDownloads";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, SlidersHorizontal, Plug, Download } from "lucide-react";


const AdminSettings = () => {
  return (
    <div className="space-y-6 pb-20">
      <Tabs defaultValue="planos">
        <TabsList>
          <TabsTrigger value="planos" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Gerenciar Planos
          </TabsTrigger>
          <TabsTrigger value="ajustes" className="gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Ajustes
          </TabsTrigger>
          <TabsTrigger value="integracao" className="gap-2">
            <Plug className="w-4 h-4" />
            Integração
          </TabsTrigger>
          <TabsTrigger value="downloads" className="gap-2">
            <Download className="w-4 h-4" />
            Downloads
          </TabsTrigger>
        </TabsList>
        <TabsContent value="planos" className="mt-4">
          <AdminPlanManager />
        </TabsContent>
        <TabsContent value="ajustes" className="mt-4">
          <AdminAjustes />
        </TabsContent>
        <TabsContent value="integracao" className="mt-4">
          <AdminIntegracaoMercadoPago />
        </TabsContent>
        <TabsContent value="downloads" className="mt-4">
          <AdminDownloads />
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default AdminSettings;
