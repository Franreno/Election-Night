"use client";

import { useState } from "react";
import { uploadFile } from "@/lib/api";
import { mutate } from "swr";
import type { UploadResponse } from "@/lib/types";

export function useUploadFile() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);

  const upload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const response = await uploadFile(file);
      setResult(response);

      // Revalidate all SWR caches after successful upload
      mutate(
        (key) =>
          typeof key === "string" &&
          (key.startsWith("uploads") ||
            key.startsWith("totals") ||
            key.startsWith("constituencies")),
        undefined,
        { revalidate: true },
      );

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setError(null);
    setResult(null);
  };

  return { upload, isUploading, error, result, reset };
}
