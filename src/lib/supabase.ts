/**
 * Supabase Client - CyberQuote
 * Only adds data connection, NO UI changes
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Edge Functions base URL
export const EDGE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1`

// Helper to call Edge Functions
export async function callEdgeFunction(functionName: string, body?: any) {
  const { data: { session } } = await supabase.auth.getSession()
  
  const response = await fetch(`${EDGE_FUNCTIONS_URL}/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  
  return response.json()
}
