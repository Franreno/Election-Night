"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorDetailsProps {
  errors: Array<{ line: number; error: string }>;
}

export function ErrorDetails({ errors }: ErrorDetailsProps) {
  const [open, setOpen] = useState(false);

  if (errors.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRight
          className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
        />
        {errors.length} error{errors.length > 1 ? "s" : ""}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 max-h-40 overflow-y-auto rounded border border-border bg-background p-2">
          {errors.map((err, i) => (
            <div key={i} className="py-1 text-xs">
              <span className="font-mono text-muted-foreground">
                Line {err.line}:
              </span>{" "}
              <span className="text-destructive">{err.error}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
