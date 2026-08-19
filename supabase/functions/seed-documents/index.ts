// Seed sample documents for demo
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
  
  const auth = await verifyAuth(req, true, false);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Alice's franchisee_id
  const ALICE_ID = 'eee7a354-e627-4d66-880e-7ade2df815c7';

  const sampleDocuments = [
    {
      user_id: ALICE_ID,
      document_type: 'KYC_ID',
      title: 'NRIC Front & Back',
      file_name: 'nric_alice_tan.pdf',
      storage_path: 'kyc/nric_alice_tan.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 245000,
      uploaded_by: ALICE_ID,
    },
    {
      user_id: ALICE_ID,
      document_type: 'FINANCIAL_REPORT',
      title: 'ACRA Business Profile 2026',
      file_name: 'acra_business_profile_2026.pdf',
      storage_path: 'financial/acra_business_profile_2026.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 125000,
      uploaded_by: ALICE_ID,
    },
    {
      user_id: ALICE_ID,
      document_type: 'FINANCIAL_REPORT',
      title: 'Profit & Loss Statement Q2 2026',
      file_name: 'pl_statement_q2_2026.pdf',
      storage_path: 'financial/pl_statement_q2_2026.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 89000,
      uploaded_by: ALICE_ID,
    },
    {
      user_id: ALICE_ID,
      document_type: 'BANK_STATEMENT',
      title: 'DBS Bank Statement July 2026',
      file_name: 'dbs_statement_july_2026.pdf',
      storage_path: 'bank/dbs_statement_july_2026.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 456000,
      uploaded_by: ALICE_ID,
    },
    {
      user_id: ALICE_ID,
      document_type: 'FRANCHISEE_CONTRACT',
      title: 'Franchise Agreement - CyberQuote SG',
      file_name: 'franchise_agreement_cyberquote_sg.pdf',
      storage_path: 'legal/franchise_agreement_cyberquote_sg.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 1234000,
      uploaded_by: ALICE_ID,
    },
  ];

  try {
    // Insert sample documents
    const { data, error } = await supabase
      .from('documents')
      .insert(sampleDocuments)
      .select();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Seeded ${data?.length || 0} sample documents`,
      documents: data,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
