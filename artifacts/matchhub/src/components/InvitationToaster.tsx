import { useEffect, useRef, useState } from 'react';
import {
  useListMyInvitations,
  useAcceptInvitation,
  useRejectInvitation,
  Invitation,
} from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

const MUTE_KEY = 'mh-invite-mute';
const MUTE_MS = 5 * 60 * 1000; // 5 minutes
const AUTO_REJECT_MS = 10 * 1000; // 10 seconds

function readMutes(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(MUTE_KEY) || '{}');
  } catch {
    return {};
  }
}

function muteSender(userId: number) {
  const mutes = readMutes();
  mutes[userId] = Date.now() + MUTE_MS;
  localStorage.setItem(MUTE_KEY, JSON.stringify(mutes));
}

function isMuted(userId: number): boolean {
  const mutes = readMutes();
  const until = mutes[userId];
  return typeof until === 'number' && until > Date.now();
}

export function InvitationToaster() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [resolved, setResolved] = useState<Set<number>>(new Set());

  const { data: invitations } = useListMyInvitations({
    query: {
      enabled: isAuthenticated,
      refetchInterval: 4000,
      queryKey: ['invitations'],
    },
  });

  const markResolved = (id: number) => {
    setResolved((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    queryClient.invalidateQueries({ queryKey: ['invitations'] });
    queryClient.invalidateQueries({ queryKey: ['activeParty'] });
  };

  if (!isAuthenticated) return null;

  const visible = (invitations ?? []).filter(
    (inv) => !resolved.has(inv.id) && !isMuted(inv.fromUser.id),
  );

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-20 left-4 z-[100] flex flex-col gap-3 w-[min(20rem,calc(100vw-2rem))]">
      {visible.map((inv) => (
        <InvitationCard key={inv.id} invitation={inv} onResolved={markResolved} />
      ))}
    </div>
  );
}

function InvitationCard({
  invitation,
  onResolved,
}: {
  invitation: Invitation;
  onResolved: (id: number) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const acceptMut = useAcceptInvitation();
  const rejectMut = useRejectInvitation();
  const queryClient = useQueryClient();

  const [progress, setProgress] = useState(100);
  const handledRef = useRef(false);

  const reject = () => {
    if (handledRef.current) return;
    handledRef.current = true;
    rejectMut.mutate({ invitationId: invitation.id });
    onResolved(invitation.id);
  };

  const accept = () => {
    if (handledRef.current) return;
    handledRef.current = true;
    acceptMut.mutate(
      { invitationId: invitation.id },
      {
        onSuccess: () => {
          toast({ title: t('invitationAccepted') });
          queryClient.invalidateQueries({ queryKey: ['party', invitation.partyId] });
        },
        onError: (e: any) => {
          toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || e?.error || 'Failed' });
        },
      },
    );
    onResolved(invitation.id);
  };

  const dnd = () => {
    if (handledRef.current) return;
    muteSender(invitation.fromUser.id);
    reject();
  };

  // 10-second countdown then auto-reject.
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / AUTO_REJECT_MS) * 100);
      setProgress(pct);
      if (elapsed >= AUTO_REJECT_MS) {
        clearInterval(interval);
        reject();
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border border-primary/30 bg-card shadow-2xl overflow-hidden animate-in slide-in-from-left-4 fade-in">
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {invitation.fromUser.displayName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm leading-tight">
            <span className="font-bold">{invitation.fromUser.displayName}</span>{' '}
            <span className="text-muted-foreground">{t('invitedYou')}</span>
            <div className="font-mono font-bold text-primary tracking-widest">#{invitation.partyCode}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-8" onClick={accept}>
            <Check className="mr-1 h-3.5 w-3.5" /> {t('accept')}
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-8" onClick={reject}>
            <X className="mr-1 h-3.5 w-3.5" /> {t('reject')}
          </Button>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" className="accent-primary" onChange={(e) => e.target.checked && dnd()} />
          {t('doNotDisturb')}
        </label>
      </div>

      {/* countdown bar */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-[width] duration-100 ease-linear" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
