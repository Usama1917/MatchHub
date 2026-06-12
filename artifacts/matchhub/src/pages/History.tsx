import { useState } from 'react';
import { useListMatches } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MatchCard } from '@/components/MatchCard';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gamepad2, FilterX } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

export default function History() {
  const { t } = useLanguage();
  const [game, setGame] = useState<'fifa' | 'pes' | undefined>(undefined);
  const [format, setFormat] = useState<'1v1' | '2v2' | '3v3' | undefined>(undefined);

  const { data: matches, isLoading } = useListMatches({
    game,
    matchFormat: format,
  });

  const clearFilters = () => {
    setGame(undefined);
    setFormat(undefined);
  };

  return (
    <div className="container p-4 max-w-screen-md mx-auto space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('history')}</h1>
        <p className="text-muted-foreground">A record of past battles.</p>
      </div>

      <div className="bg-card/50 border border-border/50 rounded-xl p-4 space-y-4 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <ToggleGroup type="single" value={game} onValueChange={(v: any) => setGame(v || undefined)}>
            <ToggleGroupItem value="fifa" aria-label="Toggle FIFA" className="font-bold">
              {t('fifa')}
            </ToggleGroupItem>
            <ToggleGroupItem value="pes" aria-label="Toggle PES" className="font-bold">
              {t('pes')}
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center space-x-2 rtl:space-x-reverse w-full sm:w-auto">
            <Select value={format || "all"} onValueChange={(v: any) => setFormat(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Formats</SelectItem>
                <SelectItem value="1v1">1v1</SelectItem>
                <SelectItem value="2v2">2v2</SelectItem>
                <SelectItem value="3v3">3v3</SelectItem>
              </SelectContent>
            </Select>
            
            {(game || format) && (
              <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear filters">
                <FilterX className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : matches && matches.length > 0 ? (
          matches.map(match => (
            <MatchCard key={match.id} match={match} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-card/30 border border-border/50 rounded-xl border-dashed">
            <Gamepad2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-foreground">{t('noMatches')}</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or play a match!</p>
          </div>
        )}
      </div>
    </div>
  );
}
