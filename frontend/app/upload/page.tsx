"use client";

import { useState } from "react";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { UploadHistoryTable } from "@/components/upload/upload-history-table";
import { UploadFiltersBar } from "@/components/upload/upload-filters";
import { Separator } from "@/components/ui/separator";
import type { UploadFilters } from "@/hooks/use-uploads";

export default function UploadPage() {
  const [filters, setFilters] = useState<UploadFilters>({});

  return (
    <div>
      <h2 className="text-2xl font-semibold">Upload Results</h2>
      <p className="mt-2 text-muted-foreground">
        Upload election result files to process and store results.
      </p>

      <div className="mt-6">
        <FileDropzone />
      </div>

      <Separator className="my-8" />

      <div className="space-y-6">
        {/* <UploadStatsCard /> */}

        <div>
          <h3 className="text-lg font-semibold">Upload History</h3>
          <div className="mt-4 space-y-4">
            <UploadFiltersBar filters={filters} onFiltersChange={setFilters} />
            <UploadHistoryTable filters={filters} />
          </div>
        </div>
      </div>
    </div>
  );
}
