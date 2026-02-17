"use client";

import { useState, useCallback } from "react";
import { uploadFileStream } from "@/lib/api";
import { mutate } from "swr";
import type { UploadResponse, UploadProgress, SSEEvent } from "@/lib/types";

const MIN_ANIMATION_MS = 800;

export function useUploadFile() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const revalidateAll = useCallback(() => {
    mutate(
      (key) =>
        typeof key === "string" &&
        (key.startsWith("uploads") ||
          key.startsWith("totals") ||
          key.startsWith("constituencies")),
      undefined,
      { revalidate: true },
    );
  }, []);

  const upload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setResult(null);
    setProgress({ stage: "uploading", percentage: 0 });

    const startTime = Date.now();

    try {
      await uploadFileStream(file, (event: SSEEvent) => {
        switch (event.event) {
          case "created":
            setProgress({
              stage: "processing",
              percentage: 0,
              uploadId: event.upload_id,
            });
            revalidateAll();
            break;
          case "progress":
            setProgress((prev) => ({
              ...prev!,
              stage: "processing",
              percentage: event.percentage,
            }));
            break;
          case "complete": {
            const uploadResult: UploadResponse = {
              upload_id: event.upload_id,
              status: event.status,
              total_lines: event.total_lines,
              processed_lines: event.processed_lines,
              error_lines: event.error_lines,
              errors: event.errors,
            };
            setResult(uploadResult);
            setProgress({
              stage: "complete",
              percentage: 100,
              uploadId: event.upload_id,
            });
            revalidateAll();
            break;
          }
          case "error":
            setError(event.detail);
            setProgress({ stage: "error", percentage: 0 });
            break;
        }
      });

      // Minimum animation: hold the progress bar briefly if processing was instant
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_ANIMATION_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_ANIMATION_MS - elapsed),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      setProgress(null);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setError(null);
    setResult(null);
    setProgress(null);
  };

  return { upload, isUploading, error, result, progress, reset };
}
