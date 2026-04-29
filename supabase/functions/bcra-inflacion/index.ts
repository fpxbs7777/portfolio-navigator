// Edge function: serie histórica completa de inflación mensual desde el BCRA.
// Variable 28 = IPC nacional mensual. API oficial, sin key.
// Se ejecuta server-side para evitar CORS desde el browser.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BCRADetalle {
  fecha: string;
  valor: number | null;
}

interface BCRAResponse {
  results?: Array<{
    idVariable?: number;
    descripcion?: string;
    detalle?: BCRADetalle[];
  }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "0"); // 0 = todos
    const order = (url.searchParams.get("order") ?? "desc").toLowerCase(); // desc|asc

    const r = await fetch(
      "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/28",
      { headers: { Accept: "application/json" } },
    );

    if (!r.ok) {
      return new Response(
        JSON.stringify({ error: `BCRA respondió ${r.status}`, status: r.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = (await r.json()) as BCRAResponse;
    const detalle = data.results?.[0]?.detalle ?? [];

    let serie = detalle
      .filter((d) => d.valor != null)
      .map((d) => ({
        fecha: d.fecha,
        valor: d.valor as number,
        year: new Date(d.fecha).getFullYear(),
      }));

    serie.sort((a, b) =>
      order === "asc"
        ? new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        : new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
    );

    if (limit > 0) serie = serie.slice(0, limit);

    // Métricas agregadas útiles
    const last = serie[order === "asc" ? serie.length - 1 : 0] ?? null;
    const ultimos12 = (order === "asc" ? serie.slice(-12) : serie.slice(0, 12));
    const acumulado12m = ultimos12.length
      ? (ultimos12.reduce((acc, x) => acc * (1 + x.valor / 100), 1) - 1) * 100
      : null;
    const promedio12m = ultimos12.length
      ? ultimos12.reduce((s, x) => s + x.valor, 0) / ultimos12.length
      : null;

    const years = serie.map((x) => x.year);
    const stats = serie.length
      ? {
          total: serie.length,
          firstYear: Math.min(...years),
          lastYear: Math.max(...years),
        }
      : { total: 0, firstYear: null, lastYear: null };

    return new Response(
      JSON.stringify({
        ultimo: last,
        acumulado12m: acumulado12m != null ? Number(acumulado12m.toFixed(2)) : null,
        promedio12m: promedio12m != null ? Number(promedio12m.toFixed(2)) : null,
        stats,
        serie,
        fuente: "BCRA v4.0 - Variable 28 (IPC mensual)",
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});