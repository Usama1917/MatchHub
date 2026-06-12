import { createContext, useContext, ReactNode } from 'react';
import { useGetMe, getGetMeQueryKey, User } from '@workspace/api-client-react';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, error } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });

  const isAuthenticated = !!user && !error;
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, isAuthenticated, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
