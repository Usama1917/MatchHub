import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useListUsers, useCreateParty, useCreateMatch } from '@workspace/api-client-react';
import { User, PartyInputGame, PartyInputMatchFormat } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, ChevronRight, ChevronLeft, Check, X, Gamepad2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';

type Step = 1 | 2 | 3 | 4 | 5;

export default function CreateParty() {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>(currentUser ? [currentUser] : []);
  const [game, setGame] = useState<PartyInputGame | null>(null);
  const [format, setFormat] = useState<PartyInputMatchFormat | null>(null);
  
  // Team arrangements
  const [teamA, setTeamA] = useState<(User | null)[]>([]);
  const [teamB, setTeamB] = useState<(User | null)[]>([]);

  const { data: users, isLoading: loadingUsers } = useListUsers({ search });
  const createPartyMut = useCreateParty();
  const createMatchMut = useCreateMatch();

  // Step 1: Select Members
  const toggleUser = (user: User) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      if (user.id === currentUser?.id) return; // Can't remove self
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  // Step 4 logic
  const maxPlayersPerTeam = format ? parseInt(format[0]) : 0;
  
  const setupTeams = () => {
    if (!format) return;
    const slots = parseInt(format[0]);
    setTeamA(Array(slots).fill(null));
    setTeamB(Array(slots).fill(null));
    setStep(4);
  };

  const assignPlayer = (user: User, team: 'A' | 'B', index: number) => {
    // Remove from other slots first
    const newTeamA = [...teamA].map(u => u?.id === user.id ? null : u);
    const newTeamB = [...teamB].map(u => u?.id === user.id ? null : u);
    
    if (team === 'A') {
      newTeamA[index] = user;
    } else {
      newTeamB[index] = user;
    }
    
    setTeamA(newTeamA);
    setTeamB(newTeamB);
  };

  const autoAssign = (user: User) => {
    // If already assigned, unassign
    if (teamA.find(u => u?.id === user.id)) {
      setTeamA(teamA.map(u => u?.id === user.id ? null : u));
      return;
    }
    if (teamB.find(u => u?.id === user.id)) {
      setTeamB(teamB.map(u => u?.id === user.id ? null : u));
      return;
    }

    // Find first empty slot
    const emptyA = teamA.findIndex(u => u === null);
    if (emptyA !== -1) {
      const newA = [...teamA];
      newA[emptyA] = user;
      setTeamA(newA);
      return;
    }
    
    const emptyB = teamB.findIndex(u => u === null);
    if (emptyB !== -1) {
      const newB = [...teamB];
      newB[emptyB] = user;
      setTeamB(newB);
      return;
    }
  };

  const assignedUsers = [...teamA, ...teamB].filter(Boolean) as User[];
  const spectators = selectedUsers.filter(u => !assignedUsers.find(au => au.id === u.id));
  
  const isTeamA_Full = teamA.filter(Boolean).length === maxPlayersPerTeam;
  const isTeamB_Full = teamB.filter(Boolean).length === maxPlayersPerTeam;
  const canProceedStep4 = isTeamA_Full && isTeamB_Full;

  const handleStart = async () => {
    if (!game || !format) return;
    
    try {
      const party = await createPartyMut.mutateAsync({
        data: {
          memberIds: selectedUsers.map(u => u.id),
          game,
          matchFormat: format
        }
      });
      
      const match = await createMatchMut.mutateAsync({
        data: {
          partyId: party.id,
          teamA: teamA.map(u => u!.id),
          teamB: teamB.map(u => u!.id)
        }
      });
      
      toast({ title: 'Match Started!' });
      setLocation(`/matches/${match.id}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.error || 'Failed to start' });
    }
  };

  return (
    <div className="container max-w-screen-md mx-auto p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('createParty')}</h1>
        <div className="text-sm font-medium text-muted-foreground">Step {step} of 5</div>
      </div>

      <div className="flex space-x-2 rtl:space-x-reverse mb-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={cn("h-2 flex-1 rounded-full", step >= i ? "bg-primary" : "bg-muted")} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-xl font-semibold">{t('step1')}</h2>
          
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
            <Input 
              placeholder={t('searchUsers')} 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rtl:pl-3 rtl:pr-9"
            />
          </div>

          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {selectedUsers.map(u => (
              <Badge key={u.id} variant="secondary" className="flex items-center gap-1 pl-1">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">{u.displayName.substring(0,2)}</AvatarFallback>
                </Avatar>
                {u.displayName}
                {u.id !== currentUser?.id && (
                  <X className="h-3 w-3 ml-1 cursor-pointer hover:text-destructive" onClick={() => toggleUser(u)} />
                )}
              </Badge>
            ))}
          </div>

          <div className="bg-card rounded-lg border h-[300px] overflow-y-auto p-2 space-y-1">
            {loadingUsers ? (
              <div className="flex justify-center p-4"><Spinner /></div>
            ) : users?.map(u => {
              const isSelected = selectedUsers.some(su => su.id === u.id);
              return (
                <div 
                  key={u.id}
                  onClick={() => toggleUser(u)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors",
                    isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{u.displayName.substring(0,2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">{u.displayName}</div>
                      <div className="text-xs text-muted-foreground">@{u.username}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setStep(2)} disabled={selectedUsers.length < 2}>
              {t('next')} <ChevronRight className="ml-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-xl font-semibold">{t('step2')}</h2>
          
          <div className="grid grid-cols-2 gap-4">
            {(['fifa', 'pes'] as const).map(g => (
              <Card 
                key={g}
                className={cn(
                  "cursor-pointer transition-all border-2",
                  game === g ? "border-primary bg-primary/5" : "hover:border-primary/50"
                )}
                onClick={() => setGame(g)}
              >
                <CardContent className="flex flex-col items-center justify-center p-8 h-40">
                  <Gamepad2 className={cn("h-12 w-12 mb-4", game === g ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-2xl font-bold tracking-wider">{g.toUpperCase()}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>{t('back')}</Button>
            <Button onClick={() => setStep(3)} disabled={!game}>
              {t('next')} <ChevronRight className="ml-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-xl font-semibold">{t('step3')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['1v1', '2v2', '3v3'] as const).map(f => {
              const reqPlayers = parseInt(f[0]) * 2;
              const hasEnough = selectedUsers.length >= reqPlayers;
              
              return (
                <Card 
                  key={f}
                  className={cn(
                    "transition-all border-2",
                    !hasEnough ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/50",
                    format === f ? "border-primary bg-primary/5" : ""
                  )}
                  onClick={() => hasEnough && setFormat(f)}
                >
                  <CardContent className="flex flex-col items-center justify-center p-6 h-32">
                    <Users className={cn("h-8 w-8 mb-2", format === f ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-xl font-bold">{f}</span>
                    {!hasEnough && <span className="text-xs text-destructive mt-1">Need {reqPlayers} players</span>}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>{t('back')}</Button>
            <Button onClick={setupTeams} disabled={!format}>
              {t('next')} <ChevronRight className="ml-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-xl font-semibold">{t('step4')}</h2>
          
          <div className="bg-muted/30 p-4 rounded-lg flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium mr-2">Click to auto-assign:</span>
            {selectedUsers.map(u => {
              const isA = teamA.find(au => au?.id === u.id);
              const isB = teamB.find(bu => bu?.id === u.id);
              return (
                <Badge 
                  key={u.id}
                  variant={isA ? "default" : isB ? "destructive" : "outline"}
                  className="cursor-pointer py-1 px-3"
                  onClick={() => autoAssign(u)}
                >
                  {u.displayName}
                </Badge>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h3 className="font-bold text-center text-primary">{t('teamA')}</h3>
              {teamA.map((u, i) => (
                <div key={`a-${i}`} className="h-14 border-2 border-dashed rounded-lg border-primary/30 flex items-center justify-center bg-primary/5">
                  {u ? (
                    <div className="flex items-center justify-between w-full px-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8"><AvatarFallback>{u.displayName.substring(0,2)}</AvatarFallback></Avatar>
                        <span className="font-medium">{u.displayName}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => assignPlayer(null as any, 'A', i)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Empty Slot</span>
                  )}
                </div>
              ))}
            </div>
            
            <div className="space-y-3">
              <h3 className="font-bold text-center text-destructive">{t('teamB')}</h3>
              {teamB.map((u, i) => (
                <div key={`b-${i}`} className="h-14 border-2 border-dashed rounded-lg border-destructive/30 flex items-center justify-center bg-destructive/5">
                  {u ? (
                    <div className="flex items-center justify-between w-full px-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8"><AvatarFallback>{u.displayName.substring(0,2)}</AvatarFallback></Avatar>
                        <span className="font-medium">{u.displayName}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => assignPlayer(null as any, 'B', i)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Empty Slot</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(3)}>{t('back')}</Button>
            <Button onClick={() => setStep(5)} disabled={!canProceedStep4}>
              {t('next')} <ChevronRight className="ml-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-xl font-semibold">{t('step5')}</h2>
          
          <Card className="bg-card/50 border-primary/20 shadow-lg">
            <CardContent className="p-6">
              <div className="flex justify-center gap-4 mb-6">
                <Badge variant="outline" className="text-lg py-1 px-4">{game?.toUpperCase()}</Badge>
                <Badge variant="secondary" className="text-lg py-1 px-4">{format}</Badge>
              </div>
              
              <div className="flex justify-between items-center px-4 md:px-12">
                <div className="text-center space-y-2">
                  <h3 className="font-bold text-xl text-primary">{t('teamA')}</h3>
                  {teamA.map(u => (
                    <div key={`sa-${u?.id}`} className="font-medium">{u?.displayName}</div>
                  ))}
                </div>
                
                <div className="text-3xl font-black text-muted-foreground/30 italic">VS</div>
                
                <div className="text-center space-y-2">
                  <h3 className="font-bold text-xl text-destructive">{t('teamB')}</h3>
                  {teamB.map(u => (
                    <div key={`sb-${u?.id}`} className="font-medium">{u?.displayName}</div>
                  ))}
                </div>
              </div>
              
              {spectators.length > 0 && (
                <div className="mt-8 pt-4 border-t text-center">
                  <div className="text-sm text-muted-foreground mb-2">{t('spectators')}</div>
                  <div className="flex justify-center flex-wrap gap-2">
                    {spectators.map(u => (
                      <Badge key={`spec-${u.id}`} variant="outline">{u.displayName}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(4)} disabled={createPartyMut.isPending || createMatchMut.isPending}>{t('back')}</Button>
            <Button size="lg" className="font-bold" onClick={handleStart} disabled={createPartyMut.isPending || createMatchMut.isPending}>
              {(createPartyMut.isPending || createMatchMut.isPending) ? <Spinner className="mr-2" /> : <Gamepad2 className="mr-2 h-5 w-5" />}
              {t('startMatch')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
