// Edge function: consulta Yahoo Finance (quoteSummary) para obtener fundamentales.
// Se llama del lado del servidor para evitar CORS y rate-limit del browser.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const YF_BASE = "https://query1.finance.yahoo.com/v10/finance/quoteSummary/";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();

    if (!ticker || typeof ticker !== "string") {
      return new Response(
        JSON.stringify({ error: "Ticker requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safe = ticker.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    const url = `${YF_BASE}${encodeURIComponent(safe)}?modules=financialData,defaultKeyStatistics,summaryProfile,price,recommendationTrend,earningsTrend,calendarEvents`;

    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        // Yahoo bloquea requests sin UA "real"
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: "Yahoo Finance respondió con error", status: resp.status }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    const result = data?.quoteSummary?.result?.[0];

    if (!result) {
      return new Response(
        JSON.stringify({ info: null, ticker: safe }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fd = result.financialData ?? {};
    const ks = result.defaultKeyStatistics ?? {};
    const sp = result.summaryProfile ?? {};
    const pr = result.price ?? {};
    const rt = result.recommendationTrend?.trend?.[0] ?? {};
    const et = result.earningsTrend?.trend?.[0]?.earningsEstimate ?? {};
    const ce = result.calendarEvents ?? {};

    const info = {
      forwardPE: ks.forwardPE?.raw ?? null,
      trailingPE: ks.trailingPE?.raw ?? null,
      returnOnEquity: fd.returnOnEquity?.raw ?? null,
      returnOnAssets: fd.returnOnAssets?.raw ?? null,
      debtToEquity: fd.debtToEquity?.raw ?? null,
      currentRatio: fd.currentRatio?.raw ?? null,
      profitMargins: fd.profitMargins?.raw ?? null,
      dividendYield: ks.dividendYield?.raw ?? null,
      beta: ks.beta?.raw ?? null,
      sector: sp.sector ?? null,
      industry: sp.industry ?? null,
      country: sp.country ?? null,
      longName: pr.longName ?? null,
      currentPrice: fd.currentPrice?.raw ?? pr.regularMarketPrice?.raw ?? null,
      targetMeanPrice: fd.targetMeanPrice?.raw ?? null,
      numberOfAnalysts: fd.numberOfAnalystOpinions?.raw ?? null,
      recomBuy: (rt.strongBuy ?? 0) + (rt.buy ?? 0),
      recomHold: rt.hold ?? 0,
      recomSell: (rt.sell ?? 0) + (rt.strongSell ?? 0),
      epsEst: et.avg?.raw ?? null,
      nextEarnings: ce.earnings?.earningsDate?.[0]?.fmt ?? null,
      freeCashflow: fd.freeCashflow?.raw ?? null,
      totalCash: fd.totalCash?.raw ?? null,
      totalDebt: fd.totalDebt?.raw ?? null,
      ebitda: fd.ebitda?.raw ?? null,
      marketCap: pr.marketCap?.raw ?? null,
    };

    return new Response(
      JSON.stringify({ info, ticker: safe }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
