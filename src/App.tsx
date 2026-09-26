import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Outlet, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import MaintenanceGate from "./components/MaintenanceGate.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import AdminLayout from "./components/admin/AdminLayout.tsx";
import AdminPanelLayout from "./components/admin/AdminPanelLayout.tsx";
import Dashboard from "./pages/admin/Dashboard.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminUserDetail from "./pages/admin/AdminUserDetail.tsx";
import AdminStores from "./pages/admin/AdminStores.tsx";
import AdminAffiliates from "./pages/admin/AdminAffiliates.tsx";
import AdminFinancial from "./pages/admin/AdminFinancial.tsx";
import AdminFinancialReport from "./pages/admin/AdminFinancialReport.tsx";
import AdminAffiliateDetail from "./pages/admin/AdminAffiliateDetail.tsx";
import AdminStoreDetail from "./pages/admin/AdminStoreDetail.tsx";
import AdminStoreOrders from "./pages/admin/AdminStoreOrders.tsx";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals.tsx";
import AdminPixSplit from "./pages/admin/AdminPixSplit.tsx";
import AdminMateriais from "./pages/admin/AdminMateriais.tsx";
import AdminMensagens from "./pages/admin/AdminMensagens.tsx";
import Profile from "./pages/admin/Profile.tsx";
import Orders from "./pages/admin/Orders.tsx";
import OrderDetail from "./pages/admin/OrderDetail.tsx";
import OrderHistory from "./pages/admin/OrderHistory.tsx";
import Reviews from "./pages/admin/Reviews.tsx";
import Products from "./pages/admin/Products.tsx";
import Clients from "./pages/admin/Clients.tsx";
import Coupons from "./pages/admin/Coupons.tsx";
import ClientDetail from "./pages/admin/ClientDetail.tsx";
import Deliveries from "./pages/admin/Deliveries.tsx";
import LojistaDeliveryHistory from "./pages/admin/DeliveryHistory.tsx";
import Financial from "./pages/admin/Financial.tsx";
import MotoboyDetail from "./pages/admin/MotoboyDetail.tsx";
import PosCounter from "./pages/admin/PosCounter.tsx";
import PosWaiter from "./pages/admin/PosWaiter.tsx";
import PdvMesas from "./pages/admin/PdvMesas.tsx";
import PdvMesaDetalhe from "./pages/admin/PdvMesaDetalhe.tsx";
import Kitchen from "./pages/admin/Kitchen.tsx";
import WaiterDashboard from "./pages/admin/WaiterDashboard.tsx";
import Settings from "./pages/admin/Settings.tsx";
import MeuPlano from "./pages/admin/MeuPlano.tsx";
import MinhaAssinatura from "./pages/admin/MinhaAssinatura.tsx";
import PagamentoConfirmacao from "./pages/admin/PagamentoConfirmacao.tsx";
import VendasSemana from "./pages/admin/VendasSemana.tsx";
import RelatorioEntregadores from "./pages/admin/RelatorioEntregadores.tsx";
import Relatorios from "./pages/admin/Relatorios.tsx";
import PizzariaManager from "./pages/admin/pizzaria/PizzariaManager.tsx";
import AdminSettings from "./pages/admin/AdminSettings.tsx";
import AdminAvaliacoes from "./pages/admin/AdminAvaliacoes.tsx";
import PrinterTutorial from "./pages/admin/PrinterTutorial.tsx";
import WaiterComandasPage from "./pages/admin/WaiterComandasPage.tsx";
import AdminTickets from "./pages/admin/AdminTickets.tsx";
import SystemMetrics from "./pages/admin/SystemMetrics.tsx";
import ErrorLogs from "./pages/admin/ErrorLogs.tsx";
import Consultor from "./pages/admin/Consultor.tsx";
import ClientMenu from "./pages/ClientMenu.tsx";
import MobileComanda from "./pages/MobileComanda.tsx";
import Support from "./pages/admin/Support.tsx";
import StoreMenu from "./pages/StoreMenu.tsx";
import RegisterStore from "./pages/RegisterStore.tsx";
import Affiliates from "./pages/Affiliates.tsx";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import AffiliateDashboard from "./pages/affiliate/AffiliateDashboard.tsx";
import AffiliateLayout from "./components/affiliate/AffiliateLayout.tsx";
import AffiliateReferrals from "./pages/affiliate/AffiliateReferrals.tsx";
import AffiliateReferralDetail from "./pages/affiliate/AffiliateReferralDetail.tsx";
import AffiliateFinancial from "./pages/affiliate/AffiliateFinancial.tsx";
import AffiliateLink from "./pages/affiliate/AffiliateLink.tsx";
import AffiliateMarketing from "./pages/affiliate/AffiliateMarketing.tsx";
import AffiliateSettings from "./pages/affiliate/AffiliateSettings.tsx";
import AffiliateConfirmation from "./pages/affiliate/AffiliateConfirmation.tsx";
import AffiliateLogin from "./pages/affiliate/AffiliateLogin.tsx";

import DeliveryDashboard from "./pages/delivery/DeliveryDashboard.tsx";
import DeliveryHistory from "./pages/delivery/DeliveryHistory.tsx";
import DeliveryMapFullscreen from "./pages/delivery/DeliveryMapFullscreen.tsx";
import LojistaLogin from "./pages/lojista/LojistaLogin.tsx";
import LojistaConfirmation from "./pages/lojista/LojistaConfirmation.tsx";
import PinSelection from "./pages/lojista/PinSelection.tsx";
import EntregadorLogin from "./pages/entregador/EntregadorLogin.tsx";
import AdminLogin from "./pages/admin/AdminLogin.tsx";
import { PdvUserProvider } from "./contexts/PdvUserContext.tsx";
import PinGate from "./components/admin/PinGate.tsx";

import DemoSelection from "./pages/demo/DemoSelection.tsx";
import DemoDashboard from "./pages/demo/DemoDashboard.tsx";
import DemoProducts from "./pages/demo/DemoProducts.tsx";
import DemoOrders from "./pages/demo/DemoOrders.tsx";
import DemoDeliveries from "./pages/demo/DemoDeliveries.tsx";
import DemoFinancial from "./pages/demo/DemoFinancial.tsx";
import DemoSettings from "./pages/demo/DemoSettings.tsx";
import DemoClientMenu from "./pages/demo/DemoClientMenu.tsx";
import DemoLojistaLayout from "./components/demo/DemoLojistaLayout.tsx";
import { DemoProvider } from "./contexts/DemoContext.tsx";
import OrderTracking from "./pages/OrderTracking.tsx";
import { AppDownloadPopup } from "./components/AppDownloadPopup";

const queryClient = new QueryClient();

import { useOnlineTracking } from "./hooks/useOnlineTracking";
import { useEffect } from "react";
import { bluetoothPrintService, getBluetoothSettings } from "./utils/bluetoothPrint";

const OnlineTracker = () => {
  useOnlineTracking();
  return null;
};

const BluetoothAutoReconnect = () => {
  useEffect(() => {
    const tryReconnect = () => {
      const s = getBluetoothSettings();
      if (!s.deviceId && !s.deviceName) return;
      if (bluetoothPrintService.isConnected()) return;
      bluetoothPrintService.tryAutoReconnect().catch(() => {});
    };
    tryReconnect();
    const onVisible = () => {
      if (document.visibilityState === "visible") tryReconnect();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tryReconnect);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tryReconnect);
    };
  }, []);
  return null;
};

const App = () => {
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <PdvUserProvider>
          <OnlineTracker />
          <BluetoothAutoReconnect />
          <Toaster />
          <Sonner />
          <AppDownloadPopup />
          <MaintenanceGate>
            <Routes>
              <Route path="/manutencao" element={<Navigate to="/" replace />} />
              <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<RegisterStore />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/termos" element={<Terms />} />
            <Route path="/privacidade" element={<Privacy />} />
            <Route path="/cardapio" element={<ClientMenu />} />
            <Route path="/rastreio/:id" element={<OrderTracking />} />
            <Route path="/afiliados" element={<Affiliates />} />
            <Route path="/afiliado/confirmacao" element={<AffiliateConfirmation />} />
            <Route path="/afiliado/login" element={<AffiliateLogin />} />
            <Route path="/lojista/login" element={<LojistaLogin />} />
            <Route path="/lojista/confirmacao" element={<LojistaConfirmation />} />
            <Route
              path="/lojista/pin"
              element={
                <ProtectedRoute requiredRole="lojista">
                  <PinSelection />
                </ProtectedRoute>
              }
            />
            <Route path="/comanda/:slug" element={<MobileComanda />} />
            <Route path="/entregador/login" element={<EntregadorLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            
            <Route
              path="/afiliado"
              element={
                <ProtectedRoute requiredRole="afiliado">
                  <AffiliateLayout />
                </ProtectedRoute>
              }
            >
              <Route path="painel" element={<AffiliateDashboard />} />
              <Route path="indicados" element={<AffiliateReferrals />} />
              <Route path="indicados/:id" element={<AffiliateReferralDetail />} />
              <Route path="financeiro" element={<AffiliateFinancial />} />
              <Route path="link" element={<AffiliateLink />} />
              <Route path="marketing" element={<AffiliateMarketing />} />
              <Route path="configuracoes" element={<AffiliateSettings />} />
            </Route>
            <Route
              path="/lojista"
              element={
                <ProtectedRoute requiredRole="lojista">
                  <PinGate>
                    <AdminLayout />
                  </PinGate>
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="pedidos" element={<Orders />} />
              <Route 
                path="pedidos/historico" 
                element={
                  <ProtectedRoute requiredPermission="financeiro">
                    <OrderHistory />
                  </ProtectedRoute>
                } 
              />
              <Route path="pedidos/:id" element={<OrderDetail />} />
              <Route path="avaliacoes" element={<Reviews />} />
              <Route path="produtos" element={<Products />} />
              
              <Route path="clientes" element={<Clients />} />
              <Route path="cupons" element={<Navigate to="/lojista/configuracoes" replace />} />
              <Route path="clientes/:telefone" element={<ClientDetail />} />
              <Route path="entregas" element={<Deliveries />} />
              <Route path="relatorio-entregadores" element={<RelatorioEntregadores />} />
              <Route path="relatorios" element={<Relatorios />} />
              <Route path="vendas" element={<Relatorios activeTabDefault="vendas" />} />
              <Route path="relatorio-entregas" element={<Relatorios activeTabDefault="entregas" />} />
              <Route path="caixa" element={<Relatorios activeTabDefault="caixa" />} />
              <Route path="relatorio-clientes" element={<Relatorios activeTabDefault="clientes" />} />
              <Route path="mais-vendidos" element={<Relatorios activeTabDefault="mais-vendidos" />} />
              <Route path="relatorio-entregadores" element={<Relatorios activeTabDefault="entregador" />} />
              <Route path="entregas/historico" element={<LojistaDeliveryHistory />} />
              <Route path="financeiro" element={<Financial />} />
              <Route path="financeiro/motoboy/:entregadorId" element={<MotoboyDetail />} />
              <Route path="pdv-balcao" element={<PosCounter />} />
              <Route path="pdv-garcom" element={<PosWaiter />} />
              <Route path="pdv-mesas" element={<PdvMesas />} />
              <Route path="pdv-mesas/:mesaId" element={<PdvMesaDetalhe />} />
              <Route path="cozinha" element={<Kitchen />} />
              <Route path="comandas" element={<WaiterComandasPage />} />
              <Route path="garcons" element={<WaiterDashboard />} />
              <Route path="plano" element={<MeuPlano />} />
              <Route path="graficos-vendas" element={<VendasSemana />} />
              <Route path="assinatura" element={<MinhaAssinatura />} />
              <Route path="pagamento" element={<PagamentoConfirmacao />} />
              <Route path="configuracoes" element={<Settings />} />
              <Route path="configuracoes/impressora-tutorial" element={<PrinterTutorial />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="suporte" element={<Support />} />
              <Route path="consultor" element={<Consultor />} />
            </Route>
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPanelLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="lojas" element={<AdminStores />} />
              <Route path="lojas/:id" element={<AdminStoreDetail />} />
              <Route path="lojas/:id/pedidos" element={<AdminStoreOrders />} />
              <Route path="financeiro" element={<AdminFinancial />} />
              <Route path="financeiro/relatorio" element={<AdminFinancialReport />} />
              <Route path="configuracoes" element={<AdminSettings />} />
              <Route path="afiliados" element={<AdminAffiliates />} />
              <Route path="afiliados/:id" element={<AdminAffiliateDetail />} />
              <Route path="saques" element={<AdminWithdrawals />} />
              <Route path="pix-split" element={<AdminPixSplit />} />
              <Route path="materiais" element={<AdminMateriais />} />
              <Route path="mensagens" element={<AdminMensagens />} />
              <Route path="usuarios" element={<AdminUsers />} />
              <Route path="usuarios/:id" element={<AdminUserDetail />} />
              <Route path="perfil" element={<Profile />} />
               <Route path="avaliacoes" element={<AdminAvaliacoes />} />
              <Route path="tickets" element={<AdminTickets />} />
              <Route path="metricas" element={<SystemMetrics />} />
              <Route path="logs-erros" element={<ErrorLogs />} />
            </Route>
            <Route
              path="/entregador"
              element={
                <ProtectedRoute requiredRole="entregador">
                  <Outlet />
                </ProtectedRoute>
              }
            >
              <Route index element={<DeliveryDashboard />} />
              <Route path="historico" element={<DeliveryHistory />} />
              <Route path="mapa" element={<DeliveryMapFullscreen />} />
            </Route>
            <Route path="/entregas/*" element={<Navigate to="/entregador" replace />} />
            {/* Demo routes */}
            <Route path="/demo" element={<DemoSelection />} />
            <Route
              path="/demo/lojista"
              element={
                <DemoProvider demoType="lojista">
                  <DemoLojistaLayout />
                </DemoProvider>
              }
            >
              <Route index element={<DemoDashboard />} />
              <Route path="pedidos" element={<DemoOrders />} />
              <Route path="produtos" element={<DemoProducts />} />
              <Route path="entregas" element={<DemoDeliveries />} />
              <Route path="financeiro" element={<DemoFinancial />} />
              <Route path="configuracoes" element={<DemoSettings />} />
            </Route>
            <Route
              path="/demo/cliente"
              element={
                <DemoProvider demoType="cliente">
                  <DemoClientMenu />
                </DemoProvider>
              }
            />
            <Route path="/:slug" element={<StoreMenu />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MaintenanceGate>
          </PdvUserProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
