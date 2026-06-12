import { useGetMatch } from '@workspace/api-client-react';
import { useLocation, useParams } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { MatchCard } from '@/components/MatchCard';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { ChevronLeft } from 'lucide-react';

export default function MatchDetail() {
  const { matchId } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  
  const id = parseInt(matchId || '0', 10);
  const { data: match, isLoading } = useGetMatch(id, { query: { enabled: !!id, queryKey: ['match', id] } });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!match) {
    return <div className="p-8 text-center">Match not found</div>;
  }

  return (
    <div className="container max-w-screen-md mx-auto p-4 space-y-6">
      <Button variant="ghost" onClick={() => window.history.back()} className="mb-2 -ml-4">
        <ChevronLeft className="mr-2 h-4 w-4" />
        {t('back')}
      </Button>

      <h1 className="text-2xl font-bold tracking-tight mb-6">Match Details</h1>
      
      <MatchCard match={match} />
      
      <div className="grid gap-4 mt-6">
        <Card className="bg-card/50">
          <CardContent className="p-4 flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium capitalize">{match.status.replace('_', ' ')}</span>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50">
          <CardContent className="p-4 flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{format(new Date(match.createdAt), 'PPpp')}</span>
          </CardContent>
        </Card>

        {match.status === 'in_progress' && (
          <div className="pt-6">
            <Button 
              size="lg" 
              className="w-full font-bold shadow-lg shadow-primary/20"
              onClick={() => setLocation(`/matches/${match.id}/result`)}
            >
              {t('submitResult')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
