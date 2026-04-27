// Edge function: histórico de earnings + estimaciones desde Yahoo Finance.
// Para el motor EPS (beat rate, sorpresa promedio, próxima fecha).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();
    if (!ticker || typeof ticker !== "string") {
      return new Response(JSON.stringify({ error: "Ticker requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safe = ticker.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      safe
    )}?modules=earningsHistory,earningsTrend,calendarEvents`;

    const resp = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: "Yahoo error", status: resp.status }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    const res = data?.quoteSummary?.result?.[0] ?? {};
    const history = res.earningsHistory?.history ?? [];

    const surprises = history
      .map((e: { surprisePercent?: { raw?: number } }) => e.surprisePercent?.raw)
      .filter((v: number | undefined): v is number => typeof v === "number");

    const beatCount = surprises.filter((v: number) => v > 0).length;
    const beatRate = surprises.length ? (beatCount / surprises.length) * 100 : null;
    const avgSurprise = surprises.length
      ? (surprises.reduce((s: number, v: number) => s + v, 0) / surprises.length) * 100
      : null;

    const nextDate = res.calendarEvents?.earnings?.earningsDate?.[0]?.fmt ?? null;
    const epsEst = res.earningsTrend?.trend?.[0]?.earningsEstimate?.avg?.raw ?? null;

    return new Response(
      JSON.stringify({
        ticker: safe,
        quarters: history.length,
        beatRate,
        avgSurprise,
        nextDate,
        epsEst,
        history: history.slice(0, 8).map((e: {
          quarter?: { fmt?: string };
          epsActual?: { raw?: number };
          epsEstimate?: { raw?: number };
          surprisePercent?: { raw?: number };
        }) => ({
          quarter: e.quarter?.fmt ?? null,
          epsActual: e.epsActual?.raw ?? null,
          epsEstimate: e.epsEstimate?.raw ?? null,
          surprisePercent: e.surprisePercent?.raw ?? null,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
