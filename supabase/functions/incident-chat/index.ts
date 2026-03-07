import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, incidents } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build incident context summary for the AI
    let incidentContext = "";
    if (incidents && incidents.length > 0) {
      const summary = incidents.slice(0, 50).map((inc: any) => {
        const ageMs = Date.now() - new Date(inc.time).getTime();
        const mins = Math.floor(ageMs / 60000);
        const timeAgo = mins < 60 ? `${mins} min sedan` : `${Math.floor(mins / 60)}h sedan`;
        return `- [${inc.type.toUpperCase()}] ${inc.title} (${inc.area}, ${timeAgo}, risk: ${inc.risk}, status: ${inc.status})${inc.description ? ': ' + inc.description.slice(0, 150) : ''}`;
      }).join("\n");

      const typeCount: Record<string, number> = {};
      const riskCount: Record<string, number> = {};
      const areaCount: Record<string, number> = {};
      incidents.forEach((inc: any) => {
        typeCount[inc.type] = (typeCount[inc.type] || 0) + 1;
        riskCount[inc.risk] = (riskCount[inc.risk] || 0) + 1;
        areaCount[inc.area] = (areaCount[inc.area] || 0) + 1;
      });

      const activeCount = incidents.filter((i: any) => i.status === 'active').length;
      
      incidentContext = `
AKTUELLA HÄNDELSER (${incidents.length} totalt, ${activeCount} pågående):

Fördelning per typ: ${Object.entries(typeCount).map(([k, v]) => `${k}: ${v}`).join(', ')}
Fördelning per risk: ${Object.entries(riskCount).map(([k, v]) => `${k}: ${v}`).join(', ')}
Mest drabbade områden: ${Object.entries(areaCount).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10).map(([k, v]) => `${k} (${v})`).join(', ')}

Senaste händelserna:
${summary}
`;
    }

    const systemPrompt = `Du är CrimeAlert AI, en säkerhetsassistent för Sverige. Du hjälper användare att förstå aktuella händelser, bedöma säkerhetsläget i olika områden och ge praktiska säkerhetsrekommendationer.

Riktlinjer:
- Svara ALLTID på svenska
- Var saklig och basera svar på tillgänglig data
- Ge konkreta rekommendationer när det är relevant
- Om du inte har data om ett specifikt område, säg det ärligt
- Undvik att spekulera eller överdriva risker
- Var empatisk men professionell
- Nämn aldrig att du har en "lista" — prata om det som realtidsdata
- Använd markdown-formatering för läsbarhet (fetstil, listor, etc.)

${incidentContext ? `Här är den aktuella incidentdatan du har tillgång till:\n${incidentContext}` : 'Ingen incidentdata är tillgänglig just nu.'}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "För många förfrågningar. Försök igen om en stund." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut. Kontakta administratören." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI-tjänsten är tillfälligt otillgänglig." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Okänt fel" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
