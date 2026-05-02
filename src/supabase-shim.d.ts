declare module '@supabase/supabase-js' {
  export interface Session {
    user: {
      id: string;
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    };
  }

  export interface AuthResponse {
    data: {
      session: Session | null;
    };
    error: SupabaseError | null;
  }

  export interface SignUpResponse extends AuthResponse {}

  export interface SupabaseError {
    message: string;
  }

  export interface AuthSubscription {
    unsubscribe: () => void;
  }

  export interface AuthChangeEvent {}

  export interface SupabaseClient {
    auth: {
      getSession: () => Promise<AuthResponse>;
      onAuthStateChange: (
        callback: (event: AuthChangeEvent, session: Session | null) => void,
      ) => { data: { subscription: AuthSubscription } };
      signUp: (args: {
        email: string;
        password: string;
        options?: {
          emailRedirectTo?: string;
          data?: Record<string, unknown>;
        };
      }) => Promise<SignUpResponse>;
      signInWithPassword: (args: {
        email: string;
        password: string;
      }) => Promise<AuthResponse>;
      signOut: () => Promise<{ error: SupabaseError | null }>;
    };
    from: (table: string) => any;
  }

  export function createClient(url: string, key: string, options?: unknown): SupabaseClient;
}
