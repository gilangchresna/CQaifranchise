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
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { 
      authorized: false, 
      status: 401, 
      error: "Missing Authorization header" 
    };
  }
  
  const token = authHeader.substring(7);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !serviceKey) {
    return { 
      authorized: false, 
      status: 500, 
      error: "Server configuration error" 
    };
  }
  
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": serviceKey
      }
    });
    
    if (!resp.ok) {
      return { 
        authorized: false, 
        status: 401, 
        error: "Invalid or expired token" 
      };
    }
    
    const userData = await resp.json();
    
    return {
      authorized: true,
      userId: userData.id,
      role: userData.user_metadata?.role || "FRANCHISEE_OWNER",
      status: 200
    };
  } catch (e: any) {
    return { 
      authorized: false, 
      status: 500, 
      error: e.message || "Authentication failed" 
    };
  }
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "https://cqaifranchise.vercel.app",
};

/**
 * Create standardized unauthorized response
 */
export function unauthorizedResponse(error: string = "Unauthorized") {
  return new Response(JSON.stringify({ error }), {
    status: 401,
    headers: CORS_HEADERS,
  });
}

/**
 * Create standardized forbidden response
 */
export function forbiddenResponse(error: string = "Forbidden") {
  return new Response(JSON.stringify({ error }), {
    status: 403,
    headers: CORS_HEADERS,
  });
}
