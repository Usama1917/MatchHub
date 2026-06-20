import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import {
  useGetUser,
  useGetUserMatches,
  useFollowUser,
  useUnfollowUser,
  useCloseFriendUser,
  useUncloseFriendUser,
  useListFollowers,
  useListFollowing,
  useListUserGroups,
  getGetUserQueryKey,
} from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { MatchCard } from '@/components/MatchCard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trophy, Activity, Target, UserPlus, UserMinus, Heart } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// Format a goal difference with an explicit + sign for positive values.
const fmtGD = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function Profile() {
  const { userId } = useParams();
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();

  // If no userId, use currentUser's ID
  const idToLoad = userId ? parseInt(userId, 10) : currentUser?.id;

  // Redirect in an effect, never during render.
  useEffect(() => {
    if (!userId && !currentUser) {
      setLocation('/login');
    }
  }, [userId, currentUser, setLocation]);

  const { data: userProfile, isLoading: loadingProfile } = useGetUser(idToLoad as number, { 
    query: { enabled: !!idToLoad, queryKey: ['user', idToLoad] } 
  });
  
  const { data: fifaMatches, isLoading: loadingFifa } = useGetUserMatches(idToLoad as number, { game: 'fifa' }, {
    query: { enabled: !!idToLoad, queryKey: ['userMatches', idToLoad, 'fifa'] }
  });
  
  const { data: pesMatches, isLoading: loadingPes } = useGetUserMatches(idToLoad as number, { game: 'pes' }, {
    query: { enabled: !!idToLoad, queryKey: ['userMatches', idToLoad, 'pes'] }
  });

  const queryClient = useQueryClient();
  const [followDialog, setFollowDialog] = useState<'followers' | 'following' | null>(null);
  const followMut = useFollowUser();
  const unfollowMut = useUnfollowUser();
  const closeFriendMut = useCloseFriendUser();
  const uncloseFriendMut = useUncloseFriendUser();
  const { data: followersList } = useListFollowers(idToLoad as number, {
    query: { enabled: !!idToLoad && followDialog === 'followers', queryKey: ['followers', idToLoad] },
  });
  const { data: followingList } = useListFollowing(idToLoad as number, {
    query: { enabled: !!idToLoad && followDialog === 'following', queryKey: ['following', idToLoad] },
  });
  const { data: userGroups } = useListUserGroups(idToLoad as number, {
    query: { enabled: !!idToLoad, queryKey: ['userGroups', idToLoad] },
  });

  if (loadingProfile || !userProfile) {
    return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>;
  }

  const isOwnProfile = idToLoad === currentUser?.id;

  const toggleFollow = async () => {
    if (!idToLoad) return;
    try {
      if (userProfile.isFollowing) {
        await unfollowMut.mutateAsync({ userId: idToLoad });
      } else {
        await followMut.mutateAsync({ userId: idToLoad });
      }
      queryClient.invalidateQueries({ queryKey: ['user', idToLoad] });
    } catch {
      /* ignore */
    }
  };

  const toggleCloseFriend = async () => {
    if (!idToLoad) return;
    try {
      if (userProfile.isCloseFriend) {
        await uncloseFriendMut.mutateAsync({ userId: idToLoad });
      } else {
        await closeFriendMut.mutateAsync({ userId: idToLoad });
      }
      queryClient.invalidateQueries({ queryKey: ['user', idToLoad] });
    } catch {
      /* ignore */
    }
  };

  const dialogList = followDialog === 'followers' ? followersList : followingList;

  const medal = (pos: number) => (pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '🏅');

  const StatBox = ({ title, value, icon: Icon, colorClass }: any) => (
    <Card className="bg-card/40 border-border/50">
      <CardContent className="p-4 flex flex-col items-center justify-center text-center">
        <Icon className={`h-6 w-6 mb-2 ${colorClass}`} />
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</span>
      </CardContent>
    </Card>
  );

  return (
    <div className="container max-w-screen-xl mx-auto p-4 space-y-8 pb-24">
      <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-card/30 border border-border/50 rounded-2xl">
        <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
          <AvatarFallback className="text-3xl bg-primary/20 text-primary">
            {userProfile.displayName.substring(0,2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="text-center md:text-left rtl:md:text-right">
          <h1 className="text-3xl font-bold">{userProfile.displayName}</h1>
          <p className="text-muted-foreground text-lg">@{userProfile.username}</p>

          <div className="flex items-center justify-center md:justify-start gap-4 mt-3">
            <button
              onClick={() => setFollowDialog('followers')}
              className="text-sm hover:text-primary transition-colors"
            >
              <span className="font-bold">{userProfile.followerCount ?? 0}</span>{' '}
              <span className="text-muted-foreground">{t('followers')}</span>
            </button>
            <button
              onClick={() => setFollowDialog('following')}
              className="text-sm hover:text-primary transition-colors"
            >
              <span className="font-bold">{userProfile.followingCount ?? 0}</span>{' '}
              <span className="text-muted-foreground">{t('following')}</span>
            </button>

            {!isOwnProfile && (
              <Button
                size="sm"
                variant={userProfile.isFollowing ? 'outline' : 'default'}
                onClick={toggleFollow}
                disabled={followMut.isPending || unfollowMut.isPending}
              >
                {userProfile.isFollowing ? (
                  <><UserMinus className="mr-2 h-4 w-4" />{t('unfollow')}</>
                ) : (
                  <><UserPlus className="mr-2 h-4 w-4" />{t('follow')}</>
                )}
              </Button>
            )}

            {!isOwnProfile && (
              <Button
                size="sm"
                variant={userProfile.isCloseFriend ? 'default' : 'outline'}
                onClick={toggleCloseFriend}
                disabled={closeFriendMut.isPending || uncloseFriendMut.isPending}
                className={userProfile.isCloseFriend ? 'bg-pink-600 hover:bg-pink-700 text-white' : ''}
              >
                <Heart className={`mr-2 h-4 w-4 ${userProfile.isCloseFriend ? 'fill-current' : ''}`} />
                {t('closeFriend')}
              </Button>
            )}
          </div>

          {!isOwnProfile && (
            <p className="mt-2 text-xs text-muted-foreground max-w-md">{t('closeFriendHint')}</p>
          )}
        </div>
        <div className="md:ml-auto flex gap-4 text-center">
          <div>
            <div className="text-3xl font-black text-primary">{userProfile.stats.totalPoints}</div>
            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{t('points')}</div>
          </div>
          <div className="w-px bg-border/50"></div>
          <div>
            <div className="text-3xl font-black">{Math.round(userProfile.stats.winRate)}%</div>
            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{t('winRate')}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox title={t('matches')} value={userProfile.stats.totalMatches} icon={Activity} colorClass="text-blue-500" />
        <StatBox title="Wins" value={userProfile.stats.totalWins} icon={Trophy} colorClass="text-green-500" />
        <StatBox title="Losses" value={userProfile.stats.totalLosses} icon={Trophy} colorClass="text-red-500" />
        <StatBox title="Goal Diff" value={fmtGD(userProfile.stats.goalDifference || 0)} icon={Target} colorClass="text-amber-500" />
      </div>

      {userGroups && userGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">{t('privateRanks')}</h2>
          <div className="flex flex-wrap gap-3">
            {userGroups.map((g) => (
              <Link key={g.id} href="/rankings">
                <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className="text-2xl">{medal(g.position)}</span>
                    <div>
                      <div className="font-medium text-sm">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.position > 0 ? `#${g.position}` : t('notRanked')} · {g.memberCount} {t('members')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="pes" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="pes" className="text-lg font-bold">{t('pes')}</TabsTrigger>
          <TabsTrigger value="fifa" className="text-lg font-bold">{t('fifa')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="fifa" className="mt-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{userProfile.stats.fifaStats.points}</div><div className="text-xs text-muted-foreground">Points</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{Math.round(userProfile.stats.fifaStats.winRate)}%</div><div className="text-xs text-muted-foreground">Win Rate</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{userProfile.stats.fifaStats.wins}-{userProfile.stats.fifaStats.losses}</div><div className="text-xs text-muted-foreground">W-L</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{fmtGD(userProfile.stats.fifaStats.goalDifference || 0)}</div><div className="text-xs text-muted-foreground">Goal Diff</div></div>
          </div>
          
          <h3 className="font-bold text-xl mb-4">Match History</h3>
          {loadingFifa ? <Spinner /> : fifaMatches?.length ? fifaMatches.map(m => <MatchCard key={m.id} match={m} perspectiveUserId={idToLoad} />) : <div className="text-muted-foreground text-center py-8">{t('emptyState')}</div>}
        </TabsContent>
        
        <TabsContent value="pes" className="mt-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{userProfile.stats.pesStats.points}</div><div className="text-xs text-muted-foreground">Points</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{Math.round(userProfile.stats.pesStats.winRate)}%</div><div className="text-xs text-muted-foreground">Win Rate</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{userProfile.stats.pesStats.wins}-{userProfile.stats.pesStats.losses}</div><div className="text-xs text-muted-foreground">W-L</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{fmtGD(userProfile.stats.pesStats.goalDifference || 0)}</div><div className="text-xs text-muted-foreground">Goal Diff</div></div>
          </div>
          
          <h3 className="font-bold text-xl mb-4">Match History</h3>
          {loadingPes ? <Spinner /> : pesMatches?.length ? pesMatches.map(m => <MatchCard key={m.id} match={m} perspectiveUserId={idToLoad} />) : <div className="text-muted-foreground text-center py-8">{t('emptyState')}</div>}
        </TabsContent>
      </Tabs>

      <Dialog open={followDialog !== null} onOpenChange={(open) => !open && setFollowDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{followDialog === 'followers' ? t('followers') : t('following')}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-1">
            {dialogList && dialogList.length > 0 ? (
              dialogList.map((u) => (
                <Link
                  key={u.id}
                  href={`/profile/${u.id}`}
                  onClick={() => setFollowDialog(null)}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{u.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">{u.displayName}</div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                {followDialog === 'followers' ? t('noFollowers') : t('noFollowing')}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
