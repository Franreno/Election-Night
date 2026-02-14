"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { deleteUpload } from "@/lib/api";

export function useDeleteUpload() {
  const { mutate } = useSWRConfig();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performDelete = async (uploadId: number) => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteUpload(uploadId);
      // Revalidate all SWR caches that start with "uploads"
      await mutate(
        (key: string) => typeof key === "string" && key.startsWith("uploads"),
        undefined,
        { revalidate: true },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  return { deleteUpload: performDelete, isDeleting, error };
}
