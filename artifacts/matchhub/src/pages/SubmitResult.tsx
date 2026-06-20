import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useGetMatch, useSubmitMatchResult, MatchResultInputWinnerTeam, MatchResultInputWinType } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, ChevronLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function SubmitResult() {
  const { matchId } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const id = parseInt(matchId || '0', 10);
  const { data: match, isLoading } = useGetMatch(id, { query: { enabled: !!id, queryKey: ['match', id] } });
  const submitMut = useSubmitMatchResult();

  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(0);
  const [winner, setWinner] = useState<MatchResultInputWinnerTeam | null>(null);
  const [winType, setWinType] = useState<MatchResultInputWinType>('normal');
  const [showConfirm, setShowConfirm] = useState(false);

  // Auto-determine winner
  useEffect(() => {
    if (scoreA > scoreB) setWinner('team_a');
    else if (scoreB > scoreA) setWinner('team_b');
    else setWinner(null); // Draw not allowed in final result, must pick winner if scores equal (penalties)
  }, [scoreA, scoreB]);

  // Adjust winType if it's a draw
  useEffect(() => {
    if (scoreA === scoreB && winType === 'normal') {
      setWinType('penalties');
    }
  }, [scoreA, scoreB, winType]);

  // Redirect away from an already-completed match in an effect (never during render).
  useEffect(() => {
    if (match?.status === 'completed') {
      setLocation(`/matches/${match.id}`);
    }
  }, [match?.status, match?.id, setLocation]);

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>;
  if (!match) return <div>Not found</div>;
  if (match.status === 'completed') return null;

  const teamA = match.players.filter(p => p.team === 'team_a');
  const teamB = match.players.filter(p => p.team === 'team_b');

  const handleSubmit = async () => {
    if (!winner) {
      toast({ variant: 'destructive', title: 'Select Winner', description: 'Please select a winner for tied scores.' });
      return;
    }
    
    setShowConfirm(false);
    
    try {
      await submitMut.mutateAsync({
        matchId: id,
        data: {
          teamAScore: scoreA,
          teamBScore: scoreB,
          winnerTeam: winner!,
          winType
        }
      });
      
      // Refresh every view derived from match results across the app.
      queryClient.invalidateQueries({ queryKey: ['/api/stats/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/matches'] });
      queryClient.invalidateQueries({ queryKey: ['match', id] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['userMatches'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['activeParty'] });
      queryClient.invalidateQueries({ queryKey: ['party', match.partyId] });

      toast({ title: 'Result submitted successfully!' });
      setLocation(`/matches/${match.id}`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('error'), description: error?.data?.error || error?.error || 'Failed to submit' });
    }
  };

  return (
    <div className="container max-w-screen-md mx-auto p-4 space-y-8 pb-24">
      <Button variant="ghost" onClick={() => window.history.back()} className="mb-2 -ml-4">
        <ChevronLeft className="mr-2 h-4 w-4" />
        {t('back')}
      </Button>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{t('submitResult')}</h1>
        <p className="text-muted-foreground">{match.game.toUpperCase()} - {match.matchFormat}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 items-center">
        <div className="flex flex-col items-center space-y-4">
          <h3 className="font-bold text-lg text-primary text-center">
            {teamA.map(u => <div key={u.id}>{u.user?.displayName}</div>)}
          </h3>
          <div className="w-24">
            <Input 
              type="number" 
              min="0" 
              value={scoreA} 
              onChange={e => setScoreA(parseInt(e.target.value) || 0)}
              className="text-center text-4xl font-black h-20 bg-primary/10 border-primary/30"
            />
          </div>
        </div>

        <div className="text-center text-2xl font-black text-muted-foreground/30">VS</div>

        <div className="flex flex-col items-center space-y-4">
          <h3 className="font-bold text-lg text-destructive text-center">
            {teamB.map(u => <div key={u.id}>{u.user?.displayName}</div>)}
          </h3>
          <div className="w-24">
            <Input 
              type="number" 
              min="0" 
              value={scoreB} 
              onChange={e => setScoreB(parseInt(e.target.value) || 0)}
              className="text-center text-4xl font-black h-20 bg-destructive/10 border-destructive/30"
            />
          </div>
        </div>
      </div>

      <Card className="bg-card/50">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">{t('winner')}</label>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={winner === 'team_a' ? 'default' : 'outline'}
                className={cn("h-14 font-bold", winner === 'team_a' && "bg-primary text-primary-foreground hover:bg-primary/90")}
                onClick={() => setWinner('team_a')}
                disabled={scoreB > scoreA}
              >
                {t('teamA')}
              </Button>
              <Button
                variant={winner === 'team_b' ? 'default' : 'outline'}
                className={cn("h-14 font-bold", winner === 'team_b' && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                onClick={() => setWinner('team_b')}
                disabled={scoreA > scoreB}
              >
                {t('teamB')}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">{t('winType')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['normal', 'penalties', 'golden_goal'] as const).map(type => (
                <Button 
                  key={type}
                  variant={winType === type ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setWinType(type)}
                  className={cn(winType === type && "border-primary text-primary")}
                >
                  {t(type)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full font-bold h-14" onClick={() => setShowConfirm(true)} disabled={!winner}>
        {t('submitResult')}
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Result</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit this result? This action cannot be easily undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 flex items-center justify-center space-x-6 font-mono text-3xl font-black">
            <span className={winner === 'team_a' ? 'text-primary' : 'text-muted-foreground'}>{scoreA}</span>
            <span className="text-muted-foreground/30">-</span>
            <span className={winner === 'team_b' ? 'text-destructive' : 'text-muted-foreground'}>{scoreB}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>{t('cancel')}</Button>
            <Button onClick={handleSubmit} disabled={submitMut.isPending}>
              {submitMut.isPending && <Spinner className="mr-2" />}
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
