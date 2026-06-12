import { Link, useLocation } from 'wouter';
import { Home, PlusCircle, History, Trophy, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  const links = [
    { href: '/', icon: Home, label: t('home') },
    { href: '/party/new', icon: PlusCircle, label: t('party') },
    { href: '/history', icon: History, label: t('history') },
    { href: '/rankings', icon: Trophy, label: t('rankings') },
    { href: '/profile', icon: User, label: t('profile') },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 w-full items-center justify-around border-t bg-background px-2 pb-safe">
      {links.map(({ href, icon: Icon, label }) => {
        const isActive = location === href || (href !== '/' && location.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground hover:text-foreground transition-colors",
              isActive && "text-primary"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
