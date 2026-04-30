// Edge function: consulta Yahoo Finance para fundamentales.
// Usa v7/quote (público, sin crumb). Si falla → error.
// El endpoint v10/quoteSummary ahora requiere crumb+cookie y devuelve 401.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchQuote(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v7/quote?symbols=${encodeURIComponent(symbol)}`;
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.quoteResponse?.result?.[0] ?? null;
}

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

    const q = await fetchQuote(safe);

    if (!q) {
      return new Response(
        JSON.stringify({ error: "Yahoo Finance no devolvió datos para este ticker", ticker: safe }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const info = {
      forwardPE: q.forwardPE ?? null,
      trailingPE: q.trailingPE ?? null,
      returnOnEquity: null,
      returnOnAssets: null,
      debtToEquity: null,
      currentRatio: null,
      profitMargins: null,
      dividendYield: q.trailingAnnualDividendYield ?? q.dividendYield ?? null,
      beta: null,
      sector: null,
      industry: null,
      country: null,
      longName: q.longName ?? q.shortName ?? null,
      currentPrice: q.regularMarketPrice ?? null,
      targetMeanPrice: null,
      numberOfAnalysts: null,
      recomBuy: 0,
      recomHold: 0,
      recomSell: 0,
      epsEst: q.epsForward ?? q.epsTrailingTwelveMonths ?? null,
      nextEarnings: q.earningsTimestamp
        ? new Date(q.earningsTimestamp * 1000).toISOString().slice(0, 10)
        : null,
      freeCashflow: null,
      totalCash: null,
      totalDebt: null,
      ebitda: null,
      marketCap: q.marketCap ?? null,
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
