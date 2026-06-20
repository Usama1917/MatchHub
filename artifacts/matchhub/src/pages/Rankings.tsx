import { useState } from 'react';
import {
  useGetFifaRankings,
  useGetPesRankings,
  useListMyGroups,
  useCreateGroup,
  useJoinGroup,
  useGetGroupRankings,
  useGetGroupMatches,
  useLeaveGroup,
  useEndGroup,
  useListFriends,
  useListUsers,
  User,
  Group,
} from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { RankingTable } from '@/components/RankingTable';
import { MatchCard } from '@/components/MatchCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trophy, Plus, Search, Check, X, LogOut, Users, Info, Copy, KeyRound, XCircle, AlertCircle } from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function Rankings() {
  const { t } = useLanguage();

  const { data: fifa, isLoading: lf } = useGetFifaRankings();
  const { data: pes, isLoading: lp } = useGetPesRankings();

  return (
    <div className="container p-4 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-center space-x-3 rtl:space-x-reverse">
        <Trophy className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('rankings')}</h1>
          <p className="text-muted-foreground">The best of the best.</p>
        </div>
      </div>

      <Tabs defaultValue="overall" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8 bg-muted/50 p-1">
          <TabsTrigger value="overall" className="font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">{t('overall')}</TabsTrigger>
          <TabsTrigger value="private" className="font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">{t('privateRank')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overall" className="mt-0 space-y-8 focus-visible:outline-none">
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight">{t('pes')}</h2>
            <RankingTable data={pes || []} isLoading={lp} />
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight">{t('fifa')}</h2>
            <RankingTable data={fifa || []} isLoading={lf} />
          </section>
        </TabsContent>

        <TabsContent value="private" className="mt-0 focus-visible:outline-none">
          <PrivateRanks />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PrivateRanks() {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: groups,
    error: groupsError,
    isError: hasGroupsError,
    isFetching: isFetchingGroups,
    isLoading,
    refetch: refetchGroups,
  } = useListMyGroups({
    query: { queryKey: ['myGroups'], retry: false },
    request: { timeoutMs: 12_000 },
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const leaveMut = useLeaveGroup();
  const endMut = useEndGroup();

  // Validate the persisted selection against the live list: if the selected
  // group was left/ended/removed, fall back to the first available group so the
  // panel never dangles on a dead id (which would also fire 403 rankings calls).
  const activeId =
    selectedId != null && groups?.some((g) => g.id === selectedId)
      ? selectedId
      : groups?.[0]?.id ?? null;
  const {
    data: rankings,
    error: rankingsError,
    isError: hasRankingsError,
    isFetching: isFetchingRankings,
    isLoading: loadingRankings,
    refetch: refetchRankings,
  } = useGetGroupRankings(activeId ?? 0, {
    query: { enabled: activeId !== null, queryKey: ['groupRankings', activeId], retry: false },
    request: { timeoutMs: 12_000 },
  });
  const { data: groupMatches, isLoading: loadingGroupMatches } = useGetGroupMatches(
    activeId ?? 0,
    {
      query: { enabled: activeId !== null, queryKey: ['groupMatches', activeId], retry: false },
      request: { timeoutMs: 12_000 },
    },
  );
  const activeGroup = groups?.find((g) => g.id === activeId);
  const isCreator = activeGroup?.createdBy === currentUser?.id;

  const handleLeave = async (id: number) => {
    try {
      await leaveMut.mutateAsync({ groupId: id });
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['myGroups'] });
      queryClient.removeQueries({ queryKey: ['groupRankings', id] });
      toast({ title: t('leftGroup') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('error'), description: e?.data?.error || e?.error || t('failed') });
    }
  };

  const handleEnd = async (id: number) => {
    try {
      await endMut.mutateAsync({ groupId: id });
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['myGroups'] });
      queryClient.invalidateQueries({ queryKey: ['groupRankings', id] });
      toast({ title: t('privateRankEnded') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('error'), description: e?.data?.error || e?.error || t('failed') });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setJoinOpen(true)}>
          <KeyRound className="mr-2 h-4 w-4" /> {t('joinPrivateRank')}
        </Button>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> {t('createPrivateRank')}
        </Button>
      </div>

      {hasGroupsError ? (
        <PrivateRankErrorState
          title={t('privateRanksLoadError')}
          description={getApiErrorMessage(groupsError, t('privateRanksLoadError'))}
          isRetrying={isFetchingGroups}
          onRetry={() => refetchGroups()}
        />
      ) : !groups || groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-lg border border-border/50">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{t('noGroups')}</p>
        </div>
      ) : (
        <>
          {/* group selector */}
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedId(g.id)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-colors border',
                  g.id === activeId
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground',
                )}
              >
                {g.name}
              </button>
            ))}
          </div>

          {activeGroup && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{activeGroup.members.length} {t('members')}</span>
                  {isCreator && activeGroup.code && <PrivateRankCodeInfo code={activeGroup.code} />}
                </div>
                {isCreator ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={endMut.isPending}
                      >
                        {endMut.isPending ? <Spinner className="mr-2" /> : <XCircle className="mr-2 h-4 w-4" />}
                        {t('endPrivateRank')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('endPrivateRankTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('endPrivateRankDescription')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleEnd(activeGroup.id)}
                        >
                          {t('endPrivateRank')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleLeave(activeGroup.id)}
                    disabled={leaveMut.isPending}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> {t('leave')}
                  </Button>
                )}
              </div>

              <Tabs defaultValue="rank" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-sm bg-muted/50 p-1">
                  <TabsTrigger value="rank" className="font-bold data-[state=active]:bg-background data-[state=active]:text-primary">{t('rankTab')}</TabsTrigger>
                  <TabsTrigger value="history" className="font-bold data-[state=active]:bg-background data-[state=active]:text-primary">{t('matchHistoryTab')}</TabsTrigger>
                </TabsList>

                <TabsContent value="rank" className="mt-6 focus-visible:outline-none">
                  {hasRankingsError ? (
                    <PrivateRankErrorState
                      title={t('privateRankingsLoadError')}
                      description={getApiErrorMessage(rankingsError, t('privateRankingsLoadError'))}
                      isRetrying={isFetchingRankings}
                      onRetry={() => refetchRankings()}
                    />
                  ) : (
                    <div className={cn('space-y-8', isFetchingRankings && !loadingRankings && 'opacity-60 transition-opacity')}>
                      <section className="space-y-3">
                        <h2 className="text-xl font-bold tracking-tight">{t('pes')}</h2>
                        <RankingTable data={rankings?.pes || []} isLoading={loadingRankings} />
                      </section>
                      <section className="space-y-3">
                        <h2 className="text-xl font-bold tracking-tight">{t('fifa')}</h2>
                        <RankingTable data={rankings?.fifa || []} isLoading={loadingRankings} />
                      </section>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="mt-6 focus-visible:outline-none">
                  {loadingGroupMatches ? (
                    <div className="flex justify-center p-8"><Spinner /></div>
                  ) : groupMatches && groupMatches.length > 0 ? (
                    <div className="space-y-4">
                      {groupMatches.map((m) => (
                        <MatchCard key={m.id} match={m} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-lg border border-border/50">
                      <Trophy className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">{t('emptyState')}</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </>
      )}

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(group) => {
          // Seed the cache synchronously so the new group's chip, member count,
          // and (for the creator) the share code render immediately instead of
          // blanking until the async refetch lands.
          queryClient.setQueryData<Group[]>(['myGroups'], (prev) => [
            group,
            ...(prev ?? []).filter((g) => g.id !== group.id),
          ]);
          setSelectedId(group.id);
          queryClient.invalidateQueries({ queryKey: ['myGroups'] });
          setCreateOpen(false);
        }}
      />

      <JoinGroupDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        onJoined={(group) => {
          queryClient.setQueryData<Group[]>(['myGroups'], (prev) => [
            group,
            ...(prev ?? []).filter((g) => g.id !== group.id),
          ]);
          setSelectedId(group.id);
          queryClient.invalidateQueries({ queryKey: ['myGroups'] });
          setJoinOpen(false);
        }}
      />
    </div>
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as { data?: { error?: string }; error?: string; message?: string };
  return apiError?.data?.error || apiError?.error || apiError?.message || fallback;
}

function PrivateRankErrorState({
  title,
  description,
  isRetrying,
  onRetry,
}: {
  title: string;
  description: string;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium text-destructive">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
        {isRetrying && <Spinner className="mr-2" />}
        {t('tryAgain')}
      </Button>
    </div>
  );
}

function PrivateRankCodeInfo({ code }: { code: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      toast({ title: t('copied') });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ variant: 'destructive', title: t('error'), description: t('copyFailed') });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <Info className="h-4 w-4" />
          <span className="sr-only">{t('privateRankCode')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-medium">{t('privateRankCode')}</div>
          <div className="text-xs text-muted-foreground">{t('sharePrivateRankCode')}</div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
          <span className="font-mono text-xl font-bold tracking-[0.25em] text-primary">{code}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={copyCode}>
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            <span className="sr-only">{t('copy')}</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function JoinGroupDialog({
  open,
  onOpenChange,
  onJoined,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined: (group: Group) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const joinMut = useJoinGroup();

  const submit = async () => {
    try {
      const group = await joinMut.mutateAsync({ data: { code: code.trim() } });
      setCode('');
      toast({ title: t('joinedPrivateRank') });
      onJoined(group);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: e?.data?.error || e?.error || t('privateRankNotFound'),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('joinPrivateRank')}</DialogTitle>
          <DialogDescription>{t('joinPrivateRankHint')}</DialogDescription>
        </DialogHeader>
        <Input
          placeholder={t('enterPrivateRankCode')}
          value={code}
          inputMode="numeric"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="h-14 text-center font-mono text-2xl tracking-[0.3em]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={submit} disabled={!code.trim() || joinMut.isPending}>
            {joinMut.isPending && <Spinner className="mr-2" />}
            {t('join')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (group: Group) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User[]>([]);

  const searchTerm = search.trim();
  const { data: friends } = useListFriends();
  const { data: results, isFetching: isFetchingUsers } = useListUsers(
    { search: searchTerm },
    { query: { enabled: searchTerm.length > 0, queryKey: ['users', searchTerm] } },
  );
  const createMut = useCreateGroup();
  const list = searchTerm ? results : friends;

  const toggle = (u: User) => {
    setSelected((prev) =>
      prev.find((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u],
    );
  };

  const submit = async () => {
    try {
      const group = await createMut.mutateAsync({
        data: { name: name.trim(), memberIds: selected.map((u) => u.id) },
      });
      setName('');
      setSelected([]);
      setSearch('');
      onCreated(group);
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('error'), description: e?.data?.error || e?.error || t('failed') });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createPrivateRank')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder={t('groupName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
            <Input
              placeholder={t('searchUsers')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rtl:pl-3 rtl:pr-9"
            />
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((u) => (
                <Badge key={u.id} variant="secondary" className="flex items-center gap-1">
                  {u.displayName}
                  <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => toggle(u)} />
                </Badge>
              ))}
            </div>
          )}

          <div className="bg-card rounded-lg border h-[220px] overflow-y-auto p-2 space-y-1">
            {list && list.length > 0 ? (
              list.map((u) => {
                const isSel = selected.some((s) => s.id === u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggle(u)}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors',
                      isSel ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{u.displayName.substring(0, 2)}</AvatarFallback></Avatar>
                      <div>
                        <div className="text-sm font-medium">{u.displayName}</div>
                        <div className="text-xs text-muted-foreground">@{u.username}</div>
                      </div>
                    </div>
                    {isSel && <Check className="h-4 w-4 text-primary" />}
                  </div>
                );
              })
            ) : searchTerm && isFetchingUsers ? (
              <div className="flex h-full items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {searchTerm ? t('noUsers') : t('noFriendsYet')}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={submit} disabled={!name.trim() || selected.length === 0 || createMut.isPending}>
            {createMut.isPending && <Spinner className="mr-2" />}
            {t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
