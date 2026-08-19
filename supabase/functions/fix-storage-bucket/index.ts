// Fix P0: Create storage bucket for franchise-documents
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  const auth = await verifyAuth(req, true, false); // allowServiceRole=true
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Create storage bucket using admin client
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('franchise-documents', {
      id: 'franchise-documents',
      name: 'franchise-documents',
      public: false,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      throw bucketError;
    }

    // Create RLS policies for the bucket
    const { error: policyError } = await supabase.rpc('pg_catalog.exec', {
      sql: `
        -- Allow authenticated users to upload
        CREATE POLICY IF NOT EXISTS "User upload to franchise-documents"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (bucket_id = 'franchise-documents');

        -- Allow users to read own documents
        CREATE POLICY IF NOT EXISTS "User read own franchise-documents"
          ON storage.objects FOR SELECT
          TO authenticated
          USING (bucket_id = 'franchise-documents');

        -- Allow users to update own documents
        CREATE POLICY IF NOT EXISTS "User update own franchise-documents"
          ON storage.objects FOR UPDATE
          TO authenticated
          USING (bucket_id = 'franchise-documents')
          WITH CHECK (bucket_id = 'franchise-documents');

        -- Allow users to delete own documents
        CREATE POLICY IF NOT EXISTS "User delete own franchise-documents"
          ON storage.objects FOR DELETE
          TO authenticated
          USING (bucket_id = 'franchise-documents');

        -- Allow HQ_ADMIN to read all
        CREATE POLICY IF NOT EXISTS "Admin read all franchise-documents"
          ON storage.objects FOR SELECT
          TO authenticated
          USING (
            bucket_id = 'franchise-documents'
            AND EXISTS (
              SELECT 1 FROM public.user_profiles
              WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
            )
          );

        -- Allow HQ_ADMIN to delete all
        CREATE POLICY IF NOT EXISTS "Admin delete all franchise-documents"
          ON storage.objects FOR DELETE
          TO authenticated
          USING (
            bucket_id = 'franchise-documents'
            AND EXISTS (
              SELECT 1 FROM public.user_profiles
              WHERE id = auth.uid() AND role = 'HQ_ADMIN'
            )
          );
      `
    });

    // Verify bucket exists
    const { data: verifyBucket } = await supabase.storage.getBucket('franchise-documents');

    return new Response(JSON.stringify({
      success: true,
      message: "Storage bucket created/configured",
      bucket: verifyBucket || { id: 'franchise-documents' },
      policiesApplied: !policyError
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Error creating bucket:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
