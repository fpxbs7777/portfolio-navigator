// Edge function: consulta paneles IOL usando el token Bearer.
// El token viaja en el body para no quedar en logs de URL.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mapeo: clave del UI -> { instrumento IOL, país por defecto }
const PANEL_PATHS: Record<string, { inst: string; pais: string }> = {
  cedears:                 { inst: "cedears",                 pais: "argentina" },
  acciones:                { inst: "acciones",                pais: "argentina" },
  titulosPublicos:         { inst: "titulosPublicos",         pais: "argentina" },
  obligacionesNegociables: { inst: "obligacionesNegociables", pais: "argentina" },
  cauciones:               { inst: "cauciones",               pais: "argentina" },
  adrs:                    { inst: "adrs",                    pais: "estados_unidos" },
  acciones_eeuu:           { inst: "acciones",                pais: "estados_unidos" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, panel = "cedears", pais } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token IOL requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cfg = PANEL_PATHS[panel];
    if (!cfg) {
      return new Response(
        JSON.stringify({ error: `Panel inválido: ${panel}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalPais = pais || cfg.pais;
    const url = `https://api.invertironline.com/api/v2/Cotizaciones/${cfg.inst}/${finalPais}/Todos`;

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(
        JSON.stringify({
          error: "IOL respondió con error",
          status: resp.status,
          detail: text.slice(0, 200),
        }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    return new Response(
      JSON.stringify({ titulos: data.titulos || [] }),
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
