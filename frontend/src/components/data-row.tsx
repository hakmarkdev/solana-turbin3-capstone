import { cn } from "@/lib/utils";

export function DataRow({
  label,
  align = "center",
  children,
}: {
  label: string;
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4",
        align === "start" ? "items-start" : "items-center"
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
