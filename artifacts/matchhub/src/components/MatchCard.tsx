import { format } from 'date-fns';
import { Match } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { Users, Clock } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  onClick?: () => void;
}

export function MatchCard({ match, onClick }: MatchCardProps) {
  const { t } = useLanguage();

  const teamA = match.players.filter((p) => p.team === 'team_a');
  const teamB = match.players.filter((p) => p.team === 'team_b');
  const spectators = match.players.filter((p) => p.isSpectator);

  const getWinnerColor = (team: 'team_a' | 'team_b') => {
    if (!match.winnerTeam) return 'text-muted-foreground';
    return match.winnerTeam === team ? 'text-primary font-bold' : 'text-muted-foreground';
  };

  const getStatusBadge = () => {
    switch (match.status) {
      case 'completed':
        return <Badge variant="secondary" className="bg-primary/20 text-primary hover:bg-primary/30">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="destructive" className="animate-pulse">Live</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const content = (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer overflow-hidden border-border/50 bg-card/50">
      <CardContent className="p-0">
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2 border-b border-border/50">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Badge variant="outline" className="font-mono">{match.game.toUpperCase()}</Badge>
            <span className="text-xs text-muted-foreground font-medium">{match.matchFormat}</span>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            {getStatusBadge()}
            {match.startedAt && (
              <span className="text-xs text-muted-foreground flex items-center">
                <Clock className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />
                {format(new Date(match.startedAt), 'MMM d, HH:mm')}
              </span>
            )}
          </div>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex-1 flex flex-col space-y-2">
            {teamA.map((p) => (
              <div key={p.userId} className={cn("text-sm truncate", getWinnerColor('team_a'))}>
                {p.user?.displayName}
              </div>
            ))}
          </div>

          <div className="px-6 flex flex-col items-center justify-center min-w-[100px]">
            {match.status === 'completed' ? (
              <div className="flex items-center space-x-3 rtl:space-x-reverse font-mono text-2xl font-black">
                <span className={getWinnerColor('team_a')}>{match.teamAScore}</span>
                <span className="text-muted-foreground/50">-</span>
                <span className={getWinnerColor('team_b')}>{match.teamBScore}</span>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm font-medium tracking-widest">VS</span>
            )}
            {match.winType && match.winType !== 'normal' && (
              <span className="text-[10px] text-accent mt-1 bg-accent/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {t(match.winType)}
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col space-y-2 text-right rtl:text-left">
            {teamB.map((p) => (
              <div key={p.userId} className={cn("text-sm truncate", getWinnerColor('team_b'))}>
                {p.user?.displayName}
              </div>
            ))}
          </div>
        </div>

        {spectators.length > 0 && (
          <div className="px-4 py-2 bg-muted/10 border-t border-border/30 flex items-center text-xs text-muted-foreground">
            <Users className="w-3 h-3 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
            <span className="truncate">
              {spectators.map((s) => s.user?.displayName).join(', ')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }

  return <Link href={`/matches/${match.id}`}>{content}</Link>;
}
