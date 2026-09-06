/// <reference lib="deno.ns" />

/**
 * JWT Authentication Helper for Supabase Edge Functions
 * Validates user JWT tokens and extracts user information
 */

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  rawRole: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  status?: number;
}

/**
 * Verify JWT token and extract user info
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return {
      success: false,
      error: 'Missing Authorization header',
      status: 401,
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Invalid Authorization format. Use: Bearer <token>',
      status: 401,
    };
  }

  const token = authHeader.substring(7);

  if (!token) {
    return {
      success: false,
      error: 'Missing token',
      status: 401,
    };
  }

  try {
    // Verify with Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: 'Invalid or expired token',
        status: 401,
      };
    }

    const userData = await response.json();

    return {
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.user_metadata?.role || 'FRANCHISEE_OWNER',
        rawRole: userData.user_metadata?.role || 'FRANCHISEE_OWNER',
      },
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      status: 401,
    };
  }
}

/**
 * Check if user has required role
 */
export function hasRole(user: AuthUser, requiredRoles: string[]): boolean {
  return requiredRoles.includes(user.rawRole);
}

/**
 * Role hierarchy check
 */
export function isAtLeastRole(user: AuthUser, minRole: string): boolean {
  const hierarchy: Record<string, number> = {
    'HQ_ADMIN': 4,
    'REGIONAL_MANAGER': 3,
    'FRANCHISEE_OWNER': 2,
    'FRANCHISEE_STAFF': 1,
  };

  const userLevel = hierarchy[user.rawRole] || 0;
  const requiredLevel = hierarchy[minRole] || 0;

  return userLevel >= requiredLevel;
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status: 401, 
      headers: { 
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="CyberQuote"',
      } 
    }
  );
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden'): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status: 403, 
      headers: { 'Content-Type': 'application/json' } 
    }
  );
}
