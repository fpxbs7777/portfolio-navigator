// Edge function: datos macro Argentina (DolarAPI + ArgentinaDatos).
// Públicas, sin API key. Devuelve dólares, inflación, tasa BCRA y riesgo país.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DolarRate {
  casa?: string;
  nombre?: string;
  compra?: number;
  venta?: number;
  fechaActualizacion?: string;
}

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // DolarAPI: oficial, blue, mep, ccl, cripto, tarjeta, mayorista
    const dolares = await safeFetch<DolarRate[]>(
      "https://dolarapi.com/v1/dolares"
    );

    const byCasa: Record<string, { compra: number; venta: number; fecha?: string }> = {};
    if (Array.isArray(dolares)) {
      for (const d of dolares) {
        if (d.casa && d.venta != null) {
          byCasa[d.casa] = {
            compra: d.compra ?? 0,
            venta: d.venta,
            fecha: d.fechaActualizacion,
          };
        }
      }
    }

    // ArgentinaDatos: inflación mensual
    const inflacionArr = await safeFetch<Array<{ fecha: string; valor: number }>>(
      "https://api.argentinadatos.com/v1/finanzas/indices/inflacion"
    );
    const inflacionLast =
      Array.isArray(inflacionArr) && inflacionArr.length
        ? inflacionArr[inflacionArr.length - 1]
        : null;

    // ArgentinaDatos: riesgo país
    const riesgoArr = await safeFetch<Array<{ fecha: string; valor: number }>>(
      "https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais"
    );
    const riesgoLast =
      Array.isArray(riesgoArr) && riesgoArr.length
        ? riesgoArr[riesgoArr.length - 1]
        : null;

    // Tasa de plazo fijo BCRA (variable proxy)
    const tasas = await safeFetch<Array<{ entidad: string; tnaClientes: number }>>(
      "https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo"
    );
    const tasaProm =
      Array.isArray(tasas) && tasas.length
        ? tasas.reduce((s, t) => s + (t.tnaClientes || 0), 0) / tasas.length
        : null;

    const oficial = byCasa["oficial"]?.venta ?? null;
    const mep = byCasa["bolsa"]?.venta ?? null;
    const ccl = byCasa["contadoconliqui"]?.venta ?? null;
    const blue = byCasa["blue"]?.venta ?? null;
    const cripto = byCasa["cripto"]?.venta ?? null;
    const tarjeta = byCasa["tarjeta"]?.venta ?? null;
    const mayorista = byCasa["mayorista"]?.venta ?? null;

    const spread = (val: number | null) =>
      val != null && oficial ? ((val / oficial - 1) * 100) : null;

    const result = {
      dolares: {
        oficial,
        mep,
        ccl,
        blue,
        cripto,
        tarjeta,
        mayorista,
      },
      spreads: {
        mep: spread(mep),
        ccl: spread(ccl),
        blue: spread(blue),
      },
      inflacion: inflacionLast
        ? { valor: inflacionLast.valor, fecha: inflacionLast.fecha }
        : null,
      riesgoPais: riesgoLast
        ? { valor: riesgoLast.valor, fecha: riesgoLast.fecha }
        : null,
      tasaPlazoFijo: tasaProm != null ? Number(tasaProm.toFixed(2)) : null,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
