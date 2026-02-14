"use client";

import { FileCheck2, FileX2, Files, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useUploadStats } from "@/hooks/use-upload-stats";

function StatItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`rounded-lg p-2 ${className}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function UploadStatsCard() {
  const { data, isLoading } = useUploadStats();

  if (isLoading || !data) {
    return null;
  }

  if (data.total_uploads === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-6 p-6 sm:grid-cols-4">
        <StatItem
          icon={Files}
          label="Total Uploads"
          value={data.total_uploads}
          className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatItem
          icon={FileCheck2}
          label="Completed"
          value={data.completed}
          className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatItem
          icon={FileX2}
          label="Failed"
          value={data.failed}
          className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        />
        <StatItem
          icon={TrendingUp}
          label="Success Rate"
          value={`${data.success_rate}%`}
          className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
        />
      </CardContent>
    </Card>
  );
}
