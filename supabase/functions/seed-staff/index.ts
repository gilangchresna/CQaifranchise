import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const staffMembers = [
      { outlet_id: 156, name: "Ahmad Faiz bin Hassan", role: "cashier", status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+65 9123 4567" },
      { outlet_id: 156, name: "Lim Wei Ming", role: "cashier", status: "present", shift_start: "12:00", shift_end: "20:00", contact: "+65 9234 5678" },
      { outlet_id: 156, name: "Priya Nair", role: "manager", status: "present", shift_start: "09:00", shift_end: "18:00", contact: "+65 9345 6789" },
      { outlet_id: 157, name: "Tan Wei Ling", role: "cashier", status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+65 9456 7890" },
      { outlet_id: 157, name: "Raj Kumar", role: "cashier", status: "absent", shift_start: "14:00", shift_end: "22:00", contact: "+65 9567 8901" },
      { outlet_id: 157, name: "Siti Aminah", role: "manager", status: "present", shift_start: "09:00", shift_end: "18:00", contact: "+65 9678 9012" },
      { outlet_id: 158, name: "David Chen", role: "cashier", status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+65 9789 0123" },
      { outlet_id: 158, name: "Nurul Huda", role: "cashier", status: "present", shift_start: "12:00", shift_end: "20:00", contact: "+65 9890 1234" },
      { outlet_id: 158, name: "Michelle Tan", role: "manager", status: "absent", shift_start: "10:00", shift_end: "19:00", contact: "+65 9901 2345" },
      { outlet_id: 159, name: "Ahmad Fuad", role: "cashier", status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+65 9012 3456" },
      { outlet_id: 159, name: "Lisa Wong", role: "cashier", status: "present", shift_start: "14:00", shift_end: "22:00", contact: "+65 9123 4568" },
      { outlet_id: 160, name: "Kumar Reddy", role: "cashier", status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+65 9234 5679" },
      { outlet_id: 160, name: "Fatimah Omar", role: "manager", status: "present", shift_start: "09:00", shift_end: "18:00", contact: "+65 9345 6780" },
      { outlet_id: 161, name: "John Tan", role: "cashier", status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+65 9456 7891" },
      { outlet_id: 161, name: "Siti Rahayu", role: "cashier", status: "present", shift_start: "12:00", shift_end: "20:00", contact: "+65 9567 8902" },
      { outlet_id: 161, name: "Baskar Menon", role: "manager", status: "present", shift_start: "09:00", shift_end: "18:00", contact: "+65 9678 9013" },
      { outlet_id: 162, name: "Grace Lee", role: "cashier", status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+65 9789 0124" },
      { outlet_id: 162, name: "Ravi Pillai", role: "cashier", status: "absent", shift_start: "14:00", shift_end: "22:00", contact: "+65 9890 1235" },
      { outlet_id: 163, name: "Jenna Ng", role: "cashier", status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+65 9901 2346" },
      { outlet_id: 163, name: "Irfan Hassan", role: "cashier", status: "present", shift_start: "12:00", shift_end: "20:00", contact: "+65 9012 3457" },
      { outlet_id: 163, name: "Mei Lin", role: "manager", status: "present", shift_start: "09:00", shift_end: "18:00", contact: "+65 9123 4569" },
    ];

    // Insert staff
    const { data, error } = await supabase.from("staff").insert(staffMembers);
    if (error) throw error;

    const { count } = await supabase.from("staff").select("*", { count: "exact", head: true });

    return new Response(JSON.stringify({
      success: true,
      staff_created: staffMembers.length,
      total: count
    }), { headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
