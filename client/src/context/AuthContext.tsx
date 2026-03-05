import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthContextType {
  token: string | null;
  setToken: (t: string | null) => void;
  getAuthHeaders: () => { Authorization?: string };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem('paddyflow_token')
  );

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem('paddyflow_token', t);
    else localStorage.removeItem('paddyflow_token');
  }, []);

  const getAuthHeaders = useCallback((): { Authorization?: string } => {
    const t = token ?? localStorage.getItem('paddyflow_token');
    if (!t) return {};
    return { Authorization: `Bearer ${t}` };
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        token: token ?? localStorage.getItem('paddyflow_token'),
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
