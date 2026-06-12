import { useGetFifaRankings, useGetPesRankings, useGetOverallRankings } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { RankingTable } from '@/components/RankingTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy } from 'lucide-react';

export default function Rankings() {
  const { t } = useLanguage();
  
  const { data: fifaRankings, isLoading: loadingFifa } = useGetFifaRankings();
  const { data: pesRankings, isLoading: loadingPes } = useGetPesRankings();
  const { data: overallRankings, isLoading: loadingOverall } = useGetOverallRankings();

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
        <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto mb-8 bg-muted/50 p-1">
          <TabsTrigger value="overall" className="font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">{t('overall')}</TabsTrigger>
          <TabsTrigger value="fifa" className="font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">{t('fifa')}</TabsTrigger>
          <TabsTrigger value="pes" className="font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">{t('pes')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overall" className="mt-0 focus-visible:outline-none">
          <RankingTable data={overallRankings || []} isLoading={loadingOverall} />
        </TabsContent>
        
        <TabsContent value="fifa" className="mt-0 focus-visible:outline-none">
          <RankingTable data={fifaRankings || []} isLoading={loadingFifa} />
        </TabsContent>
        
        <TabsContent value="pes" className="mt-0 focus-visible:outline-none">
          <RankingTable data={pesRankings || []} isLoading={loadingPes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
