"use client";

import { useState } from "react";
import { type ScanResult } from "./scanner-layout";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Search, Car, Calendar, Info, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { summarizeScanHistory } from "@/ai/flows/summarize-scan-history";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ScanHistoryProps {
  history: ScanResult[];
  onClear: () => void;
}

export function ScanHistory({ history, onClear }: ScanHistoryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  const handleGenerateSummary = async () => {
    if (history.length === 0) return;
    setIsSummarizing(true);
    setIsSummaryOpen(true);
    try {
      const historyStr = history
        .map((h) => `${h.plateNumber} at ${format(new Date(h.timestamp), "yyyy-MM-dd HH:mm:ss")}`)
        .join("\n");
      const result = await summarizeScanHistory({ scanHistory: historyStr });
      setSummary(result.summary);
    } catch (e) {
      setSummary("Failed to generate summary. Please try again later.");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32">
      <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-4 px-2">
        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
          <h2 className="text-2xl font-bold text-foreground">Scan Log</h2>
          <p className="text-muted-foreground text-sm">
            {history.length} {history.length === 1 ? "record" : "records"} captured
          </p>
        </div>
        <div className="flex gap-2 animate-in fade-in slide-in-from-right-4 duration-500">
          {history.length > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGenerateSummary}
                className="bg-secondary/50 border-accent/20 hover:border-accent/50 transition-all hover:scale-105 active:scale-95"
              >
                <FileText className="h-4 w-4 mr-2 text-accent" />
                Analyze
              </Button>
              <Button variant="ghost" size="sm" onClick={onClear} className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-all">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 animate-in fade-in zoom-in duration-700">
          <div className="bg-secondary/50 p-8 rounded-full border border-white/5 shadow-inner">
            <Search className="h-14 w-14 text-muted-foreground animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">No scans yet</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">
              Start by pointing your camera at a vehicle in the Scan tab.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 px-2">
          {history.map((scan, index) => (
            <Card 
              key={scan.id} 
              className={`bg-card/40 border-white/5 hover:border-accent/30 hover:bg-card/60 transition-all duration-300 p-4 animate-in fade-in slide-in-from-bottom-8 fill-mode-both stagger-${(index % 3) + 1}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="bg-accent/10 p-4 rounded-xl border border-accent/20 group-hover:scale-110 transition-transform">
                    <Car className="text-accent h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-mono font-bold tracking-tight text-accent">
                      {scan.plateNumber}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.3 w-3.3" />
                      {format(new Date(scan.timestamp), "MMM d, yyyy • h:mm a")}
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20 px-3">
                  Verified
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <DialogContent className="bg-card border-accent/20 max-w-md animate-in zoom-in-95 duration-300">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-accent text-xl">
              <div className="p-2 bg-accent/10 rounded-lg">
                <div className="h-5 w-5 bg-accent/20 rounded flex items-center justify-center">
                  <div className="h-4 w-4 text-accent">
                    <Info className="h-4 w-4" />
                  </div>
                </div>
              </div>
              Intelligence Report
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/80">
              AI-driven insights from your vehicle scan history log.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-5 bg-black/40 rounded-2xl border border-white/5 min-h-[120px] text-sm leading-relaxed text-foreground/90 font-body shadow-inner">
            {isSummarizing ? (
              <div className="flex flex-col items-center justify-center h-28 gap-4">
                <Loader2 className="animate-spin h-8 w-8 text-accent" />
                <p className="text-xs text-muted-foreground tracking-widest uppercase">Analyzing patterns...</p>
              </div>
            ) : (
              <div className="whitespace-pre-wrap animate-in fade-in duration-700">{summary}</div>
            )}
          </div>
          <div className="flex justify-end mt-6">
            <Button variant="outline" onClick={() => setIsSummaryOpen(false)} className="border-accent/20 hover:bg-accent/10 hover:text-accent rounded-xl px-8 transition-all">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}