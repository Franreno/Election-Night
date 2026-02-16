"use client";

import { useRouter } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PartyBadge } from "@/components/shared/party-badge";
import type { ConstituencyResponse } from "@/lib/types";

const numberFormatter = new Intl.NumberFormat("en-GB");

export type SortField = "name" | "winning_party" | "total_votes";
export type SortDir = "asc" | "desc";

interface ConstituenciesTableProps {
  constituencies: ConstituencyResponse[];
  sortField: SortField | null;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}

function SortIcon({ field, active, dir }: { field: string; active: string | null; dir: SortDir }) {
  if (active !== field) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />;
  return dir === "asc"
    ? <ArrowUp className="ml-1 inline h-3 w-3" />
    : <ArrowDown className="ml-1 inline h-3 w-3" />;
}

export function ConstituenciesTable({
  constituencies,
  sortField,
  sortDir,
  onSort,
}: ConstituenciesTableProps) {
  const router = useRouter();

  const showGroupHeaders = sortField === "winning_party";

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => onSort("name")}
            >
              Constituency
              <SortIcon field="name" active={sortField} dir={sortDir} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => onSort("winning_party")}
            >
              Winning Party
              <SortIcon field="winning_party" active={sortField} dir={sortDir} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none text-right"
              onClick={() => onSort("total_votes")}
            >
              Total Votes
              <SortIcon field="total_votes" active={sortField} dir={sortDir} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {constituencies.map((c, i) => {
            const prevParty = i > 0 ? constituencies[i - 1].winning_party_code : null;
            const isNewGroup =
              showGroupHeaders && c.winning_party_code !== prevParty;

            return (
              <TableRow
                key={c.id}
                className={`cursor-pointer hover:bg-muted/50 ${isNewGroup && i > 0 ? "border-t-2 border-primary/30" : ""}`}
                onClick={() => router.push(`/constituencies/${c.id}`)}
              >
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  {c.winning_party_code ? (
                    <PartyBadge partyCode={c.winning_party_code} />
                  ) : (
                    <span className="text-muted-foreground">No Data</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {numberFormatter.format(c.total_votes)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
