"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import type { RegionSummary } from "@/lib/types";

interface RegionFilterProps {
  regions: RegionSummary[];
  selectedRegionIds: Set<number>;
  onSelectedChange: (selected: Set<number>) => void;
}

export function RegionFilter({
  regions,
  selectedRegionIds,
  onSelectedChange,
}: RegionFilterProps) {
  const [open, setOpen] = useState(false);

  const allSelected = selectedRegionIds.size === regions.length;
  const selectedCount = selectedRegionIds.size;

  const handleSelectAll = () => {
    onSelectedChange(new Set(regions.map((r) => r.id)));
  };

  const handleClearAll = () => {
    // Keep at least one region selected
    if (regions.length > 0) {
      onSelectedChange(new Set([regions[0].id]));
    }
  };

  const toggleRegion = (regionId: number) => {
    const newSet = new Set(selectedRegionIds);
    if (newSet.has(regionId)) {
      // Don't allow deselecting the last region
      if (newSet.size > 1) {
        newSet.delete(regionId);
      }
    } else {
      newSet.add(regionId);
    }
    onSelectedChange(newSet);
  };

  const buttonLabel = allSelected
    ? "All Regions"
    : selectedCount === 1
      ? regions.find((r) => selectedRegionIds.has(r.id))?.name ?? "1 Region"
      : `${selectedCount} Regions`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full sm:w-[280px] justify-between"
        >
          <span className="truncate">{buttonLabel}</span>
          {!allSelected && selectedCount > 0 && (
            <Badge variant="secondary" className="ml-2 rounded-sm px-1">
              {selectedCount}
            </Badge>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {/* Select All / Clear All */}
              <div className="flex gap-1 p-2 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 flex-1 text-sm"
                  onClick={handleSelectAll}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 flex-1 text-sm"
                  onClick={handleClearAll}
                  disabled={selectedCount <= 1}
                >
                  Clear
                </Button>
              </div>

              {/* Region list */}
              {regions.map((region) => {
                const isSelected = selectedRegionIds.has(region.id);
                const isLastSelected =
                  isSelected && selectedRegionIds.size === 1;

                return (
                  <CommandItem
                    key={region.id}
                    onSelect={() => toggleRegion(region.id)}
                  >
                    <div className="flex items-center flex-1 gap-2">
                      <div className="flex h-4 w-4 items-center justify-center">
                        <Check
                          className={`h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`}
                        />
                      </div>
                      <span className="flex-1">{region.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {region.constituency_count}
                      </Badge>
                    </div>
                    {isLastSelected && (
                      <X className="h-3 w-3 ml-2 opacity-40" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
