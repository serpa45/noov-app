import SupportTickets from "@/components/admin/SupportTickets";

const SupportPage = () => {
  return (
    <div className="space-y-6 pb-20 w-full max-w-7xl mx-auto px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Suporte ao Lojista</h2>
        <p className="text-sm text-muted-foreground">
          Abra um ticket ou acompanhe suas solicitações de suporte.
        </p>
      </div>

      <SupportTickets />
    </div>
  );
};

export default SupportPage;
