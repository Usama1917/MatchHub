import { useState } from 'react';
import { useAdminGetStats, useAdminListUsers, useAdminDeleteUser, useAdminPromoteUser, useAdminDemoteUser, useListMatches, useListParties } from '@workspace/api-client-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, Trash2, Users, Activity, Gamepad2, Settings, UserMinus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export default function Admin() {
  const { data: stats, isLoading: loadingStats } = useAdminGetStats();
  const { data: users, isLoading: loadingUsers } = useAdminListUsers();
  const { data: matches, isLoading: loadingMatches } = useListMatches();
  const { data: parties, isLoading: loadingParties } = useListParties();
  const { user: currentUser } = useAuth();
  
  const deleteUserMut = useAdminDeleteUser();
  const promoteUserMut = useAdminPromoteUser();
  const demoteUserMut = useAdminDemoteUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmPromote, setConfirmPromote] = useState<number | null>(null);
  const [confirmDemote, setConfirmDemote] = useState<number | null>(null);

  const handleDeleteUser = async () => {
    if (!confirmDelete) return;
    try {
      await deleteUserMut.mutateAsync({ userId: confirmDelete });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: 'User deleted' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.error || 'Failed to delete' });
    } finally {
      setConfirmDelete(null);
    }
  };

  const handlePromoteUser = async () => {
    if (!confirmPromote) return;
    try {
      await promoteUserMut.mutateAsync({ userId: confirmPromote });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({ title: 'User promoted to admin' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.error || 'Failed to promote' });
    } finally {
      setConfirmPromote(null);
    }
  };

  const handleDemoteUser = async () => {
    if (!confirmDemote) return;
    try {
      await demoteUserMut.mutateAsync({ userId: confirmDemote });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({ title: 'Admin demoted to user' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.error || 'Failed to demote' });
    } finally {
      setConfirmDemote(null);
    }
  };

  return (
    <div className="container max-w-screen-2xl mx-auto p-4 space-y-8 pb-24">
      <div className="flex items-center space-x-3 rtl:space-x-reverse">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">System management and oversight.</p>
        </div>
      </div>

      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="w-full max-w-md grid grid-cols-4 bg-muted/50">
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-6 space-y-4">
          {loadingStats ? <Spinner /> : stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.totalUsers}</div><p className="text-xs text-muted-foreground">{stats.adminCount} admins</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
                  <Activity className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.totalMatches}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Parties</CardTitle>
                  <Gamepad2 className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.totalParties}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Game Split</CardTitle>
                  <Gamepad2 className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent><div className="text-sm">FIFA: {stats.fifaMatches}<br/>PES: {stats.pesMatches}</div></CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {loadingUsers ? <div className="p-8 flex justify-center"><Spinner /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono">{u.id}</TableCell>
                        <TableCell>@{u.username}</TableCell>
                        <TableCell className="font-medium">{u.displayName}</TableCell>
                        <TableCell><Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-xs">{format(new Date(u.createdAt), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-right space-x-2 rtl:space-x-reverse">
                          {u.role === 'user' && u.id !== currentUser?.id && (
                            <Button variant="outline" size="sm" onClick={() => setConfirmPromote(u.id)} title="Promote to Admin">
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}
                          {u.role === 'admin' && u.id !== currentUser?.id && (
                            <Button variant="outline" size="sm" onClick={() => setConfirmDemote(u.id)} title="Demote to User">
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                          {u.id !== currentUser?.id && (
                            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(u.id)} title="Delete User">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {loadingMatches ? <div className="p-8 flex justify-center"><Spinner /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Game</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches?.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono">{m.id}</TableCell>
                        <TableCell className="uppercase font-bold">{m.game}</TableCell>
                        <TableCell>{m.matchFormat}</TableCell>
                        <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                        <TableCell className="font-bold">{m.teamAScore ?? '-'} : {m.teamBScore ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{format(new Date(m.createdAt), 'MMM d, yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parties" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {loadingParties ? <div className="p-8 flex justify-center"><Spinner /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Game</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parties?.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono">{p.id}</TableCell>
                        <TableCell className="uppercase font-bold">{p.game}</TableCell>
                        <TableCell>{p.matchFormat}</TableCell>
                        <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                        <TableCell>{p.members?.length || 0}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{format(new Date(p.createdAt), 'MMM d, yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>Are you sure you want to delete this user? Users with parties or match history cannot be deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleteUserMut.isPending}>
              {deleteUserMut.isPending && <Spinner className="mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmPromote} onOpenChange={(o) => !o && setConfirmPromote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to Admin</DialogTitle>
            <DialogDescription>Are you sure you want to promote this user to admin? They will have full access to the admin dashboard.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPromote(null)}>Cancel</Button>
            <Button onClick={handlePromoteUser} disabled={promoteUserMut.isPending}>
              {promoteUserMut.isPending && <Spinner className="mr-2" />} Promote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDemote} onOpenChange={(o) => !o && setConfirmDemote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demote Admin</DialogTitle>
            <DialogDescription>Are you sure you want to demote this admin to a regular user?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDemote(null)}>Cancel</Button>
            <Button onClick={handleDemoteUser} disabled={demoteUserMut.isPending}>
              {demoteUserMut.isPending && <Spinner className="mr-2" />} Demote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
