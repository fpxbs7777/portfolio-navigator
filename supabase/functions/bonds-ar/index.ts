// Edge function: trae precios live de bonos hard dollar argentinos desde data912.com.
// Input: { tickers: string[] }  ej: { tickers: ["AL30", "GD30", "GD35"] }
// Output: { prices: { [ticker]: { price, change, volume, source, ts } } }
//
// API: https://data912.com/live/arg_bonds
// Solo se devuelven cotizaciones en USD (sufijo D = MEP, C = CCL).
// Si no existe cotización en USD para el ticker, se devuelve no_data.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BondPrice {
  price: number | null;
  change: number | null;
  volume: number | null;
  source: string;
  ts: string;
}

interface Data912Bond {
  symbol: string;
  c?: number;          // cierre / último
  px_bid?: number;
  px_ask?: number;
  v?: number;          // volumen monto
  q_op?: number;       // cantidad operada
  pct_change?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const tickers: string[] = Array.isArray(body.tickers) ? body.tickers : [];
    if (!tickers.length) {
      return new Response(JSON.stringify({ error: "Faltan tickers" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prices: Record<string, BondPrice> = {};
    const wanted = tickers.map((t) => t.toUpperCase());

    // Traemos la lista completa de bonos cotizantes
    let bonos: Data912Bond[] = [];
    try {
      const r = await fetch("https://data912.com/live/arg_bonds", {
        headers: { Accept: "application/json" },
      });
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) bonos = data;
      }
    } catch (e) {
      console.error("data912 /arg_bonds error:", e);
    }

    // Indexamos por símbolo para búsqueda O(1)
    const bySym = new Map<string, Data912Bond>();
    for (const b of bonos) {
      if (b?.symbol) bySym.set(b.symbol.toUpperCase(), b);
    }

    const ts = new Date().toISOString();
    for (const T of wanted) {
      // Solo cotización en USD (sufijo D = MEP, C = CCL).
      const usd = bySym.get(`${T}D`);
      const ccl = bySym.get(`${T}C`);

      const pick = usd || ccl || null;
      if (pick) {
        prices[T] = {
          price: typeof pick.c === "number" ? pick.c
               : typeof pick.px_bid === "number" ? pick.px_bid : null,
          change: typeof pick.pct_change === "number" ? pick.pct_change : null,
          volume: typeof pick.v === "number" ? pick.v : null,
          source: usd ? "data912_mep" : "data912_ccl",
          ts,
        };
      } else {
        prices[T] = { price: null, change: null, volume: null, source: "no_data", ts };
      }
    }

    return new Response(JSON.stringify({ prices, count: bonos.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bonds-ar error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});