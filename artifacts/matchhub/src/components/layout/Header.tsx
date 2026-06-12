import { Link, useLocation } from 'wouter';
import { Trophy, History, Home, User, PlusCircle, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLogout } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const logoutMutation = useLogout();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        toast({ title: t('logout') });
        window.location.href = '/login';
      },
    });
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4">
        <Link href="/" className="mr-6 flex items-center space-x-2 rtl:ml-6 rtl:mr-0">
          <Trophy className="h-6 w-6 text-primary" />
          <span className="hidden font-bold sm:inline-block">MatchHub</span>
        </Link>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end rtl:space-x-reverse">
          <nav className="hidden md:flex items-center space-x-6 rtl:space-x-reverse text-sm font-medium">
            <Link href="/" className="transition-colors hover:text-foreground/80 text-foreground/60">{t('home')}</Link>
            <Link href="/party/new" className="transition-colors hover:text-foreground/80 text-foreground/60">{t('party')}</Link>
            <Link href="/history" className="transition-colors hover:text-foreground/80 text-foreground/60">{t('history')}</Link>
            <Link href="/rankings" className="transition-colors hover:text-foreground/80 text-foreground/60">{t('rankings')}</Link>
            {isAdmin && <Link href="/admin" className="transition-colors hover:text-foreground/80 text-foreground/60">{t('admin')}</Link>}
          </nav>
          <div className="flex items-center space-x-2 rtl:space-x-reverse ml-auto">
            <Button variant="ghost" size="icon" onClick={toggleLanguage} className="h-8 w-8 px-0">
              <span className="font-bold">{language === 'en' ? 'ع' : 'EN'}</span>
              <span className="sr-only">Toggle language</span>
            </Button>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {user?.displayName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        @{user?.username}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation('/profile')}>
                    <User className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                    <span>{t('profile')}</span>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => setLocation('/admin')}>
                      <Shield className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                      <span>{t('admin')}</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                    <span>{t('logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex space-x-2 rtl:space-x-reverse">
                <Button variant="ghost" size="sm" onClick={() => setLocation('/login')}>
                  {t('login')}
                </Button>
                <Button size="sm" onClick={() => setLocation('/register')}>
                  {t('register')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
