"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  FileText,
  HeartPulse,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Patient Input",    icon: LayoutDashboard },
  { href: "/analyze",   label: "Agent Pipeline",   icon: Activity },
  { href: "/report",    label: "Diagnostic Report", icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-slate-900 text-white overflow-y-auto scrollbar-thin">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600">
          <HeartPulse className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight tracking-wide">TrustCare</p>
          <p className="text-[10px] text-slate-400 leading-tight">CDSS Research Prototype</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
          Workflow
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }, idx) => {
          const active = pathname === href || (pathname?.startsWith(href + "/") ?? false);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <span className={cn(
                "flex items-center justify-center w-6 h-6 rounded text-xs font-bold mr-0.5",
                active ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-500"
              )}>
                {idx + 1}
              </span>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-700">
        <div className="flex items-center gap-2 text-slate-500">
          <FlaskConical className="w-3.5 h-3.5" />
          <p className="text-[10px] leading-tight">
            Research prototype only.<br />Not for clinical use.
          </p>
        </div>
      </div>
    </aside>
  );
}
