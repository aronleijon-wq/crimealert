// Pro bought in the iPhone app (src/lib/appStore.ts). The app sends the ids of the transactions
// the phone holds, after a purchase, a restore or at start; this asks Apple about each and gives
// the signed-in account Pro for as long as Apple says it is paid. A subscription belongs to the
// account it was bought with, and can't be moved to another one.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.97.0";
import { fetchAppleSubscription, type AppStoreKey } from "../_shared/appStore.ts";
import { proUntilActive, storeApplePro } from "../_shared/premium.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const issuerId = Deno.env.get("APPSTORE_ISSUER_ID");
    const keyId = Deno.env.get("APPSTORE_KEY_ID");
    const privateKey = Deno.env.get("APPSTORE_PRIVATE_KEY");
    if (!issuerId || !keyId || !privateKey) return json({ error: "Köp via App Store är inte konfigurerat än." }, 503);
    const key: AppStoreKey = { issuerId, keyId, privateKey };

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ error: "Inte inloggad" }, 401);

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.transactionIds)
      ? [...new Set(body.transactionIds.filter((id: unknown): id is string => typeof id === "string"))].slice(0, 5)
      : [];

    let otherAccount = false;
    const now = Date.now();
    for (const id of ids) {
      const sub = await fetchAppleSubscription(id, key, now);
      if (!sub) continue;
      // Bought for another CrimeAlert account (the purchase carries its id)
      if (sub.accountId && sub.accountId !== user.id) {
        otherAccount = true;
        continue;
      }
      const { data: existing } = await admin
        .from("apple_subscriptions").select("user_id").eq("original_transaction_id", sub.originalTransactionId).maybeSingle();
      if (existing && existing.user_id !== user.id) {
        otherAccount = true;
        continue;
      }
      const { error } = await admin.from("apple_subscriptions").upsert({
        original_transaction_id: sub.originalTransactionId,
        user_id: user.id,
        product_id: sub.productId,
        expires_at: sub.expiresAt,
        environment: sub.environment,
        updated_at: new Date(now).toISOString(),
      }, { onConflict: "original_transaction_id" });
      if (error) throw error;
    }

    const proUntil = await storeApplePro(admin, user.id);
    return json({ pro: proUntilActive(proUntil, now), pro_until: proUntil, other_account: otherAccount });
  } catch (error) {
    console.error("apple-subscription:", error instanceof Error ? error.message : error);
    return json({ error: "Kunde inte kontrollera köpet just nu." }, 500);
  }
});
