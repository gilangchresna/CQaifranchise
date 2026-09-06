/// <reference lib="deno.ns" />
/** Patch outlet names for outlets 1-8 based on outlet_classifications. */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
const CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type"};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data: oc } = await supabase.from("outlet_classifications").select("outlet_id, outlet_code, region, outlet_type, size_category");
  const PATCH: Record<number, string> = {
    1: "WKWainan Singapore",
    2: "Mybop Singapore",
    3: "Sap Singapore",
    4: "Jaket Indonesia",
    5: "Badogan Indonesia",
    6: "Surabaja Indonesia",
    7: "Bangkok Thailand",
    8: "Kul Malaysia",
  };
  const FK: Record<string, number> = { Singapore: 1, Jakarta: 4, Bandung: 5, Surabaya: 6, Bangkok: 7, "Kuala Lumpur": 8 };
  let updated = 0;
  for (const o of oc ?? []) {
    const id: number = (o as any).outlet_id;
    if (PATCH[id]) {
      const { error } = await supabase.from("outlets").update({ name: PATCH[id] }).eq("id", id);
      if (!error) updated++;
    }
  }
  return new Response(JSON.stringify({ status: "ok", updated }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
