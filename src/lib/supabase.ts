/**
 * Supabase Client - CyberQuote
 * Only adds data connection, NO UI changes
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export { supabaseUrl };

// Edge Functions base URL
export const EDGE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1`

// Helper to call Edge Functions
export async function callEdgeFunction(functionName: string, body?: any, options?: { method?: string }) {
  const { data: { session } } = await supabase.auth.getSession()

  const method = options?.method || (body ? 'POST' : 'GET');
  const response = await fetch(`${EDGE_FUNCTIONS_URL}/${functionName}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    },
    body: method === 'POST' && body ? JSON.stringify(body) : undefined,
  });

  return response.json();
}
