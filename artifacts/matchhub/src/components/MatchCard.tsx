import { format } from 'date-fns';
import { Match } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Users, Clock } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  onClick?: () => void;
  // When set, this user's team is always shown on the primary side
  // (the right side in the Arabic/RTL layout). Used on profile pages so the
  // profile owner stays on the same side regardless of which team they were on.
  perspectiveUserId?: number;
}

export function MatchCard({ match, onClick, perspectiveUserId }: MatchCardProps) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  // Player names link to their profile without triggering the card's match link.
  const goProfile = (e: React.MouseEvent, userId?: number) => {
    if (!userId) return;
    e.preventDefault();
    e.stopPropagation();
    setLocation(`/profile/${userId}`);
  };

  const teamA = match.players.filter((p) => p.team === 'team_a');
  const teamB = match.players.filter((p) => p.team === 'team_b');
  const spectators = match.players.filter((p) => p.isSpectator);

  // Orient the card around the perspective user: if they played on team B,
  // swap the two sides so they always sit on the primary (right in RTL) side.
  const flip =
    perspectiveUserId != null && teamB.some((p) => p.userId === perspectiveUserId);

  const firstTeam = flip ? teamB : teamA;
  const secondTeam = flip ? teamA : teamB;
  const firstKey: 'team_a' | 'team_b' = flip ? 'team_b' : 'team_a';
  const secondKey: 'team_a' | 'team_b' = flip ? 'team_a' : 'team_b';
  const firstScore = flip ? match.teamBScore : match.teamAScore;
  const secondScore = flip ? match.teamAScore : match.teamBScore;

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

        <div className="p-4 flex items-center justify-between rtl:flex-row-reverse">
          <div className="flex-1 flex flex-col space-y-2 rtl:text-right">
            {firstTeam.map((p) => (
              <div
                key={p.userId}
                onClick={(e) => goProfile(e, p.userId)}
                className={cn("text-sm truncate cursor-pointer hover:underline", getWinnerColor(firstKey))}
              >
                {p.user?.displayName}
              </div>
            ))}
          </div>

          <div className="px-6 flex flex-col items-center justify-center min-w-[100px]">
            {match.status === 'completed' ? (
              <div className="flex items-center space-x-3 rtl:space-x-reverse rtl:flex-row-reverse font-mono text-2xl font-black">
                <span className={getWinnerColor(firstKey)}>{firstScore}</span>
                <span className="text-muted-foreground/50">-</span>
                <span className={getWinnerColor(secondKey)}>{secondScore}</span>
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
            {secondTeam.map((p) => (
              <div
                key={p.userId}
                onClick={(e) => goProfile(e, p.userId)}
                className={cn("text-sm truncate cursor-pointer hover:underline", getWinnerColor(secondKey))}
              >
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

  return <Link href={`/matches/${match.id}`} className="block">{content}</Link>;
}
