import {
  useGetMatch,
  useGetParty,
  useCreateMatch,
  MatchInputGame,
  MatchInputMatchFormat,
} from '@workspace/api-client-react';
import { Link, useLocation, useParams } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { MatchCard } from '@/components/MatchCard';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MatchDetail() {
  const { matchId } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const id = parseInt(matchId || '0', 10);
  const { data: match, isLoading } = useGetMatch(id, { query: { enabled: !!id, queryKey: ['match', id] } });
  const { data: party } = useGetParty(match?.partyId as number, {
    query: { enabled: !!match?.partyId, queryKey: ['party', match?.partyId] },
  });
  const createMatchMut = useCreateMatch();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!match) {
    return <div className="p-8 text-center">Match not found</div>;
  }

  const isOrganizer =
    currentUser?.id === match.createdBy || currentUser?.id === party?.createdBy;

  const handleRematch = async () => {
    const teamA = match.players.filter((p) => p.team === 'team_a').map((p) => p.userId);
    const teamB = match.players.filter((p) => p.team === 'team_b').map((p) => p.userId);
    try {
      const newMatch = await createMatchMut.mutateAsync({
        data: {
          partyId: match.partyId,
          game: match.game as MatchInputGame,
          matchFormat: match.matchFormat as MatchInputMatchFormat,
          teamA,
          teamB,
        },
      });
      setLocation(`/matches/${newMatch.id}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || e?.error || 'Failed' });
    }
  };

  return (
    <div className="container max-w-screen-md mx-auto p-4 space-y-6">
      <Button variant="ghost" onClick={() => window.history.back()} className="mb-2 -ml-4">
        <ChevronLeft className="mr-2 h-4 w-4" />
        {t('back')}
      </Button>

      <h1 className="text-2xl font-bold tracking-tight mb-6">Match Details</h1>

      <MatchCard match={match} />

      <div className="grid gap-4 mt-6">
        {party && (
          <Link href={`/parties/${party.id}`}>
            <Card className="bg-card/50 hover:border-primary/40 transition-colors cursor-pointer">
              <CardContent className="p-4 flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{t('partyCode')}</span>
                <span className="font-mono font-bold tracking-widest text-primary">{party.code}</span>
              </CardContent>
            </Card>
          </Link>
        )}

        <Card className="bg-card/50">
          <CardContent className="p-4 flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{t('status')}</span>
            <span className="font-medium capitalize">{match.status.replace('_', ' ')}</span>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{format(new Date(match.createdAt), 'PPpp')}</span>
          </CardContent>
        </Card>

        {match.status === 'in_progress' && (
          <div className="pt-6">
            <Button
              size="lg"
              className="w-full font-bold shadow-lg shadow-primary/20"
              onClick={() => setLocation(`/matches/${match.id}/result`)}
            >
              {t('submitResult')}
            </Button>
          </div>
        )}

        {match.status === 'completed' && isOrganizer && (
          <Button
            variant="outline"
            size="lg"
            className="w-full font-bold"
            onClick={handleRematch}
            disabled={createMatchMut.isPending}
          >
            {createMatchMut.isPending ? <Spinner className="mr-2" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            {t('rematch')}
          </Button>
        )}
      </div>
    </div>
  );
}
