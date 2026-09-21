import { Card, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";

const DemoSettings = () => (
  <div className="space-y-4">
    <h1 className="text-2xl font-bold font-display">Configurações</h1>
    <Card>
      <CardContent className="p-10 text-center">
        <Settings className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Configurações indisponíveis em modo demonstração</p>
        <p className="text-xs text-muted-foreground mt-1">Crie sua conta para personalizar tudo</p>
      </CardContent>
    </Card>
  </div>
);

export default DemoSettings;
