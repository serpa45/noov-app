import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BluetoothPrinterSettings from "./BluetoothPrinterSettings";
import PrintAgentCard from "./PrintAgentCard";

const PrinterSettings = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="pc" className="w-full">
        <TabsList className="inline-flex h-auto justify-start gap-6 bg-transparent p-0 mb-4 border-b border-border/50 rounded-none w-full">
          <TabsTrigger
            value="pc"
            className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground"
          >
            Impressora PC
          </TabsTrigger>
          <TabsTrigger
            value="bluetooth"
            className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground"
          >
            Mini Print Bluetooth
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pc" className="space-y-6 mt-0">
          <PrintAgentCard />
        </TabsContent>
        <TabsContent value="bluetooth" className="mt-0">
          <BluetoothPrinterSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PrinterSettings;
