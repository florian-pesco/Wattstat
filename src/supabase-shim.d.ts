declare module '@supabase/supabase-js' {
  export interface Session {
    user: {
      id: string;
      email?: string | null;
    };
  }

  export interface SupabaseError {
    message: string;
  }

  export interface AuthSubscription {
    unsubscribe: () => void;
  }

  export interface AuthChangeEvent {}

  export interface SupabaseClient {
    auth: {
      getSession: () => Promise<{ data: { session: Session | null }; error: SupabaseError | null }>;
      onAuthStateChange: (
        callback: (event: AuthChangeEvent, session: Session | null) => void,
      ) => { data: { subscription: AuthSubscription } };
      signInWithOtp: (args: {
        email: string;
        options?: { emailRedirectTo?: string };
      }) => Promise<{ error: SupabaseError | null }>;
      signOut: () => Promise<{ error: SupabaseError | null }>;
    };
    from: (table: string) => any;
  }

  export function createClient(url: string, key: string, options?: unknown): SupabaseClient;
}
