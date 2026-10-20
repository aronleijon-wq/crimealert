// Apple's App Store Server Notifications (version 2) for the iPhone app's Pro: renewals,
// cancellations, failed payments and refunds. A notice only says which subscription changed;
// what it now gives is asked of Apple (_shared/appStore.ts), so a forged notice changes nothing.
// Set the URL https://<project>.supabase.co/functions/v1/apple-notifications in App Store Connect.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.97.0";
import { fetchAppleSubscription, transactionInNotice } from "../_shared/appStore.ts";
import { storeApplePro } from "../_shared/premium.ts";

const ok = (note: string) => new Response(JSON.stringify({ ok: true, note }), { headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const issuerId = Deno.env.get("APPSTORE_ISSUER_ID");
  const keyId = Deno.env.get("APPSTORE_KEY_ID");
  const privateKey = Deno.env.get("APPSTORE_PRIVATE_KEY");
  if (!issuerId || !keyId || !privateKey) return ok("not_configured");

  const body = await req.json().catch(() => ({}));
  const transactionId = typeof body?.signedPayload === "string" ? transactionInNotice(body.signedPayload) : null;
  // Apple's test notice and others without a transaction
  if (!transactionId) return ok("no_transaction");

  try {
    const now = Date.now();
    const sub = await fetchAppleSubscription(transactionId, { issuerId, keyId, privateKey }, now);
    if (!sub) return ok("unknown_subscription");

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });
    const { data: existing } = await admin
      .from("apple_subscriptions").select("user_id").eq("original_transaction_id", sub.originalTransactionId).maybeSingle();
    // A purchase the app never got to report: the account it was bought with, if it exists
    let userId: string | null = existing?.user_id ?? null;
    if (!userId && sub.accountId) {
      const { data } = await admin.auth.admin.getUserById(sub.accountId);
      userId = data?.user?.id ?? null;
    }
    if (!userId) return ok("no_account");

    const { error } = await admin.from("apple_subscriptions").upsert({
      original_transaction_id: sub.originalTransactionId,
      user_id: userId,
      product_id: sub.productId,
      expires_at: sub.expiresAt,
      environment: sub.environment,
      updated_at: new Date(now).toISOString(),
    }, { onConflict: "original_transaction_id" });
    if (error) throw error;
    await storeApplePro(admin, userId);
    return ok("updated");
  } catch (error) {
    console.error("apple-notifications:", error instanceof Error ? error.message : error);
    // Apple sends the notice again later
    return new Response("Error", { status: 500 });
  }
});
