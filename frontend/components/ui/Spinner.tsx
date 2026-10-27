import { cn } from "@/lib/utils";

export default function Spinner({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "w-4 h-4 border-2", md: "w-6 h-6 border-2", lg: "w-10 h-10 border-[3px]" };
  return (
    <div
      className={cn(
        "rounded-full border-blue-200 border-t-blue-600 animate-spin",
        sizes[size],
        className
      )}
    />
  );
}
