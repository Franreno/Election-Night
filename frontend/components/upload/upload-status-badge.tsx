import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  processing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

interface UploadStatusBadgeProps {
  status: string;
}

export function UploadStatusBadge({ status }: UploadStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(statusStyles[status] || "text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}
