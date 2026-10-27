"use client";

import { usePathname } from "next/navigation";
import { Shield, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { checkHealth } from "@/lib/api";

const ROUTE_LABELS: Record<string, { title: string; sub: string }> = {
  "/dashboard": { title: "Patient Input", sub: "Enter clinical notes and cardiac parameters" },
  "/analyze":   { title: "Agent Pipeline", sub: "Live multi-agent execution monitor" },
  "/report":    { title: "Diagnostic Report", sub: "Evidence-based clinical output" },
};

export default function TopBar() {
  const pathname = usePathname();
  const meta = (pathname ? ROUTE_LABELS[pathname] : undefined) ?? { title: "TrustCare CDSS", sub: "" };
  const [apiStatus, setApiStatus] = useState<"ok" | "error" | "checking">("checking");

  useEffect(() => {
    checkHealth()
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("error"));
  }, []);

  return (
    <header className="shrink-0 flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shadow-sm z-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">{meta.title}</h1>
        {meta.sub && <p className="text-xs text-slate-500 mt-0.5">{meta.sub}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* API health indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          <Wifi className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">API:</span>
          {apiStatus === "checking" && <span className="text-slate-400">checking...</span>}
          {apiStatus === "ok"       && <span className="text-emerald-600 font-medium">Connected</span>}
          {apiStatus === "error"    && <span className="text-red-500 font-medium">Offline</span>}
        </div>

        {/* Disclaimer badge */}
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1 text-[11px] font-medium">
          <Shield className="w-3 h-3" />
          Research Prototype
        </div>
      </div>
    </header>
  );
}
