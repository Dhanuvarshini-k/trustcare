import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "info" | "muted" | "purple";

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  danger:  "bg-red-50 text-red-700 border border-red-200",
  info:    "bg-blue-50 text-blue-700 border border-blue-200",
  muted:   "bg-slate-100 text-slate-500",
  purple:  "bg-purple-50 text-purple-700 border border-purple-200",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  size?: "sm" | "md";
}

export default function Badge({ children, variant = "default", className, size = "sm" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
