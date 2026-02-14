"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, FileWarning, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorDetailsProps {
  errors: Array<{ line: number; error: string }>;
}

interface ErrorCategory {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  iconClass: string;
  errors: Array<{ line: number; error: string }>;
  explanation: string;
}

function categorizeErrors(
  errors: Array<{ line: number; error: string }>,
): ErrorCategory[] {
  const constituencies: typeof errors = [];
  const parseErrors: typeof errors = [];
  const other: typeof errors = [];

  for (const err of errors) {
    if (err.error.includes("No matching constituency")) {
      constituencies.push(err);
    } else if (
      err.error.includes("Invalid") ||
      err.error.includes("Expected") ||
      err.error.includes("must be") ||
      err.error.includes("Duplicate") ||
      err.error.includes("Unknown party")
    ) {
      parseErrors.push(err);
    } else {
      other.push(err);
    }
  }

  const categories: ErrorCategory[] = [];

  if (constituencies.length > 0) {
    categories.push({
      label: "Constituency not found",
      icon: MapPin,
      badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      iconClass: "text-amber-600 dark:text-amber-400",
      errors: constituencies,
      explanation:
        "These constituency names could not be matched to any official 2024 constituency. Check for typos or abbreviations.",
    });
  }

  if (parseErrors.length > 0) {
    categories.push({
      label: "Format errors",
      icon: FileWarning,
      badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      iconClass: "text-red-600 dark:text-red-400",
      errors: parseErrors,
      explanation:
        "These lines have formatting issues. Expected format: constituency_name,votes,party_code,votes,party_code,...",
    });
  }

  if (other.length > 0) {
    categories.push({
      label: "Other errors",
      icon: AlertCircle,
      badgeClass: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      iconClass: "text-muted-foreground",
      errors: other,
      explanation: "Miscellaneous errors encountered during processing.",
    });
  }

  return categories;
}

export function ErrorDetails({ errors }: ErrorDetailsProps) {
  const categories = useMemo(() => categorizeErrors(errors), [errors]);

  if (errors.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 font-mono text-xs text-destructive hover:text-destructive"
        >
          <AlertCircle className="mr-1 h-3 w-3" />
          {errors.length} error{errors.length > 1 ? "s" : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Upload Errors
            <Badge variant="secondary" className="font-mono text-xs">
              {errors.length} total
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Category summary badges */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <div
                key={cat.label}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                  cat.badgeClass,
                )}
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}: {cat.errors.length}
              </div>
            ))}
          </div>

          {/* Category details */}
          {categories.map((cat) => (
            <div key={cat.label} className="space-y-2">
              <div className="flex items-center gap-2">
                <cat.icon className={cn("h-4 w-4", cat.iconClass)} />
                <h4 className="text-sm font-medium">{cat.label}</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                {cat.explanation}
              </p>
              <div className="rounded-md border bg-muted/30 divide-y divide-border">
                {cat.errors.map((err, i) => (
                  <div key={i} className="px-3 py-2 text-xs">
                    {err.line > 0 && (
                      <span className="mr-2 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        Line {err.line}
                      </span>
                    )}
                    <span className="text-foreground/90">{err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
