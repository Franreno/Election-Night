"use client";

import { FileDropzone } from "@/components/upload/file-dropzone";
import { UploadHistoryTable } from "@/components/upload/upload-history-table";
import { Separator } from "@/components/ui/separator";

export default function UploadPage() {
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

      <div>
        <h3 className="text-lg font-semibold">Upload History</h3>
        <div className="mt-4">
          <UploadHistoryTable />
        </div>
      </div>
    </div>
  );
}
