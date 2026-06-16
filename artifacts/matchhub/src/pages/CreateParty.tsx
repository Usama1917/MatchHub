import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  useListUsers,
  useListFriends,
  useCreateParty,
  useGetMyActiveParty,
  useLookupPartyByCode,
  useJoinParty,
  User,
  Party,
} from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Check, X, Users, Copy, Share2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { useQueryClient } from '@tanstack/react-query';

type Mode = 'players' | 'party';

export default function CreateParty() {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<Mode>('players');
  const [search, setSearch] = useState('');
  const [code, setCode] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>(currentUser ? [currentUser] : []);
  const [createdParty, setCreatedParty] = useState<Party | null>(null);
  const [copied, setCopied] = useState(false);

  const searchTerm = search.trim();
  const trimmedCode = code.trim();

  // Default list = mutual follows; once the user types, search all users.
  const { data: friends, isLoading: loadingFriends } = useListFriends();
  const { data: searchResults, isLoading: loadingSearch } = useListUsers(
    { search: searchTerm },
    { query: { enabled: mode === 'players' && searchTerm.length > 0, queryKey: ['users', searchTerm] } },
  );
  const { data: foundParty, isLoading: loadingLookup, isError: lookupError } = useLookupPartyByCode(
    { code: trimmedCode },
    { query: { enabled: mode === 'party' && trimmedCode.length > 0, retry: false, queryKey: ['partyLookup', trimmedCode] } },
  );
  const { data: activeParty, isLoading: loadingActiveParty } = useGetMyActiveParty({
    query: { queryKey: ['activeParty'] },
  });

  const createMut = useCreateParty();
  const joinMut = useJoinParty();

  const list = searchTerm ? searchResults : friends;
  const loadingList = searchTerm ? loadingSearch : loadingFriends;

  const toggleUser = (user: User) => {
    if (selectedUsers.find((u) => u.id === user.id)) {
      if (user.id === currentUser?.id) return; // Can't remove self
      setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreate = async () => {
    try {
      const party = await createMut.mutateAsync({
        data: { memberIds: selectedUsers.map((u) => u.id) },
      });
      setCreatedParty(party);
      queryClient.setQueryData(['activeParty'], party);
      setStep(2);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || e?.error || 'Failed to create party' });
    }
  };

  const handleJoin = async () => {
    if (!foundParty) return;
    try {
      const party = await joinMut.mutateAsync({ partyId: foundParty.id });
      queryClient.setQueryData(['activeParty'], party);
      toast({ title: t('joined') });
      setLocation(`/parties/${foundParty.id}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || e?.error || 'Failed to join' });
    }
  };

  const handleCopy = async () => {
    if (!createdParty) return;
    try {
      await navigator.clipboard.writeText(createdParty.code);
      setCopied(true);
      toast({ title: t('copied') });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Copy failed' });
    }
  };

  const handleShare = async () => {
    if (!createdParty) return;
    const shareData = {
      title: 'MatchHub',
      text: `${t('partyCode')}: ${createdParty.code}`,
    };
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled or share unavailable — fall back to copy
      }
    }
    handleCopy();
  };

  // ---------------------------------------------------------------------------
  // Step 2: party created — reveal the code
  // ---------------------------------------------------------------------------
  if (step === 2 && createdParty) {
    return (
      <div className="container max-w-screen-md mx-auto p-4 space-y-8 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('createParty')}</h1>
          <div className="text-sm font-medium text-muted-foreground">Step 2 of 2</div>
        </div>

        <div className="flex space-x-2 rtl:space-x-reverse mb-6">
          <div className="h-2 flex-1 rounded-full bg-primary" />
          <div className="h-2 flex-1 rounded-full bg-primary" />
        </div>

        <Card className="bg-card/50 border-primary/20 shadow-lg">
          <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
            <div className="text-sm uppercase tracking-wider text-muted-foreground">{t('yourPartyCode')}</div>
            <div className="text-6xl font-black font-mono tracking-[0.3em] text-primary select-all">
              {createdParty.code}
            </div>
            <p className="text-sm text-muted-foreground">{t('shareCodeHint')}</p>
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm pt-2">
              <Button variant="outline" className="h-12" onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" /> {t('share')}
              </Button>
              <Button variant="outline" className="h-12" onClick={handleCopy}>
                {copied ? <Check className="mr-2 h-4 w-4 text-primary" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? t('copied') : t('copy')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" className="font-bold" onClick={() => setLocation(`/parties/${createdParty.id}`)}>
            {t('next')} <ChevronRight className="ml-2 h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 1: pick members (optional) OR join a party by code
  // ---------------------------------------------------------------------------
  return (
    <div className="container max-w-screen-md mx-auto p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('createParty')}</h1>
        <div className="text-sm font-medium text-muted-foreground">Step 1 of 2</div>
      </div>

      <div className="flex space-x-2 rtl:space-x-reverse mb-2">
        <div className="h-2 flex-1 rounded-full bg-primary" />
        <div className="h-2 flex-1 rounded-full bg-muted" />
      </div>

      {/* Search-mode toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-lg">
        {(['players', 'party'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'py-2 rounded-md text-sm font-medium transition-colors',
              mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'players' ? t('searchPlayers') : t('searchParty')}
          </button>
        ))}
      </div>

      {mode === 'players' ? (
        <div className="space-y-4 animate-in fade-in">
          <h2 className="text-xl font-semibold">{t('step1')}</h2>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
            <Input
              placeholder={t('searchUsers')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rtl:pl-3 rtl:pr-9"
            />
          </div>

          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {selectedUsers.map((u) => (
              <Badge key={u.id} variant="secondary" className="flex items-center gap-1 pl-1">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">{u.displayName.substring(0, 2)}</AvatarFallback>
                </Avatar>
                {u.displayName}
                {u.id !== currentUser?.id && (
                  <X className="h-3 w-3 ml-1 cursor-pointer hover:text-destructive" onClick={() => toggleUser(u)} />
                )}
              </Badge>
            ))}
          </div>

          <div className="bg-card rounded-lg border h-[300px] overflow-y-auto p-2 space-y-1">
            {loadingList ? (
              <div className="flex justify-center p-4"><Spinner /></div>
            ) : list && list.length > 0 ? (
              list.map((u) => {
                const isSelected = selectedUsers.some((su) => su.id === u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUser(u)}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{u.displayName.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{u.displayName}</div>
                        <div className="text-xs text-muted-foreground">@{u.username}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground p-4">
                {searchTerm ? t('noUsers') : t('noFriendsYet')}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? <Spinner className="mr-2" /> : <Users className="mr-2 h-4 w-4" />}
              {t('createPartyAction')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in">
          <h2 className="text-xl font-semibold">{t('joinParty')}</h2>

          <Input
            placeholder={t('enterPartyCode')}
            value={code}
            inputMode="numeric"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="text-center text-2xl font-mono tracking-[0.3em] h-16"
          />

          {trimmedCode.length > 0 && (
            <div className="min-h-[80px]">
              {loadingLookup ? (
                <div className="flex justify-center p-4"><Spinner /></div>
              ) : foundParty ? (
                <Card className="border-primary/30">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-lg">{foundParty.code}</div>
                      <div className="text-xs text-muted-foreground">
                        {foundParty.members.length} {t('members')} · {foundParty.creator?.displayName}
                      </div>
                    </div>
                    <Button onClick={handleJoin} disabled={joinMut.isPending}>
                      {joinMut.isPending && <Spinner className="mr-2" />}
                      {t('join')}
                    </Button>
                  </CardContent>
                </Card>
              ) : lookupError ? (
                <div className="text-center text-sm text-destructive p-4">{t('partyNotFound')}</div>
              ) : null}
            </div>
          )}
        </div>
      )}

      <ActivePartyPanel
        activeParty={activeParty}
        isLoading={loadingActiveParty}
        onOpen={(partyId) => setLocation(`/parties/${partyId}`)}
      />
    </div>
  );
}

function ActivePartyPanel({
  activeParty,
  isLoading,
  onOpen,
}: {
  activeParty?: Party | null;
  isLoading: boolean;
  onOpen: (partyId: number) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-3 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('myActiveParty')}</h2>
        {activeParty && (
          <Badge variant="secondary" className="text-xs">
            {t(`party_${activeParty.status}`)}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="flex items-center justify-center p-6">
            <Spinner />
          </CardContent>
        </Card>
      ) : activeParty ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpen(activeParty.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen(activeParty.id);
            }
          }}
          className="w-full cursor-pointer text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rtl:text-right"
        >
          <Card className="bg-card/50 border-primary/20 transition-colors hover:border-primary/50 hover:bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {t('partyCode')}
                    </span>
                    <span className="font-mono text-lg font-bold tracking-[0.2em] text-primary">
                      {activeParty.code}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {activeParty.members.length} {t('members')}
                    </span>
                    {activeParty.creator && <span>{activeParty.creator.displayName}</span>}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground rtl:rotate-180" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="bg-card/40 border-dashed border-border/70">
          <CardContent className="p-5 text-center text-sm text-muted-foreground">
            {t('noActiveParty')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
