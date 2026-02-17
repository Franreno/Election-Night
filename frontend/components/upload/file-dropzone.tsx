"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUploadFile } from "@/hooks/use-upload-file";
import { cn } from "@/lib/utils";

export function FileDropzone() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { upload, isUploading, error, result, progress, reset } =
    useUploadFile();

  const handleFile = useCallback(
    async (file: File) => {
      reset();
      try {
        await upload(file);
      } catch {
        // error is set in hook
      }
    },
    [upload, reset],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/50",
        isUploading && "pointer-events-none opacity-70",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        onChange={handleInputChange}
        className="hidden"
      />

      {isUploading ? (
        progress?.stage === "processing" ? (
          <>
            <Progress
              value={progress.percentage}
              className="w-full max-w-xs h-2"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Processing... <span>{progress.percentage}%</span>
            </p>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Uploading...</p>
          </>
        )
      ) : result ? (
        <>
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="mt-3 text-sm font-medium text-emerald-400">
            Upload complete
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.processed_lines} lines processed, {result.error_lines}{" "}
            errors
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={reset}
          >
            Upload another file
          </Button>
        </>
      ) : error ? (
        <>
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={reset}
          >
            Try again
          </Button>
        </>
      ) : (
        <>
          <FileUp className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Drag & drop a results file here
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">or</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={handleBrowse}
          >
            Browse files
          </Button>
        </>
      )}
    </div>
  );
}
