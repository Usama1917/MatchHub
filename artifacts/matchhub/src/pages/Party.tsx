import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import {
  useGetParty,
  useListMatches,
  useCreateMatch,
  useCloseParty,
  useCancelMatch,
  Match,
  MatchInputGame,
  MatchInputMatchFormat,
} from '@workspace/api-client-react';
import { Link } from 'wouter';
import { copyToClipboard } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { MatchCard } from '@/components/MatchCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ChevronLeft, Copy, Check, Share2, Plus, RotateCcw, Clock, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function Party() {
  const { partyId } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const id = parseInt(partyId || '0', 10);
  const [copied, setCopied] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const { data: party, isLoading } = useGetParty(id, {
    query: { enabled: !!id, queryKey: ['party', id] },
  });
  const { data: matches } = useListMatches(
    { partyId: id },
    { query: { enabled: !!id, queryKey: ['matches', 'party', id] } },
  );
  const createMatchMut = useCreateMatch();
  const closeMut = useCloseParty();
  const cancelMatchMut = useCancelMatch();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>;
  }
  if (!party) {
    return <div className="p-8 text-center">{t('partyNotFound')}</div>;
  }

  const isCreator = currentUser?.id === party.createdBy;

  const handleCopy = async () => {
    const ok = await copyToClipboard(party.code);
    if (ok) {
      setCopied(true);
      toast({ title: t('copied') });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ variant: 'destructive', title: t('error'), description: t('copyFailed') });
    }
  };

  const handleShare = async () => {
    const shareData = { title: 'MatchHub', text: `${t('partyCode')}: ${party.code}` };
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* fall back to copy */
      }
    }
    handleCopy();
  };

  const handleClose = async () => {
    try {
      await closeMut.mutateAsync({ partyId: party.id });
      queryClient.invalidateQueries({ queryKey: ['party', id] });
      queryClient.invalidateQueries({ queryKey: ['activeParty'] });
      toast({ title: t('partyClosed') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('error'), description: e?.data?.error || e?.error || t('failed') });
    }
  };

  // A match that is still running blocks closing the party until it is either
  // cancelled or its result is submitted.
  const activeMatch = matches?.find((m) => m.status === 'in_progress');

  const handleCloseClick = () => {
    if (activeMatch) {
      setCloseDialogOpen(true);
    } else {
      handleClose();
    }
  };

  const handleCancelMatchAndClose = async () => {
    if (!activeMatch) return;
    try {
      await cancelMatchMut.mutateAsync({ matchId: activeMatch.id });
      queryClient.invalidateQueries({ queryKey: ['matches', 'party', id] });
      await closeMut.mutateAsync({ partyId: party.id });
      queryClient.invalidateQueries({ queryKey: ['party', id] });
      queryClient.invalidateQueries({ queryKey: ['activeParty'] });
      setCloseDialogOpen(false);
      toast({ title: t('matchCancelled') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('error'), description: e?.data?.error || e?.error || t('failed') });
    }
  };

  const handleRematch = async (m: Match) => {
    const teamA = m.players.filter((p) => p.team === 'team_a').map((p) => p.userId);
    const teamB = m.players.filter((p) => p.team === 'team_b').map((p) => p.userId);
    try {
      const newMatch = await createMatchMut.mutateAsync({
        data: {
          partyId: party.id,
          game: m.game as MatchInputGame,
          matchFormat: m.matchFormat as MatchInputMatchFormat,
          teamA,
          teamB,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['matches', 'party', id] });
      setLocation(`/matches/${newMatch.id}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || e?.error || 'Failed' });
    }
  };

  return (
    <div className="container max-w-screen-md mx-auto p-4 space-y-6 pb-24">
      <Button variant="ghost" onClick={() => setLocation('/')} className="mb-2 -ml-4">
        <ChevronLeft className="mr-2 h-4 w-4" />
        {t('back')}
      </Button>

      {/* Code + status */}
      <Card className="bg-card/50 border-primary/20">
        <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{t('partyCode')}</div>
          <div className="text-5xl font-black font-mono tracking-[0.3em] text-primary select-all">
            {party.code}
          </div>
          <Badge variant="secondary">{t(`party_${party.status}`)}</Badge>
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs pt-2">
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" /> {t('share')}
            </Button>
            <Button variant="outline" onClick={handleCopy}>
              {copied ? <Check className="mr-2 h-4 w-4 text-primary" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <div className="space-y-3">
        <h2 className="font-semibold">{t('members')} ({party.members.length})</h2>
        <div className="flex flex-wrap gap-2">
          {party.members.map((u) => (
            <Link key={u.id} href={`/profile/${u.id}`}>
              <Badge variant="outline" className="flex items-center gap-1 pl-1 py-1 cursor-pointer hover:border-primary/50">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">{u.displayName.substring(0, 2)}</AvatarFallback>
                </Avatar>
                {u.displayName}
                {u.id === party.createdBy && <span className="text-[10px] text-primary ml-1">★</span>}
              </Badge>
            </Link>
          ))}
        </div>

        {party.pendingInvites && party.pendingInvites.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground">{t('pendingInvites')}:</span>
            {party.pendingInvites.map((u) => (
              <Badge key={u.id} variant="secondary" className="flex items-center gap-1 py-1 opacity-70">
                <Clock className="h-3 w-3" />
                {u.displayName}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* New match (creator only) — needs at least 2 members */}
      {isCreator && party.status !== 'completed' && (
        <div className="space-y-2">
          <Button
            size="lg"
            className="w-full font-bold"
            disabled={party.members.length < 2}
            onClick={() => setLocation(`/parties/${party.id}/new-match`)}
          >
            <Plus className="mr-2 h-5 w-5" /> {t('newMatch')}
          </Button>
          {party.members.length < 2 && (
            <p className="text-center text-sm text-muted-foreground">{t('needMoreMembers')}</p>
          )}
        </div>
      )}

      {/* Matches */}
      <div className="space-y-3">
        <h2 className="font-semibold">{t('matchesInParty')}</h2>
        {matches && matches.length > 0 ? (
          <div className="space-y-4">
            {matches.map((m) => (
              <div key={m.id} className="space-y-2">
                <MatchCard match={m} />
                {isCreator && m.status === 'completed' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleRematch(m)}
                    disabled={createMatchMut.isPending}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> {t('rematch')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground p-6 border rounded-lg border-border/50">
            {isCreator ? t('startLater') : t('emptyState')}
          </div>
        )}
      </div>

      {/* Close party (creator only) */}
      {isCreator && party.status !== 'completed' && (
        <Button
          variant="ghost"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleCloseClick}
          disabled={closeMut.isPending}
        >
          {closeMut.isPending ? <Spinner className="mr-2" /> : <XCircle className="mr-2 h-4 w-4" />}
          {t('closeParty')}
        </Button>
      )}

      {/* Blocking choice when closing a party with a match still in progress */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('closePartyActiveMatchTitle')}</DialogTitle>
            <DialogDescription>{t('closePartyActiveMatchDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              className="w-full font-bold"
              onClick={() => {
                setCloseDialogOpen(false);
                if (activeMatch) setLocation(`/matches/${activeMatch.id}/result`);
              }}
            >
              {t('submitResult')}
            </Button>
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleCancelMatchAndClose}
              disabled={cancelMatchMut.isPending || closeMut.isPending}
            >
              {(cancelMatchMut.isPending || closeMut.isPending) && <Spinner className="mr-2" />}
              {t('cancelMatch')}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setCloseDialogOpen(false)}>
              {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
