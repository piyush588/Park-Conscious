"use client";

import { useState, useEffect } from "react";
import { CameraScanner } from "./camera-scanner";
import { ScanHistory } from "./scan-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, History, Car } from "lucide-react";

export type ScanResult = {
  id: string;
  plateNumber: string;
  timestamp: string;
  confidence?: number;
};

export function ScannerLayout() {
  const [history, setHistory] = useState<ScanResult[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("plateseeker_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const addToHistory = (plate: string) => {
    const newEntry: ScanResult = {
      id: Math.random().toString(36).substr(2, 9),
      plateNumber: plate.toUpperCase(),
      timestamp: new Date().toISOString(),
    };
    const updated = [newEntry, ...history];
    setHistory(updated);
    localStorage.setItem("plateseeker_history", JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("plateseeker_history");
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <header className="p-4 flex items-center justify-between border-b bg-background/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-lg">
            <Car className="text-accent h-6 w-6" />
          </div>
          <h1 className="text-xl font-headline font-bold tracking-tight text-foreground">
            ParkConscious
          </h1>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        <Tabs defaultValue="scan" className="h-full flex flex-col">
          <TabsContent value="scan" className="flex-1 m-0 p-0 relative h-full">
            <CameraScanner onScan={addToHistory} />
          </TabsContent>
          
          <TabsContent value="history" className="flex-1 m-0 p-4 h-full overflow-y-auto">
            <ScanHistory history={history} onClear={clearHistory} />
          </TabsContent>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <TabsList className="bg-secondary/90 backdrop-blur-xl border border-white/5 h-14 p-1 rounded-full shadow-2xl">
              <TabsTrigger 
                value="scan" 
                className="rounded-full px-8 data-[state=active]:bg-primary data-[state=active]:text-accent gap-2"
              >
                <Camera className="h-4 w-4" />
                <span className="font-semibold">Scan</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="rounded-full px-8 data-[state=active]:bg-primary data-[state=active]:text-accent gap-2"
              >
                <History className="h-4 w-4" />
                <span className="font-semibold">Log</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </main>
    </div>
  );
}