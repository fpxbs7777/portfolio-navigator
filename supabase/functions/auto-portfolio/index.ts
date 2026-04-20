// Edge function: orquesta análisis intermarket + sugiere sectores favorecidos + justifica con IA
// Input: { macro, profile, monto, moneda }
// Output: { sectores: [...], tickersSugeridos: [...], justificacion: string, regimen: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MacroIn {
  dolares?: { mep?: number | null; ccl?: number | null; blue?: number | null; oficial?: number | null };
  spreads?: { mep?: number | null; ccl?: number | null; blue?: number | null };
  inflacion?: { valor: number } | null;
  riesgoPais?: { valor: number } | null;
  tasaPlazoFijo?: number | null;
}

type ProfileKey =
  | "cp_conservador" | "cp_especulativo" | "conservador"
  | "mod_conservador" | "moderado" | "mod_agresivo" | "agresivo";

interface Body {
  macro: MacroIn;
  profile: ProfileKey;
  monto: number;
  moneda: "ars" | "usd";
}

// ============================================================
// REGLAS HEURÍSTICAS INTERMARKET
// ============================================================
function detectarRegimen(macro: MacroIn): {
  regimen: string;
  sectores: string[];
  tickersAR: string[];
  tickersCEDEAR: string[];
  bonos: string[];
  flags: string[];
} {
  const flags: string[] = [];
  const spreadMep = macro.spreads?.mep ?? 0;
  const inflacion = macro.inflacion?.valor ?? 0;
  const riesgoPais = macro.riesgoPais?.valor ?? 0;
  const tasa = macro.tasaPlazoFijo ?? 0;

  // Detección de régimen
  let regimen = "Mixto / sin sesgo claro";
  if (spreadMep > 30) { regimen = "Brecha cambiaria alta — cobertura USD prioritaria"; flags.push("brecha_alta"); }
  else if (spreadMep < 10) { regimen = "Brecha contenida — apetito por riesgo local"; flags.push("brecha_baja"); }

  if (inflacion > 5) flags.push("inflacion_alta");
  if (riesgoPais > 800) flags.push("riesgo_alto");
  else if (riesgoPais < 500) flags.push("riesgo_bajo");
  if (tasa > 40) flags.push("tasa_alta");

  // Sectores favorecidos según flags
  const sectores: string[] = [];
  const tickersAR: string[] = [];
  const tickersCEDEAR: string[] = [];
  const bonos: string[] = [];

  if (flags.includes("brecha_alta") || flags.includes("inflacion_alta")) {
    sectores.push("Energía (cobertura inflacionaria)", "Materiales/Commodities", "CEDEARs USD");
    tickersAR.push("YPF", "PAMP", "TXAR", "ALUA");
    tickersCEDEAR.push("AAPL", "MSFT", "GOOGL", "NVDA", "META", "AMZN");
    bonos.push("AL30", "GD30"); // hard dollar
  }
  if (flags.includes("riesgo_bajo") || flags.includes("brecha_baja")) {
    sectores.push("Bancos AR (compresión riesgo)", "Real Estate AR");
    tickersAR.push("GGAL", "BMA", "SUPV", "CRES");
    bonos.push("TX26"); // CER
  }
  if (flags.includes("tasa_alta")) {
    sectores.push("Renta Fija CER (tasa alta)");
    bonos.push("TX26", "AL30");
  }
  if (sectores.length === 0) {
    sectores.push("Diversificación amplia");
    tickersAR.push("GGAL", "YPF", "PAMP");
    tickersCEDEAR.push("AAPL", "MSFT", "SPY");
    bonos.push("AL30", "GD30");
  }

  return {
    regimen,
    sectores: [...new Set(sectores)],
    tickersAR: [...new Set(tickersAR)],
    tickersCEDEAR: [...new Set(tickersCEDEAR)],
    bonos: [...new Set(bonos)],
    flags,
  };
}

// ============================================================
// UNIVERSO ADAPTATIVO POR PERFIL
// ============================================================
function universoPorPerfil(
  profile: ProfileKey,
  intermarket: ReturnType<typeof detectarRegimen>
): { universoRV: string[]; pesoMaxRV: number; usaBonos: boolean } {
  const { tickersAR, tickersCEDEAR } = intermarket;

  switch (profile) {
    case "conservador":
      return { universoRV: tickersAR.slice(0, 3), pesoMaxRV: 0.15, usaBonos: true };
    case "mod_conservador":
      return { universoRV: [...tickersAR.slice(0, 3), ...tickersCEDEAR.slice(0, 2)], pesoMaxRV: 0.30, usaBonos: true };
    case "moderado":
      return { universoRV: [...tickersAR.slice(0, 4), ...tickersCEDEAR.slice(0, 3)], pesoMaxRV: 0.45, usaBonos: true };
    case "mod_agresivo":
      return { universoRV: [...tickersAR.slice(0, 4), ...tickersCEDEAR.slice(0, 4)], pesoMaxRV: 0.55, usaBonos: true };
    case "agresivo":
      return { universoRV: [...tickersAR, ...tickersCEDEAR], pesoMaxRV: 0.70, usaBonos: false };
    case "cp_especulativo":
      return { universoRV: tickersCEDEAR.slice(0, 6), pesoMaxRV: 1.0, usaBonos: false };
    case "cp_conservador":
      return { universoRV: [], pesoMaxRV: 0, usaBonos: true };
  }
}

// ============================================================
// HANDLER
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as Body;
    const { macro, profile, monto, moneda } = body;

    if (!profile || !monto) {
      return new Response(JSON.stringify({ error: "Faltan profile o monto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Análisis intermarket → sectores + tickers candidatos
    const intermarket = detectarRegimen(macro || {});
    const universo = universoPorPerfil(profile, intermarket);

    // 2. Justificación con Lovable AI (opcional, no bloqueante)
    let justificacion = "Análisis automático por reglas intermarket.";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (apiKey) {
      try {
        const prompt = `Sos un analista financiero argentino. Generá una justificación BREVE (máx 4 oraciones, español rioplatense) sobre por qué este escenario favorece estos sectores.

Datos macro:
- Dólar MEP: $${macro.dolares?.mep ?? "N/D"} (spread ${macro.spreads?.mep?.toFixed(1) ?? "N/D"}%)
- Inflación mensual: ${macro.inflacion?.valor ?? "N/D"}%
- Riesgo país: ${macro.riesgoPais?.valor ?? "N/D"} pb
- Tasa plazo fijo: ${macro.tasaPlazoFijo ?? "N/D"}%

Régimen detectado: ${intermarket.regimen}
Sectores favorecidos: ${intermarket.sectores.join(", ")}
Perfil del inversor: ${profile}

Justificá en lenguaje claro, sin usar markdown ni listas.`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Sos un analista financiero conciso y directo." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const txt = aiData.choices?.[0]?.message?.content;
          if (txt) justificacion = txt.trim();
        } else if (aiResp.status === 429) {
          justificacion = "Rate limit IA — usando justificación heurística. Régimen: " + intermarket.regimen;
        } else if (aiResp.status === 402) {
          justificacion = "Sin créditos IA — usando justificación heurística. Régimen: " + intermarket.regimen;
        }
      } catch (e) {
        console.error("AI error:", e);
      }
    }

    return new Response(JSON.stringify({
      regimen: intermarket.regimen,
      flags: intermarket.flags,
      sectores: intermarket.sectores,
      tickersAR: intermarket.tickersAR,
      tickersCEDEAR: intermarket.tickersCEDEAR,
      bonos: intermarket.bonos,
      universoRV: universo.universoRV,
      pesoMaxRV: universo.pesoMaxRV,
      usaBonos: universo.usaBonos,
      justificacion,
      profile,
      monto,
      moneda,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("auto-portfolio error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
