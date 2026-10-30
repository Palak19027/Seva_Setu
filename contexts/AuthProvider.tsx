import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext, type AuthContextValue } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/navigation';
import type { Organization, Profile } from '@/lib/types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      setOrganization(null);
      return;
    }
    const [profileResult, organizationResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('organizations').select('*').eq('id', userId).maybeSingle(),
    ]);
    if (profileResult.error || organizationResult.error) {
      setProfile(null);
      setOrganization(null);
      return;
    }
    const nextProfile = profileResult.data as Profile | null;
    setProfile(nextProfile);
    setOrganization(organizationResult.data as Organization | null);
    if (nextProfile && !nextProfile.is_active) {
      await supabase.auth.signOut();
    }
  }, []);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      (async () => {
        if (!active) return;
        setSession(nextSession);
        await loadAccount(nextSession?.user.id ?? null);
        if (active) setLoading(false);
      })();
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadAccount]);

  const refreshAccount = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadAccount(data.session?.user.id ?? null);
  }, [loadAccount]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, organization, loading, refreshAccount, signOut }),
    [session, profile, organization, loading, refreshAccount, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
