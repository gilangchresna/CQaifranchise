/// <reference lib="deno.ns" />
/**
 * Seed Staff Data
 * Creates ~40 staff members across outlets 1-20 with realistic data.
 * Uses service role — no RLS restrictions.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAFF_DATA = [
  // Singapore outlets (1-3)
  { name: "Ahmad Razak", role: "Outlet Manager", outlet_id: 1, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+65 9123 4001", performance_score: 88, attendance_rate: 97 },
  { name: "Fatimah Zahra", role: "Cashier", outlet_id: 1, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+65 9123 4002", performance_score: 82, attendance_rate: 95 },
  { name: "Chen Yao Ming", role: "Kitchen Staff", outlet_id: 1, status: "late", shift_start: "06:00", shift_end: "14:00", contact: "+65 9123 4003", performance_score: 75, attendance_rate: 88 },
  { name: "Michelle Wong", role: "Cashier", outlet_id: 1, status: "present", shift_start: "15:00", shift_end: "23:00", contact: "+65 9123 4004", performance_score: 90, attendance_rate: 99 },
  { name: "Tan Wei Lin", role: "Kitchen Staff", outlet_id: 2, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+65 9223 4005", performance_score: 78, attendance_rate: 92 },
  { name: "Ng Shu Fen", role: "Outlet Manager", outlet_id: 2, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+65 9223 4006", performance_score: 91, attendance_rate: 96 },
  { name: "Lee Chin Yong", role: "Kitchen Staff", outlet_id: 2, status: "absent", shift_start: "06:00", shift_end: "14:00", contact: "+65 9223 4007", performance_score: 72, attendance_rate: 85 },
  { name: "Priya Devi", role: "Cashier", outlet_id: 3, status: "present", shift_start: "15:00", shift_end: "23:00", contact: "+65 9323 4008", performance_score: 85, attendance_rate: 94 },
  { name: "Wong Kai Ming", role: "Outlet Manager", outlet_id: 3, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+65 9323 4009", performance_score: 89, attendance_rate: 98 },
  { name: "Siti Nurhaliza", role: "Kitchen Staff", outlet_id: 3, status: "late", shift_start: "06:00", shift_end: "14:00", contact: "+65 9323 4010", performance_score: 80, attendance_rate: 90 },

  // Jakarta outlets (4, 9-12)
  { name: "Budi Santoso", role: "Outlet Manager", outlet_id: 4, status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+62 812 4001", performance_score: 87, attendance_rate: 95 },
  { name: "Siti Aisyah", role: "Cashier", outlet_id: 4, status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+62 812 4002", performance_score: 83, attendance_rate: 93 },
  { name: "Ahmad Danial", role: "Kitchen Staff", outlet_id: 4, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+62 812 4003", performance_score: 76, attendance_rate: 91 },
  { name: "Rudi Hermawan", role: "Cashier", outlet_id: 9, status: "present", shift_start: "09:00", shift_end: "17:00", contact: "+62 813 4004", performance_score: 81, attendance_rate: 89 },
  { name: "Dewi Lestari", role: "Kitchen Staff", outlet_id: 9, status: "absent", shift_start: "08:00", shift_end: "16:00", contact: "+62 813 4005", performance_score: 74, attendance_rate: 87 },
  { name: "Hendra Wijaya", role: "Outlet Manager", outlet_id: 10, status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+62 814 4006", performance_score: 90, attendance_rate: 97 },
  { name: "Nurul Huda", role: "Cashier", outlet_id: 10, status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+62 814 4007", performance_score: 86, attendance_rate: 94 },
  { name: "Fitri Handayani", role: "Kitchen Staff", outlet_id: 11, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+62 815 4008", performance_score: 79, attendance_rate: 92 },
  { name: "Joko Pranoto", role: "Outlet Manager", outlet_id: 11, status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+62 815 4009", performance_score: 88, attendance_rate: 96 },
  { name: "Rini Kusuma", role: "Cashier", outlet_id: 12, status: "late", shift_start: "09:00", shift_end: "17:00", contact: "+62 816 4010", performance_score: 84, attendance_rate: 90 },

  // Bandung outlets (5)
  { name: "Toni Suhendra", role: "Outlet Manager", outlet_id: 5, status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+62 822 5001", performance_score: 86, attendance_rate: 94 },
  { name: "Yuni Kartika", role: "Cashier", outlet_id: 5, status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+62 822 5002", performance_score: 82, attendance_rate: 92 },
  { name: "Dadan Sugiana", role: "Kitchen Staff", outlet_id: 5, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+62 822 5003", performance_score: 77, attendance_rate: 89 },

  // Surabaya outlets (6)
  { name: "Bayu Firmansyah", role: "Outlet Manager", outlet_id: 6, status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+62 831 6001", performance_score: 89, attendance_rate: 96 },
  { name: "Ani Wijayanti", role: "Cashier", outlet_id: 6, status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+62 831 6002", performance_score: 84, attendance_rate: 93 },
  { name: "Suryaatmaja", role: "Kitchen Staff", outlet_id: 6, status: "absent", shift_start: "07:00", shift_end: "15:00", contact: "+62 831 6003", performance_score: 73, attendance_rate: 86 },

  // Bangkok outlets (7)
  { name: "Somchai Prasert", role: "Outlet Manager", outlet_id: 7, status: "present", shift_start: "09:00", shift_end: "17:00", contact: "+66 81 234 0001", performance_score: 88, attendance_rate: 95 },
  { name: "Malee Suwan", role: "Cashier", outlet_id: 7, status: "present", shift_start: "09:00", shift_end: "17:00", contact: "+66 81 234 0002", performance_score: 85, attendance_rate: 94 },
  { name: "Prasart Jitja", role: "Kitchen Staff", outlet_id: 7, status: "late", shift_start: "08:00", shift_end: "16:00", contact: "+66 81 234 0003", performance_score: 78, attendance_rate: 88 },

  // Kuala Lumpur outlets (8)
  { name: "Ahmad Zikri", role: "Outlet Manager", outlet_id: 8, status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+60 12 345 6001", performance_score: 87, attendance_rate: 96 },
  { name: "Nur Izzati", role: "Cashier", outlet_id: 8, status: "present", shift_start: "08:00", shift_end: "16:00", contact: "+60 12 345 6002", performance_score: 83, attendance_rate: 93 },
  { name: "Lim Wei Ming", role: "Kitchen Staff", outlet_id: 8, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+60 12 345 6003", performance_score: 76, attendance_rate: 90 },

  // SG Sub-region outlets (164-171)
  { name: "Tan Jia Min", role: "Outlet Manager", outlet_id: 164, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+65 9456 7001", performance_score: 90, attendance_rate: 98 },
  { name: "Ong Wei Jian", role: "Cashier", outlet_id: 164, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+65 9456 7002", performance_score: 86, attendance_rate: 95 },
  { name: "Kumar Sanjay", role: "Kitchen Staff", outlet_id: 165, status: "present", shift_start: "06:00", shift_end: "14:00", contact: "+65 9456 7003", performance_score: 80, attendance_rate: 92 },
  { name: "Syaza Aina", role: "Cashier", outlet_id: 165, status: "late", shift_start: "15:00", shift_end: "23:00", contact: "+65 9456 7004", performance_score: 83, attendance_rate: 88 },
  { name: "Tanaka Yuki", role: "Outlet Manager", outlet_id: 166, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+65 9456 7005", performance_score: 91, attendance_rate: 99 },
  { name: "Lim Jing Hao", role: "Kitchen Staff", outlet_id: 166, status: "present", shift_start: "06:00", shift_end: "14:00", contact: "+65 9456 7006", performance_score: 79, attendance_rate: 91 },
  { name: "Chong Wei Sheng", role: "Cashier", outlet_id: 167, status: "present", shift_start: "15:00", shift_end: "23:00", contact: "+65 9456 7007", performance_score: 85, attendance_rate: 94 },
  { name: "Li Ying Zhi", role: "Outlet Manager", outlet_id: 168, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+65 9456 7008", performance_score: 89, attendance_rate: 97 },
  { name: "Koh Jia Yi", role: "Kitchen Staff", outlet_id: 169, status: "absent", shift_start: "06:00", shift_end: "14:00", contact: "+65 9456 7009", performance_score: 75, attendance_rate: 86 },
  { name: "Lim Pei Ling", role: "Cashier", outlet_id: 170, status: "present", shift_start: "15:00", shift_end: "23:00", contact: "+65 9456 7010", performance_score: 84, attendance_rate: 93 },
  { name: "Tan Mei Hua", role: "Outlet Manager", outlet_id: 171, status: "present", shift_start: "07:00", shift_end: "15:00", contact: "+65 9456 7011", performance_score: 92, attendance_rate: 98 },
  { name: "Nur Aisyah", role: "Kitchen Staff", outlet_id: 171, status: "present", shift_start: "06:00", shift_end: "14:00", contact: "+65 9456 7012", performance_score: 81, attendance_rate: 92 },
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const results: Record<string, any> = {};
  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < STAFF_DATA.length; i++) {
    const s = STAFF_DATA[i];
    const id = i + 1;
    const { error } = await supabase.from("staff").upsert({
      id,
      name: s.name,
      role: s.role,
      outlet_id: s.outlet_id,
      status: s.status,
      shift_start: s.shift_start,
      shift_end: s.shift_end,
      contact: s.contact,
      performance_score: s.performance_score,
      attendance_rate: s.attendance_rate,
      sales_handled: Math.floor(Math.random() * 50000) + 10000,
    }, { onConflict: "id" }).select("id");

    if (error) {
      errors++;
      if (upserted === 0 && errors === 1) {
        return new Response(JSON.stringify({ first_error: error, status: "error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      upserted++;
    }
  }

  return new Response(JSON.stringify({
    status: "ok",
    upserted,
    errors,
    total: STAFF_DATA.length,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});