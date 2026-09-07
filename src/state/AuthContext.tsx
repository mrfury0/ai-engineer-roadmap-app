import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { authEnabled, ownerEmail, supabase } from "../lib/supabase";

interface AuthApi {
  user: User | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
  sendMagicLink: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(authEnabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    if (!ownerEmail) {
      void supabase?.auth.signOut();
      return;
    }
    if (session.user.email?.toLowerCase() !== ownerEmail) {
      setError("This account is not authorized for this roadmap.");
      void supabase?.auth.signOut();
    }
  }, [session]);

  const sendMagicLink = async (email: string) => {
    if (!supabase) return "Supabase is not configured.";
    const normalized = email.trim().toLowerCase();
    if (ownerEmail && normalized !== ownerEmail) return "That email is not authorized.";
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (signInError) return signInError.message;
    return null;
  };

  const value: AuthApi = {
    user: session?.user ?? null,
    loading,
    configured: authEnabled,
    error,
    sendMagicLink,
    signOut: async () => { await supabase?.auth.signOut(); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useOptionalAuth(): Pick<AuthApi, "user"> {
  return useContext(Ctx) ?? { user: null };
}
