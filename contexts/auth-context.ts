import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Organization, Profile } from '@/lib/types';

export interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  refreshAccount: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
