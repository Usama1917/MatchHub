import { RankingEntry } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { Trophy } from 'lucide-react';

interface RankingTableProps {
  data: RankingEntry[];
  isLoading: boolean;
}

export function RankingTable({ data, isLoading }: RankingTableProps) {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="w-full space-y-4 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-muted/50 rounded-lg w-full" />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border/50">
        <Trophy className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">{t('emptyState')}</p>
      </div>
    );
  }

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <div className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center font-bold text-xs border border-yellow-500/50">1</div>;
      case 2:
        return <div className="w-6 h-6 rounded-full bg-slate-300/20 text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-300/50">2</div>;
      case 3:
        return <div className="w-6 h-6 rounded-full bg-amber-600/20 text-amber-600 flex items-center justify-center font-bold text-xs border border-amber-600/50">3</div>;
      default:
        return <div className="w-6 h-6 text-muted-foreground flex items-center justify-center font-medium text-xs">{rank}</div>;
    }
  };

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden bg-card/50">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right font-bold text-primary">PTS</TableHead>
            <TableHead className="text-right text-xs md:text-sm">P</TableHead>
            <TableHead className="text-right text-xs md:text-sm hidden sm:table-cell">W-L</TableHead>
            <TableHead className="text-right text-xs md:text-sm hidden md:table-cell">GD</TableHead>
            <TableHead className="text-right text-xs md:text-sm hidden lg:table-cell">Win %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((entry) => (
            <TableRow key={entry.userId} className="group transition-colors hover:bg-muted/50">
              <TableCell className="p-2 md:p-4 text-center">
                <div className="flex justify-center">{getRankBadge(entry.rank)}</div>
              </TableCell>
              <TableCell className="p-2 md:p-4">
                <Link href={`/profile/${entry.userId}`} className="flex items-center space-x-3 rtl:space-x-reverse group-hover:text-primary transition-colors">
                  <Avatar className="h-8 w-8 border border-border/50 hidden sm:flex">
                    <AvatarFallback className="bg-background text-xs">
                      {entry.displayName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-[200px]">{entry.displayName}</span>
                    <span className="text-[10px] text-muted-foreground hidden sm:inline-block">@{entry.username}</span>
                  </div>
                </Link>
              </TableCell>
              <TableCell className="p-2 md:p-4 text-right font-mono font-bold text-primary text-base">
                {entry.points}
              </TableCell>
              <TableCell className="p-2 md:p-4 text-right font-mono text-xs md:text-sm text-muted-foreground">
                {entry.matches}
              </TableCell>
              <TableCell className="p-2 md:p-4 text-right font-mono text-xs md:text-sm text-muted-foreground hidden sm:table-cell">
                <span className="text-green-500">{entry.wins}</span>-<span className="text-red-500">{entry.losses}</span>
              </TableCell>
              <TableCell className="p-2 md:p-4 text-right font-mono text-xs md:text-sm text-muted-foreground hidden md:table-cell">
                <span className={cn(entry.goalDifference > 0 ? "text-green-500" : entry.goalDifference < 0 ? "text-red-500" : "")}>
                  {entry.goalDifference > 0 ? '+' : ''}{entry.goalDifference}
                </span>
              </TableCell>
              <TableCell className="p-2 md:p-4 text-right font-mono text-xs md:text-sm text-muted-foreground hidden lg:table-cell">
                {Math.round(entry.winRate)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
