import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import {
  useGetParty,
  useCreateMatch,
  User,
  MatchInputGame,
  MatchInputMatchFormat,
} from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { ChevronLeft, ChevronRight, Gamepad2, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type Step = 1 | 2 | 3;

export default function NewMatch() {
  const { partyId } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();

  const id = parseInt(partyId || '0', 10);
  const { data: party, isLoading } = useGetParty(id, {
    query: { enabled: !!id, queryKey: ['party', id] },
  });
  const createMatchMut = useCreateMatch();

  // When launched from a completed match's "different players" action, the source
  // game + format are passed as query params so we skip straight to arranging
  // the new lineup (same kind of match, different competitors).
  const presetParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : '',
  );
  const rawGame = presetParams.get('game');
  const rawFormat = presetParams.get('format');
  const presetGame: MatchInputGame | null =
    rawGame === 'fifa' || rawGame === 'pes' ? rawGame : null;
  const presetFormat: MatchInputMatchFormat | null =
    rawFormat === '1v1' || rawFormat === '2v2' || rawFormat === '3v3' ? rawFormat : null;
  const hasPreset = presetGame !== null && presetFormat !== null;
  const presetSlots = presetFormat ? parseInt(presetFormat[0]) : 0;

  const [step, setStep] = useState<Step>(hasPreset ? 3 : 1);
  const [game, setGame] = useState<MatchInputGame | null>(presetGame);
  const [format, setFormat] = useState<MatchInputMatchFormat | null>(presetFormat);
  const [teamA, setTeamA] = useState<(User | null)[]>(
    hasPreset ? Array(presetSlots).fill(null) : [],
  );
  const [teamB, setTeamB] = useState<(User | null)[]>(
    hasPreset ? Array(presetSlots).fill(null) : [],
  );

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>;
  }
  if (!party) {
    return <div className="p-8 text-center">{t('partyNotFound')}</div>;
  }

  const members = party.members;
  const maxPerTeam = format ? parseInt(format[0]) : 0;

  const setupTeams = (f: MatchInputMatchFormat) => {
    const slots = parseInt(f[0]);
    setFormat(f);
    setTeamA(Array(slots).fill(null));
    setTeamB(Array(slots).fill(null));
  };

  const autoAssign = (user: User) => {
    if (teamA.find((u) => u?.id === user.id)) {
      setTeamA(teamA.map((u) => (u?.id === user.id ? null : u)));
      return;
    }
    if (teamB.find((u) => u?.id === user.id)) {
      setTeamB(teamB.map((u) => (u?.id === user.id ? null : u)));
      return;
    }
    const emptyA = teamA.findIndex((u) => u === null);
    if (emptyA !== -1) {
      const next = [...teamA];
      next[emptyA] = user;
      setTeamA(next);
      return;
    }
    const emptyB = teamB.findIndex((u) => u === null);
    if (emptyB !== -1) {
      const next = [...teamB];
      next[emptyB] = user;
      setTeamB(next);
    }
  };

  const removeFromTeam = (team: 'A' | 'B', index: number) => {
    if (team === 'A') {
      const next = [...teamA];
      next[index] = null;
      setTeamA(next);
    } else {
      const next = [...teamB];
      next[index] = null;
      setTeamB(next);
    }
  };

  const teamAFull = teamA.filter(Boolean).length === maxPerTeam;
  const teamBFull = teamB.filter(Boolean).length === maxPerTeam;
  const canStart = teamAFull && teamBFull && !!game && !!format;

  const handleStart = async () => {
    if (!game || !format) return;
    try {
      const match = await createMatchMut.mutateAsync({
        data: {
          partyId: party.id,
          game,
          matchFormat: format,
          teamA: teamA.map((u) => u!.id),
          teamB: teamB.map((u) => u!.id),
        },
      });
      toast({ title: t('startMatch') });
      setLocation(`/matches/${match.id}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || e?.error || 'Failed to start' });
    }
  };

  return (
    <div className="container max-w-screen-md mx-auto p-4 space-y-6 pb-24">
      <Button variant="ghost" onClick={() => setLocation(`/parties/${party.id}`)} className="mb-2 -ml-4">
        <ChevronLeft className="mr-2 h-4 w-4" />
        {t('back')}
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('newMatch')}</h1>
        <div className="text-sm font-medium text-muted-foreground">Step {step} of 3</div>
      </div>

      {/* Step 1: game */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in">
          <h2 className="text-xl font-semibold">{t('step2')}</h2>
          <div className="grid grid-cols-2 gap-4">
            {(['fifa', 'pes'] as const).map((g) => (
              <Card
                key={g}
                className={cn('cursor-pointer transition-all border-2', game === g ? 'border-primary bg-primary/5' : 'hover:border-primary/50')}
                onClick={() => setGame(g)}
              >
                <CardContent className="flex flex-col items-center justify-center p-8 h-40">
                  <Gamepad2 className={cn('h-12 w-12 mb-4', game === g ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="text-2xl font-bold tracking-wider">{g.toUpperCase()}</span>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setStep(2)} disabled={!game}>
              {t('next')} <ChevronRight className="ml-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: format */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in">
          <h2 className="text-xl font-semibold">{t('step3')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['1v1', '2v2', '3v3'] as const).map((f) => {
              const reqPlayers = parseInt(f[0]) * 2;
              const hasEnough = members.length >= reqPlayers;
              return (
                <Card
                  key={f}
                  className={cn(
                    'transition-all border-2',
                    !hasEnough ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50',
                    format === f ? 'border-primary bg-primary/5' : '',
                  )}
                  onClick={() => hasEnough && setupTeams(f)}
                >
                  <CardContent className="flex flex-col items-center justify-center p-6 h-32">
                    <Users className={cn('h-8 w-8 mb-2', format === f ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="text-xl font-bold">{f}</span>
                    {!hasEnough && <span className="text-xs text-destructive mt-1">{reqPlayers}+ {t('members')}</span>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>{t('back')}</Button>
            <Button onClick={() => setStep(3)} disabled={!format}>
              {t('next')} <ChevronRight className="ml-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: arrange teams */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in">
          <h2 className="text-xl font-semibold">{t('step4')}</h2>

          <div className="bg-muted/30 p-4 rounded-lg flex flex-wrap gap-2 items-center">
            {members.map((u) => {
              const isA = teamA.find((au) => au?.id === u.id);
              const isB = teamB.find((bu) => bu?.id === u.id);
              return (
                <Badge
                  key={u.id}
                  variant={isA ? 'default' : isB ? 'destructive' : 'outline'}
                  className="cursor-pointer py-1 px-3"
                  onClick={() => autoAssign(u)}
                >
                  {u.displayName}
                </Badge>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h3 className="font-bold text-center text-primary">{t('teamA')}</h3>
              {teamA.map((u, i) => (
                <div key={`a-${i}`} className="h-14 border-2 border-dashed rounded-lg border-primary/30 flex items-center justify-center bg-primary/5">
                  {u ? (
                    <div className="flex items-center justify-between w-full px-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8"><AvatarFallback>{u.displayName.substring(0, 2)}</AvatarFallback></Avatar>
                        <span className="font-medium">{u.displayName}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFromTeam('A', i)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-center text-destructive">{t('teamB')}</h3>
              {teamB.map((u, i) => (
                <div key={`b-${i}`} className="h-14 border-2 border-dashed rounded-lg border-destructive/30 flex items-center justify-center bg-destructive/5">
                  {u ? (
                    <div className="flex items-center justify-between w-full px-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8"><AvatarFallback>{u.displayName.substring(0, 2)}</AvatarFallback></Avatar>
                        <span className="font-medium">{u.displayName}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFromTeam('B', i)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>{t('back')}</Button>
            <Button size="lg" className="font-bold" onClick={handleStart} disabled={!canStart || createMatchMut.isPending}>
              {createMatchMut.isPending ? <Spinner className="mr-2" /> : <Gamepad2 className="mr-2 h-5 w-5" />}
              {t('startMatch')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
