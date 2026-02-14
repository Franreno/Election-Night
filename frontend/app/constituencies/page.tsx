"use client";

import { Suspense } from "react";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { ConstituenciesPageContent } from "./page-content";

export default function ConstituenciesPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} columns={3} />}>
      <ConstituenciesPageContent />
    </Suspense>
  );
}
