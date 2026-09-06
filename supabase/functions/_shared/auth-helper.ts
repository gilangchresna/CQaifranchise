// Shared Auth Helper for Supabase Edge Functions
// Use this in all edge functions that need authentication

export interface AuthResult {
  authorized: boolean;
  userId?: string;
  role?: string;
  status: number;
  error?: string;
}

/**
 * Verify JWT token and return user info
 * Use this at the start of all protected edge functions
 *
 * Bypass options:
 * - allowServiceRole=true: bypass with service role key OR ANON key
 * - allowNoAuth=true: bypass with no auth header
 * - X-Internal-Call: true header: bypass any request
 */
export async function verifyAuth(
  req: Request,
  allowServiceRole = false,
  allowNoAuth = false,
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  const internalCall = req.headers.get("X-Internal-Call");

  // Bypass 1: X-Internal-Call header (for pg_cron / internal scripts)
  if (allowServiceRole && (internalCall === "true" || internalCall === "1")) {
    return { authorized: true, userId: "internal", role: "SERVICE_ROLE", status: 200 };
  }

  // Bypass 2: No auth header (only when allowNoAuth=true)
  if (allowNoAuth && (!authHeader || !authHeader.startsWith("Bearer "))) {
    return { authorized: true, userId: "internal", role: "INTERNAL", status: 200 };
  }

  // Require auth header from here on
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authorized: false, status: 401, error: "Missing Authorization header" };
  }

  const token = authHeader.substring(7);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return { authorized: false, status: 500, error: "Server configuration error" };
  }

  // Bypass 3: Service role key
  if (allowServiceRole && token === serviceKey) {
    return { authorized: true, userId: "service-role", role: "SERVICE_ROLE", status: 200 };
  }

  // Bypass 4: ANON key (from local scripts / testing)
  if (allowServiceRole) {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.role === "anon") {
          return { authorized: true, userId: "anon-bypass", role: "SERVICE_ROLE", status: 200 };
        }
      }
    } catch { /* fall through to JWT verification */ }
  }

  // Normal JWT verification
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey }
    });

    if (!resp.ok) {
      return { authorized: false, status: 401, error: "Invalid or expired token" };
    }

    const userData = await resp.json();
    
    // Get role from user_profiles table, not JWT metadata
    const profileResp = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?id=eq.${userData.id}&select=role&limit=1`,
      { headers: { "Authorization": `Bearer ${serviceKey}`, "apikey": serviceKey } }
    );
    let role = "FRANCHISEE_OWNER"; // default
    if (profileResp.ok) {
      const profiles = await profileResp.json();
      if (profiles && profiles.length > 0 && profiles[0].role) {
        role = profiles[0].role;
      }
    }
    
    return {
      authorized: true,
      userId: userData.id,
      role: role,
      status: 200
    };
  } catch (e: any) {
    return { authorized: false, status: 500, error: e.message || "Authentication failed" };
  }
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGINS") || "https://c-qaifranchise.vercel.app",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-call",
  "Access-Control-Max-Age": "86400",
};

export function unauthorizedResponse(error = "Unauthorized") {
  return new Response(JSON.stringify({ error }), { status: 401, headers: CORS_HEADERS });
}

export function forbiddenResponse(error = "Forbidden") {
  return new Response(JSON.stringify({ error }), { status: 403, headers: CORS_HEADERS });
}
