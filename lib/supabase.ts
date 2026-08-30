import { createClient } from '@supabase/supabase-js';
import { localDbClient } from './local-db';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const useLocalDb = process.env.USE_LOCAL_DB !== 'false';

// Server-side database client: Uses 100% Local DB Driver by default, or Supabase Cloud if explicitly configured
export const supabaseAdmin: any =
  useLocalDb || !supabaseUrl || !supabaseServiceKey
    ? localDbClient
    : createClient(supabaseUrl, supabaseServiceKey, {
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
      image_agent_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          messages: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          title: string;
          messages?: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['image_agent_sessions']['Insert']>;
      };
    };
  };
};
