// Edge function: consulta Yahoo Finance (quoteSummary) para obtener fundamentales.
// Se llama del lado del servidor para evitar CORS y rate-limit del browser.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.45.0/cors";

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
    const url = `${YF_BASE}${encodeURIComponent(safe)}?modules=financialData,defaultKeyStatistics,summaryProfile,price`;

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

    const info = {
      forwardPE: ks.forwardPE?.raw ?? null,
      trailingPE: ks.trailingPE?.raw ?? null,
      returnOnEquity: fd.returnOnEquity?.raw ?? null,
      returnOnAssets: fd.returnOnAssets?.raw ?? null,
      debtToEquity: fd.debtToEquity?.raw ?? null,
      currentRatio: fd.currentRatio?.raw ?? null,
      profitMargins: fd.profitMargins?.raw ?? null,
      dividendYield: ks.dividendYield?.raw ?? null,
      sector: sp.sector ?? null,
      industry: sp.industry ?? null,
      longName: pr.longName ?? null,
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
