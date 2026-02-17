"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { deleteUploadStream } from "@/lib/api";
import type { DeleteProgress, DeleteSSEEvent } from "@/lib/types";

const MIN_ANIMATION_MS = 800;

export function useDeleteUpload() {
  const { mutate } = useSWRConfig();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DeleteProgress | null>(null);

  const revalidateAll = useCallback(async () => {
    await mutate(
      () => true,
      undefined,
      { revalidate: true },
    );
  }, [mutate]);

  const performDelete = async (uploadId: number) => {
    setIsDeleting(true);
    setError(null);
    setProgress({ stage: "deleting", percentage: 0 });

    const startTime = Date.now();

    try {
      await deleteUploadStream(uploadId, (event: DeleteSSEEvent) => {
        switch (event.event) {
          case "started":
            setProgress({
              stage: "rolling_back",
              percentage: 0,
              uploadId: event.upload_id,
            });
            break;
          case "progress":
            setProgress((prev) => ({
              ...prev,
              stage: "rolling_back",
              percentage: event.percentage,
            }));
            break;
          case "complete":
            setProgress({
              stage: "complete",
              percentage: 100,
              uploadId: event.upload_id,
            });
            break;
          case "error":
            setError(event.detail);
            setProgress({
              stage: "error",
              percentage: 0,
              uploadId: event.upload_id,
            });
            break;
        }
      });

      // Minimum animation delay
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_ANIMATION_MS) {
        await new Promise((r) => setTimeout(r, MIN_ANIMATION_MS - elapsed));
      }

      await revalidateAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
      setProgress(null);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  return { deleteUpload: performDelete, isDeleting, error, progress };
}
