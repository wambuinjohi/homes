import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: "Admin" | "Landlord" | "Manager" | "Agent" | "Tenant" | "System") => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("🔄 Auth state change:", event, session ? "session exists" : "no session");
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("🔍 Initial session check:", session ? "session found" : "no session");
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Monitor session and auto-refresh before expiry
    // OPTIMIZATION: Delay first check to avoid interfering with initial load
    const checkSession = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.expires_at) {
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;
        
        // Refresh if within 5 minutes of expiry
        if (timeUntilExpiry < 300 && timeUntilExpiry > 0) {
          console.log('🔄 Auto-refreshing session (expires in', timeUntilExpiry, 'seconds)');
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            console.error('❌ Auto-refresh failed:', error);
          } else {
            console.log('✅ Session auto-refreshed successfully');
          }
        }
      }
    }, 120000); // Check every 2 minutes (reduced frequency)

    return () => {
      subscription.unsubscribe();
      clearInterval(checkSession);
    };
  }, []);

  const signOut = async () => {
    console.log("🚪 SignOut function called");
    try {
      // Always clear local state first
      console.log("🧹 Clearing local state");
      setSession(null);
      setUser(null);
      
      // Clear browser storage manually
      console.log("🗑️ Clearing browser storage");
      localStorage.removeItem('sb-kdpqimetajnhcqseajok-auth-token');
      sessionStorage.removeItem('sb-kdpqimetajnhcqseajok-auth-token');
      
      // Attempt to sign out from Supabase with global scope
      console.log("☁️ Calling Supabase signOut with global scope");
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.warn("Supabase signOut error (continuing with local logout):", error);
      } else {
        console.log("✅ Supabase signOut successful");
      }
      
      // Small delay to ensure auth state processes
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.warn("Error during sign out (continuing with local logout):", error);
    } finally {
      // Always navigate to auth page regardless of server response
      console.log("🔄 Redirecting to /auth");
      window.location.href = "/auth";
    }
  };

  const hasRole = useCallback(async (role: "Admin" | "Landlord" | "Manager" | "Agent" | "Tenant" | "System"): Promise<boolean> => {
    if (!user) return false;

    try {
      // Use RPC with built-in server proxy fallback from our Supabase client wrapper
      const { data, error } = await supabase.rpc('has_role_safe', { _user_id: user.id, _role: role as any });
      if (error) throw error;
      return Boolean(data);
    } catch (e: any) {
      const msg = e?.message || JSON.stringify(e);
      console.error(`Error checking role ${role} via RPC: ${msg}`);
      return false;
    }
  }, [user]);

  const value = {
    user,
    session,
    loading,
    signOut,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
