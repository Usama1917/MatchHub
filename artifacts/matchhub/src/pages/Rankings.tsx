import { useState } from 'react';
import {
  useGetFifaRankings,
  useGetPesRankings,
  useListMyGroups,
  useCreateGroup,
  useGetGroupRankings,
  useLeaveGroup,
  useListFriends,
  useListUsers,
  User,
} from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { RankingTable } from '@/components/RankingTable';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trophy, Plus, Search, Check, X, LogOut, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useListMyGroups({ query: { queryKey: ['myGroups'] } });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const leaveMut = useLeaveGroup();

  const activeId = selectedId ?? groups?.[0]?.id ?? null;
  const { data: rankings, isLoading: loadingRankings } = useGetGroupRankings(activeId as number, {
    query: { enabled: !!activeId, queryKey: ['groupRankings', activeId] },
  });
  const activeGroup = groups?.find((g) => g.id === activeId);

  const handleLeave = async (id: number) => {
    try {
      await leaveMut.mutateAsync({ groupId: id });
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['myGroups'] });
      toast({ title: t('leftGroup') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || e?.error || 'Failed' });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> {t('createPrivateRank')}
        </Button>
      </div>

      {!groups || groups.length === 0 ? (
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
                <div className="text-sm text-muted-foreground">
                  {activeGroup.members.length} {t('members')}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleLeave(activeGroup.id)}
                  disabled={leaveMut.isPending}
                >
                  <LogOut className="mr-2 h-4 w-4" /> {t('leave')}
                </Button>
              </div>

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
        </>
      )}

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          queryClient.invalidateQueries({ queryKey: ['myGroups'] });
          setSelectedId(id);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (groupId: number) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User[]>([]);

  const searchTerm = search.trim();
  const { data: friends } = useListFriends();
  const { data: results } = useListUsers(
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
      onCreated(group.id);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || e?.error || 'Failed' });
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
