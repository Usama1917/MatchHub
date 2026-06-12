import { useGetDashboardStats } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Gamepad2, Trophy, Activity } from 'lucide-react';
import { MatchCard } from '@/components/MatchCard';
import { RankingTable } from '@/components/RankingTable';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { t } = useLanguage();
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading) {
    return (
      <div className="container p-4 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded"></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded-xl"></div>)}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-64 bg-muted rounded-xl"></div>
          <div className="h-64 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="container p-4 max-w-screen-2xl space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back to the arena.</p>
        </div>
        <Link href="/party/new">
          <Button size="lg" className="w-full md:w-auto font-bold shadow-lg shadow-primary/20">
            {t('createParty')}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('totalMatches')}</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMatches}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('totalUsers')}</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('totalParties')}</CardTitle>
            <Gamepad2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalParties}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Games Split</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium space-x-2 rtl:space-x-reverse">
              <span className="text-muted-foreground">FIFA: <span className="text-foreground">{stats.fifaMatches}</span></span>
              <span className="text-muted-foreground">PES: <span className="text-foreground">{stats.pesMatches}</span></span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">{t('recentMatches')}</h2>
            <Link href="/history" className="text-sm text-primary hover:underline font-medium">View all</Link>
          </div>
          {stats.recentMatches.length > 0 ? (
            <div className="space-y-4">
              {stats.recentMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <Card className="bg-card/50 border-border/50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Gamepad2 className="h-10 w-10 mb-4 opacity-20" />
                <p>{t('emptyState')}</p>
                <Link href="/party/new" className="mt-4">
                  <Button variant="outline" size="sm">{t('createParty')}</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">{t('topPlayers')}</h2>
            <Link href="/rankings" className="text-sm text-primary hover:underline font-medium">Full rankings</Link>
          </div>
          <RankingTable data={stats.topPlayers} isLoading={false} />
        </div>
      </div>
    </div>
  );
}
