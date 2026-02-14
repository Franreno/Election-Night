"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useUploads, type UploadFilters } from "@/hooks/use-uploads";
import { useDeleteUpload } from "@/hooks/use-delete-upload";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UploadStatusBadge } from "./upload-status-badge";
import { ErrorDetails } from "./error-details";
import { DeleteUploadDialog } from "./delete-upload-dialog";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import type { UploadLogEntry } from "@/lib/types";

type SortField = "filename" | "status" | "processed" | "errors" | "timestamp";
type SortDir = "asc" | "desc";

function SortIcon({ field, active, dir }: { field: string; active: string | null; dir: SortDir }) {
  if (active !== field) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />;
  return dir === "asc"
    ? <ArrowUp className="ml-1 inline h-3 w-3" />
    : <ArrowDown className="ml-1 inline h-3 w-3" />;
}

const STATUS_ORDER: Record<string, number> = {
  processing: 0,
  failed: 1,
  completed: 2,
};

function sortUploads(uploads: UploadLogEntry[], field: SortField, dir: SortDir): UploadLogEntry[] {
  const list = [...uploads];
  const d = dir === "asc" ? 1 : -1;

  list.sort((a, b) => {
    switch (field) {
      case "filename":
        return d * (a.filename || "").localeCompare(b.filename || "");
      case "status":
        return d * ((STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
      case "processed":
        return d * ((a.processed_lines ?? 0) - (b.processed_lines ?? 0));
      case "errors":
        return d * ((a.error_lines ?? 0) - (b.error_lines ?? 0));
      case "timestamp":
        return d * (a.started_at || "").localeCompare(b.started_at || "");
      default:
        return 0;
    }
  });

  return list;
}

interface UploadHistoryTableProps {
  filters?: UploadFilters;
}

export function UploadHistoryTable({ filters }: UploadHistoryTableProps) {
  const { data, isLoading, error } = useUploads(1, 20, filters);
  const { deleteUpload } = useDeleteUpload();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "timestamp" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    if (!data) return [];
    if (!sortField) return data.uploads;
    return sortUploads(data.uploads, sortField, sortDir);
  }, [data, sortField, sortDir]);

  const showGroupSeparator = sortField === "status";

  const handleDelete = async (uploadId: number) => {
    try {
      await deleteUpload(uploadId);
    } catch {
      // Error is handled in the hook
    }
  };

  if (isLoading) {
    return <TableSkeleton rows={3} columns={6} />;
  }

  if (error) {
    return (
      <EmptyState
        title="Upload history unavailable"
        description="Could not load upload history."
      />
    );
  }

  if (!data || data.uploads.length === 0) {
    return (
      <EmptyState
        title="No uploads yet"
        description="Upload a results file above to see the history."
      />
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort("filename")}
            >
              Filename
              <SortIcon field="filename" active={sortField} dir={sortDir} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort("status")}
            >
              Status
              <SortIcon field="status" active={sortField} dir={sortDir} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none text-right"
              onClick={() => toggleSort("processed")}
            >
              Processed
              <SortIcon field="processed" active={sortField} dir={sortDir} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none text-right"
              onClick={() => toggleSort("errors")}
            >
              Errors
              <SortIcon field="errors" active={sortField} dir={sortDir} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort("timestamp")}
            >
              Timestamp
              <SortIcon field="timestamp" active={sortField} dir={sortDir} />
            </TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((upload, i) => {
            const prevStatus = i > 0 ? sorted[i - 1].status : null;
            const isNewGroup = showGroupSeparator && upload.status !== prevStatus;

            return (
              <TableRow
                key={upload.id}
                className={isNewGroup && i > 0 ? "border-t-2 border-primary/30" : ""}
              >
                <TableCell className="font-medium">
                  {upload.filename || "—"}
                </TableCell>
                <TableCell>
                  <UploadStatusBadge status={upload.status} />
                </TableCell>
                <TableCell className="text-right font-mono">
                  {upload.processed_lines ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {upload.errors && upload.errors.length > 0 ? (
                    <ErrorDetails errors={upload.errors} />
                  ) : (
                    <span className="font-mono">{upload.error_lines ?? 0}</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {upload.started_at
                    ? new Date(upload.started_at).toLocaleString("en-GB")
                    : "—"}
                </TableCell>
                <TableCell>
                  <DeleteUploadDialog
                    uploadId={upload.id}
                    filename={upload.filename}
                    disabled={upload.status === "processing"}
                    onConfirm={handleDelete}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
