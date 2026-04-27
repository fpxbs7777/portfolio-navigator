// Edge function: trae precios live de bonos hard dollar argentinos desde ArgentinaDatos.
// Input: { tickers: string[] }  ej: { tickers: ["AL30", "GD30", "GD35"] }
// Output: { prices: { [ticker]: { price, change, volume, source, ts } } }
//
// API: https://api.argentinadatos.com/v1/finanzas/bonos
// Devuelve un array con todos los bonos cotizantes; filtramos por símbolo.

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

interface ArgDatosBond {
  simbolo?: string;
  ticker?: string;
  ultimoPrecio?: number;
  precio?: number;
  variacion?: number;
  variacionPorcentual?: number;
  volumen?: number;
  fecha?: string;
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
    const wanted = new Set(tickers.map((t) => t.toUpperCase()));

    // Endpoint principal: bonos hard dollar
    let bonos: ArgDatosBond[] = [];
    try {
      const r = await fetch("https://api.argentinadatos.com/v1/finanzas/bonos", {
        headers: { Accept: "application/json" },
      });
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) bonos = data;
      }
    } catch (e) {
      console.error("ArgentinaDatos /bonos error:", e);
    }

    for (const b of bonos) {
      const sym = (b.simbolo || b.ticker || "").toUpperCase();
      if (!wanted.has(sym)) continue;
      prices[sym] = {
        price: typeof b.ultimoPrecio === "number" ? b.ultimoPrecio
             : typeof b.precio === "number" ? b.precio : null,
        change: typeof b.variacionPorcentual === "number" ? b.variacionPorcentual
              : typeof b.variacion === "number" ? b.variacion : null,
        volume: typeof b.volumen === "number" ? b.volumen : null,
        source: "argentinadatos",
        ts: b.fecha || new Date().toISOString(),
      };
    }

    // Para los que no aparecieron, devolvemos null explícito
    for (const t of tickers) {
      const T = t.toUpperCase();
      if (!prices[T]) {
        prices[T] = { price: null, change: null, volume: null, source: "no_data", ts: new Date().toISOString() };
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