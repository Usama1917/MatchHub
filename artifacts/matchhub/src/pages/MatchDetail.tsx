import {
  useGetMatch,
  useGetParty,
  useCreateMatch,
  useCancelMatch,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ChevronLeft, RotateCcw, Users, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function MatchDetail() {
  const { matchId } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const id = parseInt(matchId || '0', 10);
  const { data: match, isLoading } = useGetMatch(id, { query: { enabled: !!id, queryKey: ['match', id] } });
  const { data: party } = useGetParty(match?.partyId as number, {
    query: { enabled: !!match?.partyId, queryKey: ['party', match?.partyId] },
  });
  const createMatchMut = useCreateMatch();
  const cancelMatchMut = useCancelMatch();

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

  const handleCancel = async () => {
    try {
      await cancelMatchMut.mutateAsync({ matchId: match.id });
      queryClient.invalidateQueries({ queryKey: ['matches', 'party', match.partyId] });
      queryClient.invalidateQueries({ queryKey: ['party', match.partyId] });
      queryClient.invalidateQueries({ queryKey: ['activeParty'] });
      toast({ title: t('matchCancelled') });
      setLocation(`/parties/${match.partyId}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('error'), description: e?.data?.error || e?.error || t('failed') });
    }
  };

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
      <Button
        variant="ghost"
        onClick={() => setLocation(match.partyId ? `/parties/${match.partyId}` : '/')}
        className="mb-2 -ml-4"
      >
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
          <div className="pt-6 space-y-3">
            <Button
              size="lg"
              className="w-full font-bold shadow-lg shadow-primary/20"
              onClick={() => setLocation(`/matches/${match.id}/result`)}
            >
              {t('submitResult')}
            </Button>

            {isOrganizer && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full font-bold text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={cancelMatchMut.isPending}
                  >
                    {cancelMatchMut.isPending ? <Spinner className="mr-2" /> : <XCircle className="mr-2 h-4 w-4" />}
                    {t('cancelMatch')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('cancelMatchTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('cancelMatchDesc')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleCancel}
                    >
                      {t('cancelMatch')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        {match.status === 'completed' && isOrganizer && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              className="font-bold"
              onClick={handleRematch}
              disabled={createMatchMut.isPending}
            >
              {createMatchMut.isPending ? <Spinner className="mr-2" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              {t('rematch')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="font-bold"
              onClick={() =>
                setLocation(
                  `/parties/${match.partyId}/new-match?game=${match.game}&format=${match.matchFormat}`,
                )
              }
            >
              <Users className="mr-2 h-4 w-4" />
              {t('newMatchDifferent')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
