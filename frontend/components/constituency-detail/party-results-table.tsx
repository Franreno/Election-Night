import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PartyBadge } from "@/components/shared/party-badge";
import type { PartyResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-GB");

interface PartyResultsTableProps {
  parties: PartyResult[];
  winningPartyCode: string | null;
}

export function PartyResultsTable({ parties, winningPartyCode }: PartyResultsTableProps) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Party</TableHead>
            <TableHead className="text-right">Votes</TableHead>
            <TableHead className="text-right">Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parties.map((p) => (
            <TableRow
              key={p.party_code}
              className={cn(
                p.party_code === winningPartyCode && "bg-primary/10",
              )}
            >
              <TableCell>
                <PartyBadge partyCode={p.party_code} />
              </TableCell>
              <TableCell className="text-right font-mono">
                {numberFormatter.format(p.votes)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {p.percentage}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
