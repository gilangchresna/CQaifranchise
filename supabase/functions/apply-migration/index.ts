/// <reference lib="deno.ns" />
/**
 * Apply Migration Function
 * SECURITY: Requires HQ_ADMIN role
 * WARNING: This function is now DISABLED - use Supabase migrations instead
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, unauthorizedResponse, forbiddenResponse } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // SECURITY: Verify authentication
  const auth = await verifyAuth(req);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  // SECURITY: Only HQ_ADMIN can access migration info
  if (auth.role !== 'HQ_ADMIN') {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }

  // SECURITY: This function is now DISABLED
  // Do NOT allow arbitrary SQL execution
  // Use Supabase Dashboard or migration files instead

  return new Response(JSON.stringify({
    success: false,
    error: "Migrations must be applied via Supabase Dashboard or CI/CD pipeline",
    instructions: [
      "1. Use Supabase Dashboard > SQL Editor for manual migrations",
      "2. Use `supabase db push` CLI command for local migrations",
      "3. Use GitHub Actions for automated deployment",
      "4. Never use arbitrary SQL execution in production"
    ],
    security_note: "This endpoint is disabled for security reasons"
  }), {
    status: 403, // Forbidden
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
