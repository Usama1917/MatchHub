import { useLocation, useParams } from 'wouter';
import { useGetUser, useGetUserMatches } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { MatchCard } from '@/components/MatchCard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { Trophy, Activity, Target, Hash } from 'lucide-react';

export default function Profile() {
  const { userId } = useParams();
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  
  // If no userId, use currentUser's ID
  const idToLoad = userId ? parseInt(userId, 10) : currentUser?.id;
  
  if (!userId && !currentUser) {
    setLocation('/login');
  }

  const { data: userProfile, isLoading: loadingProfile } = useGetUser(idToLoad as number, { 
    query: { enabled: !!idToLoad, queryKey: ['user', idToLoad] } 
  });
  
  const { data: fifaMatches, isLoading: loadingFifa } = useGetUserMatches(idToLoad as number, { game: 'fifa' }, {
    query: { enabled: !!idToLoad, queryKey: ['userMatches', idToLoad, 'fifa'] }
  });
  
  const { data: pesMatches, isLoading: loadingPes } = useGetUserMatches(idToLoad as number, { game: 'pes' }, {
    query: { enabled: !!idToLoad, queryKey: ['userMatches', idToLoad, 'pes'] }
  });

  if (loadingProfile || !userProfile) {
    return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>;
  }

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
        <StatBox title="Goal Diff" value={(userProfile.stats.goalDifference || 0) > 0 ? `+${userProfile.stats.goalDifference}` : userProfile.stats.goalDifference} icon={Target} colorClass="text-amber-500" />
      </div>

      <Tabs defaultValue="fifa" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="fifa" className="text-lg font-bold">{t('fifa')}</TabsTrigger>
          <TabsTrigger value="pes" className="text-lg font-bold">{t('pes')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="fifa" className="mt-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{userProfile.stats.fifaStats.points}</div><div className="text-xs text-muted-foreground">Points</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{Math.round(userProfile.stats.fifaStats.winRate)}%</div><div className="text-xs text-muted-foreground">Win Rate</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{userProfile.stats.fifaStats.wins}-{userProfile.stats.fifaStats.losses}</div><div className="text-xs text-muted-foreground">W-L</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{userProfile.stats.fifaStats.goalDifference}</div><div className="text-xs text-muted-foreground">Goal Diff</div></div>
          </div>
          
          <h3 className="font-bold text-xl mb-4">Match History</h3>
          {loadingFifa ? <Spinner /> : fifaMatches?.length ? fifaMatches.map(m => <MatchCard key={m.id} match={m} />) : <div className="text-muted-foreground text-center py-8">{t('emptyState')}</div>}
        </TabsContent>
        
        <TabsContent value="pes" className="mt-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{userProfile.stats.pesStats.points}</div><div className="text-xs text-muted-foreground">Points</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{Math.round(userProfile.stats.pesStats.winRate)}%</div><div className="text-xs text-muted-foreground">Win Rate</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{userProfile.stats.pesStats.wins}-{userProfile.stats.pesStats.losses}</div><div className="text-xs text-muted-foreground">W-L</div></div>
            <div className="p-4 bg-muted/20 rounded-lg text-center"><div className="text-xl font-bold">{userProfile.stats.pesStats.goalDifference}</div><div className="text-xs text-muted-foreground">Goal Diff</div></div>
          </div>
          
          <h3 className="font-bold text-xl mb-4">Match History</h3>
          {loadingPes ? <Spinner /> : pesMatches?.length ? pesMatches.map(m => <MatchCard key={m.id} match={m} />) : <div className="text-muted-foreground text-center py-8">{t('emptyState')}</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
