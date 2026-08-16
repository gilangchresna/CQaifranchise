/// <reference lib="deno.ns" />

/**
 * Document Upload Edge Function
 * Handles file upload to Supabase Storage + metadata insert
 *
 * POST /functions/v1/document-upload
 * Content-Type: multipart/form-data
 *
 * Fields:
 *   - file: File binary
 *   - application_id: UUID (optional - link to financing application)
 *   - document_type: KYC_ID | BANK_STATEMENT | FRANCHISE_CONTRACT | FINANCIAL_REPORT | OTHER
 *   - title: string (optional)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const DOC_TYPES = ["KYC_ID", "BANK_STATEMENT", "FRANCHISE_CONTRACT", "FINANCIAL_REPORT", "OTHER"];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth
  const auth = await verifyAuth(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const applicationId = formData.get("application_id") as string | null;
    const documentType = formData.get("document_type") as string;
    const title = formData.get("title") as string | null;

    // Validate file
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ error: "File too large (max 50MB)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ error: "File type not allowed (PDF, PNG, JPG only)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!documentType || !DOC_TYPES.includes(documentType)) {
      return new Response(JSON.stringify({ error: "Invalid document_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate storage path
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${auth.userId}/${documentType}/${crypto.randomUUID()}.${ext}`;

    // Upload to Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("franchise-documents")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Insert metadata
    const { data: doc, error: insertError } = await supabase
      .from("documents")
      .insert({
        application_id: applicationId || null,
        user_id: auth.userId,
        document_type: documentType,
        title: title || file.name,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        file_size_bytes: file.size,
        uploaded_by: auth.userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      success: true,
      document: doc,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
