import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getAuthToken, setAuthToken, getAuthHeaders as getAuthHeadersFromApi } from '../api/auth';

interface AuthContextType {
  token: string | null;
  setToken: (t: string | null) => void;
  getAuthHeaders: () => { Authorization?: string };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getAuthToken());

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    setAuthToken(t);
  }, []);

  const getAuthHeaders = useCallback((): { Authorization?: string } => {
    return getAuthHeadersFromApi();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token: token ?? getAuthToken(),
        setToken,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
