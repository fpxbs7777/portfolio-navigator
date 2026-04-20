// Edge function: descarga histórico de precios desde Yahoo Finance (chart API).
// Devuelve cierres diarios para uso en CAPM, Markowitz, etc.

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
    const { ticker, range = "2y", interval = "1d" } = await req.json();

    if (!ticker || typeof ticker !== "string") {
      return new Response(
        JSON.stringify({ error: "Ticker requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeTicker = ticker.trim().toUpperCase().replace(/[^A-Z0-9.\-\^=]/g, "");
    const safeRange = ["1mo", "3mo", "6mo", "1y", "2y", "3y", "5y", "10y", "max"].includes(range) ? range : "2y";
    const safeInterval = ["1d", "1wk", "1mo"].includes(interval) ? interval : "1d";

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(safeTicker)}?interval=${safeInterval}&range=${safeRange}`;

    const resp = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: "Yahoo error", status: resp.status, ticker: safeTicker }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    const closes: number[] = (result?.indicators?.quote?.[0]?.close || []).filter(
      (v: number | null) => v !== null
    );
    const timestamps: number[] = result?.timestamp || [];

    return new Response(
      JSON.stringify({
        ticker: safeTicker,
        closes,
        timestamps,
        count: closes.length,
      }),
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
