import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side admin client (bypasses RLS) — never exposed to browser
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          password_hash: string;
          role: 'editor' | 'admin';
          avatar_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          runninghub_task_id: string;
          user_id: string;
          app_id: string;
          app_name: string;
          status: string;
          outputs: unknown;
          node_info_list: unknown;
          api_key_type: string;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};
