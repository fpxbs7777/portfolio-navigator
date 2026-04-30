import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  calcScoreSalud,
  mapYFTicker,
  scoreClass,
  engineAllocations,
  PANEL_LABELS,
  calcBuckets,
  calcCAPM,
  runMarkowitz,
  interpretBeta,
  interpretCorrel,
  interpretBeatRate,
  type PanelTitulo,
  type YFInfo,
  type MarkowitzStrat,
} from "@/data/portfolioEngine";
import type { ProfileKey } from "@/data/iolData";
import { profiles } from "@/data/iolData";
import { cn } from "@/lib/utils";
import {
  Lock,
  Activity,
  Sparkles,
  Loader2,
  Search,
  TrendingUp,
  DollarSign,
  Target,
  BarChart3,
  Calculator,
  PieChart,
  FileText,
  Download,
  Wand2,
  CheckCircle2,
} from "lucide-react";

interface PortfolioEngineProps {
  selectedProfile: ProfileKey;
  onProfileChange: (key: ProfileKey) => void;
}

type Panel = "cedears" | "acciones" | "titulosPublicos" | "obligacionesNegociables" | "cauciones" | "adrs" | "acciones_eeuu";
type StatusColor = "neutral" | "amber" | "green" | "red";
type Tab = "auto" | "auth" | "macro" | "perfil" | "panel" | "fund" | "capm" | "markowitz" | "eps" | "portfolio";

interface Enriched extends PanelTitulo {
  yfTicker: string;
  info: YFInfo | null;
  score: number;
  detalle: Record<string, string>;
}

interface MacroData {
  dolares: { oficial: number | null; mep: number | null; ccl: number | null; blue: number | null; cripto: number | null; tarjeta: number | null; mayorista: number | null };
  spreads: { mep: number | null; ccl: number | null; blue: number | null };
  inflacion: { valor: number; fecha: string } | null;
  riesgoPais: { valor: number; fecha: string } | null;
  tasaPlazoFijo: number | null;
}

interface CAPMState {
  beta: number; alpha: number; alphaAnual: number; correl: number; r2: number; n: number;
  ticker: string; benchmark: string;
}

interface MarkowitzState {
  tickers: string[]; weights: number[]; annReturns: number[]; annVols: number[];
  portReturn: number; portVol: number; sharpe: number; maxDD: number; strategy: MarkowitzStrat;
}

interface EpsRow {
  ticker: string;
  beatRate: number | null;
  avgSurprise: number | null;
  nextDate: string | null;
  epsEst: number | null;
  quarters: number;
  error?: string;
}

const TABS: { key: Tab; label: string; icon: typeof Lock }[] = [
  { key: "auto",       label: "Auto-Portfolio",  icon: Wand2 },
  { key: "auth",       label: "Auth IOL",        icon: Lock },
  { key: "macro",      label: "Macro AR",        icon: TrendingUp },
  { key: "perfil",     label: "Perfil + Buckets",icon: Sparkles },
  { key: "panel",      label: "Panel IOL",       icon: Activity },
  { key: "fund",       label: "Fundamentales",   icon: Search },
  { key: "capm",       label: "CAPM / Beta",     icon: BarChart3 },
  { key: "markowitz",  label: "Markowitz",       icon: PieChart },
  { key: "eps",        label: "EPS",             icon: Calculator },
  { key: "portfolio",  label: "Portfolio Final", icon: FileText },
];

export const PortfolioEngine = ({ selectedProfile, onProfileChange }: PortfolioEngineProps) => {
  const [tab, setTab] = useState<Tab>("auto");

  // Auth
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState({
    msg: "Sistema listo. Comenzá con Auth IOL o consultá Macro AR directamente.",
    color: "neutral" as StatusColor,
  });

  // Macro
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [macroLoading, setMacroLoading] = useState(false);

  // Perfil + Buckets
  const [moneda, setMoneda] = useState<"ars" | "usd">("ars");
  const [monto, setMonto] = useState<string>("");

  // Panel
  const [panel, setPanel] = useState<Panel>("cedears");
  const [topN, setTopN] = useState(20);
  const [filVar, setFilVar] = useState<"all" | "pos" | "neg">("all");
  const [ordBy, setOrdBy] = useState<"var" | "precio" | "vol">("var");
  const [panelData, setPanelData] = useState<PanelTitulo[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  // Fundamentales
  const [minScore, setMinScore] = useState(60);
  const [analyzing, setAnalyzing] = useState(false);
  const [enriched, setEnriched] = useState<Enriched[]>([]);
  const [yfTicker, setYfTicker] = useState("");
  const [yfResult, setYfResult] = useState<{ info: YFInfo; score: number; detalle: Record<string, string>; ticker: string } | null>(null);
  const [yfLoading, setYfLoading] = useState(false);

  // CAPM
  const [capmTicker, setCapmTicker] = useState("");
  const [capmBench, setCapmBench] = useState("^SPX");
  const [capmResult, setCapmResult] = useState<CAPMState | null>(null);
  const [capmLoading, setCapmLoading] = useState(false);

  // Markowitz
  const [mkUniverse, setMkUniverse] = useState("GGAL,BMA,YPF,PAMP,CEPU,TXAR,ALUA,CRES");
  const [mkStrat, setMkStrat] = useState<MarkowitzStrat>("markowitz");
  const [mkRf, setMkRf] = useState("32");
  const [mkPeriod, setMkPeriod] = useState<"1y" | "2y" | "3y" | "5y">("2y");
  const [mkResult, setMkResult] = useState<MarkowitzState | null>(null);
  const [mkLoading, setMkLoading] = useState(false);

  // EPS
  const [epsTickers, setEpsTickers] = useState("JPM,GGAL,MELI,TSLA,MSFT");
  const [epsResults, setEpsResults] = useState<EpsRow[]>([]);
  const [epsLoading, setEpsLoading] = useState(false);

  // Auto-Portfolio
  const [autoMonto, setAutoMonto] = useState<string>("");
  const [autoMoneda, setAutoMoneda] = useState<"ars" | "usd">("ars");
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoStep, setAutoStep] = useState<{ idx: number; label: string }[]>([]);
  const [autoResult, setAutoResult] = useState<{
    regimen: string;
    flags: string[];
    sectores: string[];
    justificacion: string;
    universoRV: string[];
    pesoMaxRV: number;
    enriched: Enriched[];
    weights: { ticker: string; weight: number; monto: number }[];
    sharpe: number;
    portReturn: number;
    portVol: number;
    bonos: string[];
    montoRV: number;
    montoRF: number;
    montoCau: number;
    montoEf: number;
  } | null>(null);

  const allocation = engineAllocations[selectedProfile];
  const setMsg = (msg: string, color: StatusColor = "neutral") => setStatus({ msg, color });

  // ============================================================
  // Handlers
  // ============================================================
  const autenticar = async () => {
    if (!user || !pass) { setMsg("Ingresá usuario y contraseña.", "amber"); return; }
    setMsg("Autenticando con IOL…", "amber");
    const { data, error } = await supabase.functions.invoke("iol-auth", {
      body: { username: user, password: pass },
    });
    if (error || !data?.access_token) {
      setMsg(`Error IOL: ${data?.error || error?.message || "credenciales inválidas"}`, "red");
      return;
    }
    setToken(data.access_token);
    setMsg("Conectado a IOL. Token activo.", "green");
  };

  const cargarMacro = async () => {
    setMacroLoading(true);
    setMsg("Cargando datos macro Argentina…", "amber");
    const { data, error } = await supabase.functions.invoke("macro-ar", { body: {} });
    setMacroLoading(false);
    if (error || !data) {
      setMsg(`Error macro: ${error?.message || "respuesta vacía"}`, "red");
      return;
    }
    setMacro(data as MacroData);
    setMsg("Macro actualizado: dólares + inflación + riesgo país.", "green");
  };

  const cargarPanel = async () => {
    setPanelLoading(true);
    setPanelData([]);
    setEnriched([]);
    setMsg(`Cargando panel: ${PANEL_LABELS[panel]}…`, "amber");

    let titulos: PanelTitulo[] = [];
    if (!token) {
      setPanelLoading(false);
      setMsg("Necesitás conectar IOL para cargar paneles. No hay datos de ejemplo.", "red");
      return;
    }
    const { data, error } = await supabase.functions.invoke("iol-panel", {
      body: { token, panel },
    });
    if (error || !data?.titulos) {
      setPanelLoading(false);
      setMsg(`Error IOL: ${error?.message || data?.error || "respuesta vacía"}`, "red");
      return;
    }
    titulos = data.titulos;

    let fil = titulos.filter((t) => {
      if (filVar === "pos") return (t.variacionPorcentual || 0) >= 0;
      if (filVar === "neg") return (t.variacionPorcentual || 0) < 0;
      return true;
    });

    fil.sort((a, b) => {
      if (ordBy === "var") return Math.abs(b.variacionPorcentual || 0) - Math.abs(a.variacionPorcentual || 0);
      if (ordBy === "precio") return (b.ultimoPrecio || 0) - (a.ultimoPrecio || 0);
      return (b.volumenNominal || b.volumen || 0) - (a.volumenNominal || a.volumen || 0);
    });

    fil = fil.slice(0, topN);
    setPanelData(fil);
    setPanelLoading(false);
    setMsg(`Panel ${PANEL_LABELS[panel]} cargado: ${fil.length} activos.`, "green");
  };

  const enriquecerFundamentales = async () => {
    if (!panelData.length) { setMsg("Primero cargá un panel en el tab 'Panel IOL'.", "amber"); return; }
    setAnalyzing(true);
    setEnriched([]);
    const out: Enriched[] = [];
    for (let i = 0; i < panelData.length; i++) {
      const t = panelData[i];
      setMsg(`Analizando ${i + 1}/${panelData.length}: ${t.simbolo}…`, "amber");
      const yfTickerMapped = mapYFTicker(t.simbolo || "");
      const { data } = await supabase.functions.invoke("yfinance-info", {
        body: { ticker: yfTickerMapped },
      });
      const info: YFInfo | null = data?.info || null;
      const { score, detalle } = calcScoreSalud(info);
      out.push({ ...t, yfTicker: yfTickerMapped, info, score, detalle });
      await new Promise((r) => setTimeout(r, 200));
    }
    out.sort((a, b) => b.score - a.score);
    setEnriched(out);
    setAnalyzing(false);
    setMsg(`Fundamentales: ${out.length} activos analizados.`, "green");
  };

  const consultarYF = async () => {
    const t = yfTicker.trim().toUpperCase();
    if (!t) return;
    setYfLoading(true);
    setYfResult(null);
    const { data } = await supabase.functions.invoke("yfinance-info", { body: { ticker: t } });
    setYfLoading(false);
    if (!data?.info) { setMsg(`Sin datos para ${t}`, "red"); return; }
    const { score, detalle } = calcScoreSalud(data.info);
    setYfResult({ info: data.info, score, detalle, ticker: data.ticker || t });
    setMsg(`${t} analizado. Score: ${score}/100`, "green");
  };

  const calcCAPMHandler = async () => {
    const sec = capmTicker.trim().toUpperCase();
    if (!sec) { setMsg("Ingresá un ticker para CAPM.", "amber"); return; }
    setCapmLoading(true);
    setCapmResult(null);
    setMsg(`Calculando CAPM: ${sec} vs ${capmBench}…`, "amber");
    const [secResp, bmResp] = await Promise.all([
      supabase.functions.invoke("yf-history", { body: { ticker: sec, range: "2y" } }),
      supabase.functions.invoke("yf-history", { body: { ticker: capmBench, range: "2y" } }),
    ]);
    setCapmLoading(false);
    if (secResp.error || bmResp.error || !secResp.data?.closes || !bmResp.data?.closes) {
      setMsg("Error descargando históricos.", "red");
      return;
    }
    const r = calcCAPM(secResp.data.closes, bmResp.data.closes);
    if (!r) { setMsg("Insuficiente historial para CAPM.", "red"); return; }
    setCapmResult({ ...r, ticker: sec, benchmark: capmBench });
    setMsg(`CAPM: β=${r.beta.toFixed(3)} | r²=${(r.r2 * 100).toFixed(1)}%`, "green");
  };

  const calcMarkowitzHandler = async () => {
    const universe = mkUniverse.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (universe.length < 2) { setMsg("Ingresá al menos 2 tickers.", "amber"); return; }
    setMkLoading(true);
    setMkResult(null);
    setMsg(`Descargando históricos para ${universe.length} activos…`, "amber");

    const series: Record<string, number[]> = {};
    for (const tick of universe) {
      const isAR = !tick.includes(".") && !tick.startsWith("^");
      const yfT = isAR ? `${tick}.BA` : tick;
      const { data } = await supabase.functions.invoke("yf-history", {
        body: { ticker: yfT, range: mkPeriod },
      });
      const closes: number[] = data?.closes || [];
      if (closes.length > 5) {
        const rets: number[] = [];
        for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
        series[tick] = rets;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    const rfDaily = parseFloat(mkRf) / 100 / 252;
    const result = runMarkowitz(series, mkStrat, rfDaily);
    setMkLoading(false);
    if (!result) { setMsg("No se pudieron descargar suficientes activos.", "red"); return; }
    setMkResult(result);
    setMsg(`Markowitz (${result.strategy}): ret=${(result.portReturn * 100).toFixed(1)}% | Sharpe=${result.sharpe.toFixed(2)}`, "green");
  };

  const runEpsHandler = async () => {
    const tickers = epsTickers.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!tickers.length) { setMsg("Ingresá tickers para EPS.", "amber"); return; }
    setEpsLoading(true);
    setEpsResults([]);
    setMsg(`Auditando EPS: ${tickers.join(", ")}…`, "amber");
    const out: EpsRow[] = [];
    for (const tick of tickers) {
      const { data, error } = await supabase.functions.invoke("yf-earnings", { body: { ticker: tick } });
      if (error || !data) {
        out.push({ ticker: tick, beatRate: null, avgSurprise: null, nextDate: null, epsEst: null, quarters: 0, error: error?.message || "Sin datos" });
      } else {
        out.push({
          ticker: tick,
          beatRate: data.beatRate,
          avgSurprise: data.avgSurprise,
          nextDate: data.nextDate,
          epsEst: data.epsEst,
          quarters: data.quarters || 0,
        });
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    setEpsResults(out);
    setEpsLoading(false);
    setMsg(`EPS Engine: ${out.length} activos auditados.`, "green");
  };

  // ============================================================
  // AUTO-PORTFOLIO: orquestador end-to-end
  // ============================================================
  const generarAutoPortfolio = async () => {
    const montoNum = parseFloat(autoMonto);
    if (!montoNum || montoNum <= 0) {
      setMsg("Ingresá un monto válido para generar el portfolio.", "amber");
      return;
    }
    setAutoLoading(true);
    setAutoResult(null);
    setAutoStep([]);
    const pushStep = (label: string) =>
      setAutoStep((prev) => [...prev, { idx: prev.length + 1, label }]);

    try {
      // PASO 1: Macro
      pushStep("Cargando datos macro Argentina (dólares, inflación, riesgo país)…");
      const macroResp = await supabase.functions.invoke("macro-ar", { body: {} });
      const macroData = (macroResp.data as MacroData) || null;
      if (macroData) setMacro(macroData);

      // PASO 2: Análisis intermarket + IA
      pushStep("Analizando régimen intermarket y detectando sectores favorecidos…");
      const autoResp = await supabase.functions.invoke("auto-portfolio", {
        body: { macro: macroData, profile: selectedProfile, monto: montoNum, moneda: autoMoneda },
      });
      if (autoResp.error || !autoResp.data) {
        throw new Error(autoResp.error?.message || "Falló análisis intermarket");
      }
      const intermarket = autoResp.data as {
        regimen: string; flags: string[]; sectores: string[]; tickersAR: string[];
        tickersCEDEAR: string[]; bonos: string[]; universoRV: string[];
        pesoMaxRV: number; usaBonos: boolean; justificacion: string;
      };

      // PASO 3: Enriquecer universo con yFinance
      const universo = intermarket.universoRV;
      pushStep(`Analizando ${universo.length} candidatos con yFinance…`);
      const enrichedOut: Enriched[] = [];
      for (const sym of universo) {
        const yfT = mapYFTicker(sym);
        const { data } = await supabase.functions.invoke("yfinance-info", { body: { ticker: yfT } });
        const info: YFInfo | null = data?.info || null;
        const { score, detalle } = calcScoreSalud(info);
        enrichedOut.push({
          simbolo: sym, ultimoPrecio: info?.currentPrice || 0, variacionPorcentual: 0,
          yfTicker: yfT, info, score, detalle,
        });
        await new Promise((r) => setTimeout(r, 150));
      }
      enrichedOut.sort((a, b) => b.score - a.score);

      // PASO 4: Optimización Markowitz Max-Sharpe sobre top candidatos
      const topCandidatos = enrichedOut.filter((e) => e.score >= 40).slice(0, 6);
      let weights: { ticker: string; weight: number; monto: number }[] = [];
      let sharpe = 0, portReturn = 0, portVol = 0;

      const allocLocal = engineAllocations[selectedProfile];
      const pctRV = allocLocal.rv + allocLocal.cedears;
      const montoRV = (montoNum * pctRV) / 100;
      const montoRF = (montoNum * allocLocal.rf) / 100;
      const montoCau = (montoNum * allocLocal.cau) / 100;
      const montoEf = (montoNum * allocLocal.ef) / 100;

      if (topCandidatos.length >= 2) {
        pushStep(`Optimizando pesos con Markowitz Max-Sharpe sobre ${topCandidatos.length} activos…`);
        const series: Record<string, number[]> = {};
        for (const c of topCandidatos) {
          const { data } = await supabase.functions.invoke("yf-history", {
            body: { ticker: c.yfTicker, range: "2y" },
          });
          const closes: number[] = data?.closes || [];
          if (closes.length > 5) {
            const rets: number[] = [];
            for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
            series[c.simbolo] = rets;
          }
          await new Promise((r) => setTimeout(r, 120));
        }
        const rfDaily = (macroData?.tasaPlazoFijo || 32) / 100 / 252;
        const mk = runMarkowitz(series, "markowitz", rfDaily);
        if (mk) {
          weights = mk.tickers.map((t, i) => ({
            ticker: t,
            weight: mk.weights[i],
            monto: montoRV * mk.weights[i],
          }));
          sharpe = mk.sharpe;
          portReturn = mk.portReturn;
          portVol = mk.portVol;
        }
      } else {
        pushStep("Activos insuficientes — usando pesos equiponderados");
        const n = topCandidatos.length || 1;
        weights = topCandidatos.map((c) => ({
          ticker: c.simbolo, weight: 1 / n, monto: montoRV / n,
        }));
      }

      pushStep("✓ Portfolio generado con éxito");

      setAutoResult({
        regimen: intermarket.regimen,
        flags: intermarket.flags,
        sectores: intermarket.sectores,
        justificacion: intermarket.justificacion,
        universoRV: universo,
        pesoMaxRV: intermarket.pesoMaxRV,
        enriched: enrichedOut,
        weights,
        sharpe,
        portReturn,
        portVol,
        bonos: intermarket.bonos,
        montoRV, montoRF, montoCau, montoEf,
      });
      setMonto(autoMonto);
      setMoneda(autoMoneda);
      setEnriched(enrichedOut);
      setMsg(`Auto-Portfolio listo. Sharpe estimado: ${sharpe.toFixed(2)}`, "green");
    } catch (e) {
      setMsg(`Error en Auto-Portfolio: ${e instanceof Error ? e.message : "desconocido"}`, "red");
    } finally {
      setAutoLoading(false);
    }
  };

  const exportarCSV = () => {
    if (!enriched.length) return;
    const rows = [
      ["Simbolo", "Ticker_YF", "Precio", "Var%", "Score", "PE", "ROE", "DE", "CR", "Margen", "Sector"],
      ...enriched.map((d) => [
        d.simbolo,
        d.yfTicker,
        String(d.ultimoPrecio || ""),
        String(d.variacionPorcentual || ""),
        String(d.score),
        String(d.info?.trailingPE ?? ""),
        d.info?.returnOnEquity != null ? (d.info.returnOnEquity * 100).toFixed(2) : "",
        String(d.info?.debtToEquity ?? ""),
        String(d.info?.currentRatio ?? ""),
        d.info?.profitMargins != null ? (d.info.profitMargins * 100).toFixed(2) : "",
        d.info?.sector || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio_etr_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================
  // Derivados
  // ============================================================
  const buckets = monto && parseFloat(monto) > 0
    ? calcBuckets(allocation, parseFloat(monto))
    : null;

  const topActivos = enriched.filter((d) => d.score >= 60).slice(0, 8);
  const watchlist = enriched.filter((d) => d.score >= 40 && d.score < 60).slice(0, 4);
  const fundFiltered = enriched.filter((d) => d.score >= minScore);

  const dotColor = {
    neutral: "bg-muted-foreground",
    amber: "bg-accent",
    green: "bg-success",
    red: "bg-destructive",
  }[status.color];

  const monedaSym = moneda === "usd" ? "USD" : "ARS";
  const fmtMoney = (n: number) =>
    `${monedaSym} ${Math.round(n).toLocaleString("es-AR")}`;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 pb-3 border-b border-border/60">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-smooth",
              tab === key
                ? "bg-primary text-primary-foreground shadow-warm"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/60 border border-border/60">
        <div className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
        <span className="text-sm text-muted-foreground">{status.msg}</span>
      </div>

      {/* TAB: AUTO-PORTFOLIO */}
      {tab === "auto" && (
        <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium mb-4">
            <Wand2 className="w-3.5 h-3.5" /> Generador automático de portafolio
          </div>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Un solo clic ejecuta el flujo completo: análisis intermarket macro → detección de sectores favorecidos →
            mapeo de tickers candidatos según tu perfil → análisis fundamental con yFinance →
            optimización Markowitz Max-Sharpe → composición final lista para operar.
          </p>

          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Perfil</label>
              <select
                value={selectedProfile}
                onChange={(e) => onProfileChange(e.target.value as ProfileKey)}
                className="w-full h-11 rounded-lg bg-background border border-border px-3 text-sm"
              >
                {(Object.keys(profiles) as ProfileKey[]).map((k) => (
                  <option key={k} value={k}>{profiles[k].name}</option>
                ))}
              </select>
            </div>
            <Input
              type="number" placeholder="Monto a invertir"
              value={autoMonto} onChange={(e) => setAutoMonto(e.target.value)}
              className="h-11 rounded-lg"
            />
            <select
              value={autoMoneda}
              onChange={(e) => setAutoMoneda(e.target.value as "ars" | "usd")}
              className="h-11 rounded-lg bg-background border border-border px-3 text-sm"
            >
              <option value="ars">ARS</option>
              <option value="usd">USD</option>
            </select>
          </div>

          <Button
            onClick={generarAutoPortfolio}
            disabled={autoLoading || !autoMonto}
            className="w-full h-12 rounded-lg bg-primary hover:bg-primary/90 text-base"
          >
            {autoLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando portfolio…</>
            ) : (
              <><Wand2 className="w-4 h-4 mr-2" /> Generar portfolio automático</>
            )}
          </Button>

          {/* Pasos en vivo */}
          {autoStep.length > 0 && (
            <Card className="p-4 mt-5 bg-secondary/40 border-border/60">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Proceso</div>
              <div className="space-y-2">
                {autoStep.map((s, i) => {
                  const isLast = i === autoStep.length - 1;
                  const isDone = !isLast || !autoLoading;
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      ) : (
                        <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
                      )}
                      <span className={cn(isDone ? "text-foreground" : "text-muted-foreground")}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Resultado */}
          {autoResult && (
            <div className="mt-5 space-y-4">
              {/* Régimen + justificación */}
              <Card className="p-5 bg-gradient-paper border-accent/30">
                <div className="text-[10px] uppercase tracking-widest text-accent font-medium mb-2">Régimen intermarket</div>
                <h4 className="font-serif text-lg text-foreground mb-2">{autoResult.regimen}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{autoResult.justificacion}</p>
                <div className="flex flex-wrap gap-1.5">
                  {autoResult.sectores.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded-full bg-accent-soft text-accent-foreground text-[11px]">
                      {s}
                    </span>
                  ))}
                </div>
              </Card>

              {/* Composición final */}
              <Card className="p-5 border-border/60">
                <h4 className="font-serif text-base text-foreground mb-1">Composición final sugerida</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Perfil {profiles[selectedProfile].name} · {autoMoneda.toUpperCase()} {Math.round(parseFloat(autoMonto)).toLocaleString("es-AR")}
                </p>

                {/* Bloques por clase */}
                <div className="space-y-3">
                  {autoResult.weights.length > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span className="uppercase tracking-wider">Renta Variable (Markowitz Max-Sharpe)</span>
                        <span className="tabular-nums">{autoMoneda.toUpperCase()} {Math.round(autoResult.montoRV).toLocaleString("es-AR")}</span>
                      </div>
                      {autoResult.weights.map((w) => (
                        <div key={w.ticker} className="flex items-center gap-3 py-1.5 border-b border-border/40">
                          <TickerBadge symbol={w.ticker} />
                          <Progress value={w.weight * 100} className="flex-1 h-1.5" />
                          <span className="font-medium tabular-nums text-sm w-20 text-right">
                            {(w.weight * 100).toFixed(1)}%
                          </span>
                          <span className="font-mono tabular-nums text-xs text-muted-foreground w-24 text-right">
                            {Math.round(w.monto).toLocaleString("es-AR")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {autoResult.bonos.length > 0 && autoResult.montoRF > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-2 mt-3">
                        <span className="uppercase tracking-wider">Renta Fija sugerida</span>
                        <span className="tabular-nums">{autoMoneda.toUpperCase()} {Math.round(autoResult.montoRF).toLocaleString("es-AR")}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {autoResult.bonos.map((b) => (
                          <span key={b} className="px-2.5 py-1 rounded-md bg-secondary text-foreground text-xs font-mono border border-border">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {autoResult.montoCau > 0 && (
                    <div className="flex justify-between text-sm py-2 border-t border-border/40 mt-3">
                      <span className="text-muted-foreground">Cauciones</span>
                      <span className="tabular-nums font-medium">{autoMoneda.toUpperCase()} {Math.round(autoResult.montoCau).toLocaleString("es-AR")}</span>
                    </div>
                  )}
                  {autoResult.montoEf > 0 && (
                    <div className="flex justify-between text-sm py-2 border-t border-border/40">
                      <span className="text-muted-foreground">Efectivo / liquidez</span>
                      <span className="tabular-nums font-medium">{autoMoneda.toUpperCase()} {Math.round(autoResult.montoEf).toLocaleString("es-AR")}</span>
                    </div>
                  )}
                </div>

                {/* Métricas portfolio */}
                {autoResult.sharpe > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-border/40">
                    <div className="text-center bg-secondary/40 rounded-lg p-2">
                      <div className="font-serif text-lg tabular-nums text-foreground">{(autoResult.portReturn * 100).toFixed(1)}%</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Retorno anual est.</div>
                    </div>
                    <div className="text-center bg-secondary/40 rounded-lg p-2">
                      <div className="font-serif text-lg tabular-nums text-foreground">{(autoResult.portVol * 100).toFixed(1)}%</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Volatilidad</div>
                    </div>
                    <div className="text-center bg-primary-soft rounded-lg p-2">
                      <div className="font-serif text-lg tabular-nums text-primary">{autoResult.sharpe.toFixed(2)}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Sharpe ratio</div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Detalle activos analizados */}
              {autoResult.enriched.length > 0 && (
                <Card className="p-5 border-border/60">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                    Activos analizados ({autoResult.enriched.length}) — ordenados por score ETR
                  </div>
                  <div className="space-y-1.5">
                    {autoResult.enriched.map((e) => (
                      <div key={e.simbolo} className="flex items-center justify-between py-1.5 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <TickerBadge symbol={e.simbolo} />
                          <span className="text-xs text-muted-foreground">{e.info?.sector || "—"}</span>
                        </div>
                        <ScorePill score={e.score} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </Card>
      )}

      {/* TAB: AUTH IOL */}
      {tab === "auth" && (
        <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium mb-4">
            <Lock className="w-3.5 h-3.5" /> Credenciales InvertirOnLine
          </div>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <Input placeholder="Usuario IOL (email)" value={user} onChange={(e) => setUser(e.target.value)} className="h-11 rounded-lg" />
            <Input type="password" placeholder="Contraseña IOL" value={pass} onChange={(e) => setPass(e.target.value)} className="h-11 rounded-lg" />
          </div>
          <Button onClick={autenticar} className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90">
            {token ? "Reconectar a IOL" : "Conectar con IOL →"}
          </Button>
          <p className="text-[11px] text-muted-foreground mt-3">
            🔒 Tus credenciales viajan a través de un edge function seguro. La conexión a IOL es obligatoria para cargar paneles; el resto del motor usa APIs públicas en vivo (Macro AR, yFinance, CAPM, Markowitz, EPS).
          </p>

          <div className="mt-6 grid md:grid-cols-3 gap-3">
            <ModuleCard title="IOL API"           desc="CEDEARs · Bonos · ONs · Acciones · Cauciones · ADRs · Acc. EE.UU" />
            <ModuleCard title="yFinance"          desc="P/E · ROE · D/E · Liquidez · Margen · Beta · Analistas · Earnings" />
            <ModuleCard title="Macro AR"          desc="Dólares (MEP/CCL/Blue) · Inflación · Tasa BCRA · Riesgo país" />
            <ModuleCard title="CAPM"              desc="Beta · Alpha · Correlación · R² (vs SPX/MERVAL)" />
            <ModuleCard title="Markowitz"         desc="Max Sharpe · Min-Var · HRP · Equal Weight" />
            <ModuleCard title="EPS Engine"        desc="Beat rate · Sorpresa · Próx. earnings · EPS estimado" />
          </div>
        </Card>
      )}

      {/* TAB: MACRO AR */}
      {tab === "macro" && (
        <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium">
              <DollarSign className="w-3.5 h-3.5" /> Datos macro Argentina en tiempo real
            </div>
            <Button onClick={cargarMacro} disabled={macroLoading} variant="outline" size="sm" className="rounded-full">
              {macroLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Actualizar →"}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <MacroCell label="Dólar MEP"      value={macro?.dolares.mep}      prefix="$" />
            <MacroCell label="Dólar CCL"      value={macro?.dolares.ccl}      prefix="$" />
            <MacroCell label="Dólar Blue"     value={macro?.dolares.blue}     prefix="$" />
            <MacroCell label="Dólar Oficial"  value={macro?.dolares.oficial}  prefix="$" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <MacroCell label="Dólar Cripto"   value={macro?.dolares.cripto}   prefix="$" />
            <MacroCell label="Dólar Tarjeta"  value={macro?.dolares.tarjeta}  prefix="$" />
            <MacroCell label="Tasa Plazo Fijo (TNA)" value={macro?.tasaPlazoFijo}  suffix="%" decimals={2} />
            <MacroCell label="Inflación mensual"     value={macro?.inflacion?.valor} suffix="%" decimals={1} />
          </div>

          {macro && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 mt-6">Spreads cambiarios</div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <MacroCell label="Brecha MEP vs Oficial"  value={macro.spreads.mep}  suffix="%" decimals={1} />
                <MacroCell label="Brecha CCL vs Oficial"  value={macro.spreads.ccl}  suffix="%" decimals={1} />
                <MacroCell label="Brecha Blue vs Oficial" value={macro.spreads.blue} suffix="%" decimals={1} />
              </div>

              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Riesgo país</div>
              <div className="grid grid-cols-2 gap-3">
                <MacroCell label="Riesgo país (puntos)" value={macro.riesgoPais?.valor} decimals={0} />
                <MacroCell label="Mayorista" value={macro.dolares.mayorista} prefix="$" />
              </div>
            </>
          )}
        </Card>
      )}

      {/* TAB: PERFIL + BUCKETS */}
      {tab === "perfil" && (
        <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium">
              <Sparkles className="w-3.5 h-3.5" /> Asignación estratégica · {profiles[selectedProfile].name}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 md:gap-3 mb-5">
            {[
              { v: allocation.rv,      l: "Renta Variable" },
              { v: allocation.cedears, l: "CEDEARs SPY/DJ" },
              { v: allocation.rf,      l: "Renta Fija" },
              { v: allocation.cau,     l: "Cauciones" },
              { v: allocation.ef,      l: "Efectivo" },
            ].map((c, i) => (
              <div key={i} className="bg-secondary/50 rounded-lg p-3 text-center border border-border/40">
                <div className="font-serif text-xl md:text-2xl text-foreground tabular-nums">{c.v}%</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 leading-tight">{c.l}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{allocation.desc}</p>

          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Monto a invertir</div>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as "ars" | "usd")}
              className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm"
            >
              <option value="ars">ARS</option>
              <option value="usd">USD</option>
            </select>
            <Input
              type="number"
              placeholder="Ej: 1000000"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="h-11 rounded-lg"
            />
          </div>

          {buckets && (
            <Card className="mt-5 p-5 bg-accent-soft/40 border-accent/30">
              <h4 className="font-serif text-lg text-foreground mb-3">
                Distribución de {fmtMoney(parseFloat(monto))} — {allocation.label}
              </h4>
              {buckets.map((b, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-border/40 text-sm">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className="font-medium tabular-nums">{b.pct}% · {fmtMoney(b.monto)}</span>
                </div>
              ))}
            </Card>
          )}
        </Card>
      )}

      {/* TAB: PANEL IOL */}
      {tab === "panel" && (
        <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium mb-4">
            <Activity className="w-3.5 h-3.5" /> Seleccionar panel IOL
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {(Object.keys(PANEL_LABELS) as Panel[]).map((p) => (
              <button
                key={p}
                onClick={() => setPanel(p)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-smooth",
                  panel === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-accent-soft hover:text-foreground"
                )}
              >
                {PANEL_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <SelectField label="Top N" value={String(topN)} onChange={(v) => setTopN(Number(v))} options={[["10","Top 10"],["20","Top 20"],["50","Top 50"],["100","Top 100"]]} />
            <SelectField label="Filtro variación" value={filVar} onChange={(v) => setFilVar(v as typeof filVar)} options={[["all","Todos"],["pos","Solo +"],["neg","Solo -"]]} />
            <SelectField label="Ordenar por" value={ordBy} onChange={(v) => setOrdBy(v as typeof ordBy)} options={[["var","Variación %"],["precio","Precio"],["vol","Volumen"]]} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <Button onClick={() => cargarPanel()} disabled={panelLoading || !token} className="flex-1 h-11 rounded-full bg-primary hover:bg-primary/90">
              {panelLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cargando…</> : "Cargar panel IOL →"}
            </Button>
          </div>

          {panelData.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Total activos" value={panelData.length} />
                <Stat label="Sube" value={panelData.filter((t) => (t.variacionPorcentual || 0) >= 0).length} variant="success" />
                <Stat label="Baja" value={panelData.filter((t) => (t.variacionPorcentual || 0) < 0).length} variant="destructive" />
                <Stat label="Top vol." value={panelData.slice().sort((a, b) => (b.volumenNominal || b.volumen || 0) - (a.volumenNominal || a.volumen || 0))[0]?.simbolo || "—"} />
              </div>

              <div className="overflow-x-auto -mx-6 md:-mx-8">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 px-6 md:px-8">#</th>
                      <th className="pb-3 px-2">Símbolo</th>
                      <th className="pb-3 px-2 text-right">Último</th>
                      <th className="pb-3 px-2 text-right">Var %</th>
                      <th className="pb-3 px-2 text-right">Comp</th>
                      <th className="pb-3 px-2 text-right">Venta</th>
                      <th className="pb-3 px-6 md:px-8 text-right">Volumen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelData.map((t, i) => {
                      const vp = t.variacionPorcentual || 0;
                      return (
                        <tr key={`${t.simbolo}-${i}`} className="border-b border-border/40 hover:bg-secondary/40">
                          <td className="py-3 px-6 md:px-8 text-muted-foreground tabular-nums">{i + 1}</td>
                          <td className="py-3 px-2"><TickerBadge symbol={t.simbolo} /></td>
                          <td className="py-3 px-2 text-right tabular-nums">${(t.ultimoPrecio || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className={cn("py-3 px-2 text-right tabular-nums font-medium", vp >= 0 ? "text-success" : "text-destructive")}>
                            {vp >= 0 ? "+" : ""}{vp.toFixed(2)}%
                          </td>
                          <td className="py-3 px-2 text-right text-muted-foreground tabular-nums">{t.puntas?.precioCompra ? `$${t.puntas.precioCompra.toLocaleString("es-AR", { maximumFractionDigits: 2 })}` : "—"}</td>
                          <td className="py-3 px-2 text-right text-muted-foreground tabular-nums">{t.puntas?.precioVenta ? `$${t.puntas.precioVenta.toLocaleString("es-AR", { maximumFractionDigits: 2 })}` : "—"}</td>
                          <td className="py-3 px-6 md:px-8 text-right text-muted-foreground tabular-nums">{(t.volumenNominal || t.volumen || 0).toLocaleString("es-AR")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* TAB: FUNDAMENTALES */}
      {tab === "fund" && (
        <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium mb-4">
            <Search className="w-3.5 h-3.5" /> Análisis fundamental — yFinance
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <SelectField label="Score mínimo" value={String(minScore)} onChange={(v) => setMinScore(Number(v))} options={[["0","Todos"],["40","≥ 40"],["60","≥ 60"],["75","≥ 75"]]} />
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">Consulta directa</label>
              <Input placeholder="GGAL, AAPL, MELI…" value={yfTicker} onChange={(e) => setYfTicker(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            <Button onClick={enriquecerFundamentales} disabled={analyzing || !panelData.length} className="h-11 rounded-full bg-primary hover:bg-primary/90">
              {analyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enriqueciendo…</> : "Enriquecer panel actual →"}
            </Button>
            <Button onClick={consultarYF} disabled={yfLoading} variant="outline" className="h-11 rounded-full">
              {yfLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Consultando…</> : "Analizar ticker individual →"}
            </Button>
          </div>

          {!panelData.length && (
            <p className="text-xs text-muted-foreground mb-5">
              💡 Para enriquecer un panel completo, primero cargá uno en el tab "Panel IOL".
            </p>
          )}

          {fundFiltered.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Analizados" value={enriched.length} />
                <Stat label="Score ≥ 60" value={enriched.filter((d) => d.score >= 60).length} variant="success" />
                <Stat label="Score 40-59" value={enriched.filter((d) => d.score >= 40 && d.score < 60).length} variant="amber" />
                <Stat label="Score < 40" value={enriched.filter((d) => d.score < 40).length} variant="destructive" />
              </div>
              <div className="overflow-x-auto -mx-6 md:-mx-8">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 px-6 md:px-8">#</th>
                      <th className="pb-3 px-2">Ticker</th>
                      <th className="pb-3 px-2 text-right">Precio</th>
                      <th className="pb-3 px-2 text-right">Var%</th>
                      <th className="pb-3 px-2">Score</th>
                      <th className="pb-3 px-2 text-right">P/E</th>
                      <th className="pb-3 px-2 text-right">ROE</th>
                      <th className="pb-3 px-2 text-right">D/E</th>
                      <th className="pb-3 px-2 text-right">Margen</th>
                      <th className="pb-3 px-2 text-right">Beta</th>
                      <th className="pb-3 px-6 md:px-8">Sector</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundFiltered.map((d, i) => {
                      const vp = d.variacionPorcentual || 0;
                      const pe = d.info?.trailingPE || d.info?.forwardPE;
                      return (
                        <tr key={`${d.simbolo}-${i}`} className="border-b border-border/40 hover:bg-secondary/40">
                          <td className="py-3 px-6 md:px-8 text-muted-foreground tabular-nums">{i + 1}</td>
                          <td className="py-3 px-2"><TickerBadge symbol={d.simbolo} /></td>
                          <td className="py-3 px-2 text-right tabular-nums">${(d.ultimoPrecio || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</td>
                          <td className={cn("py-3 px-2 text-right tabular-nums", vp >= 0 ? "text-success" : "text-destructive")}>{vp >= 0 ? "+" : ""}{vp.toFixed(2)}%</td>
                          <td className="py-3 px-2"><ScorePill score={d.score} /></td>
                          <td className="py-3 px-2 text-right tabular-nums text-muted-foreground">{pe ? `${pe.toFixed(1)}x` : "—"}</td>
                          <td className="py-3 px-2 text-right tabular-nums text-muted-foreground">{d.info?.returnOnEquity ? `${(d.info.returnOnEquity * 100).toFixed(1)}%` : "—"}</td>
                          <td className="py-3 px-2 text-right tabular-nums text-muted-foreground">{d.info?.debtToEquity != null ? d.info.debtToEquity.toFixed(0) : "—"}</td>
                          <td className="py-3 px-2 text-right tabular-nums text-muted-foreground">{d.info?.profitMargins ? `${(d.info.profitMargins * 100).toFixed(1)}%` : "—"}</td>
                          <td className="py-3 px-2 text-right tabular-nums text-muted-foreground">{d.info?.beta ? d.info.beta.toFixed(2) : "—"}</td>
                          <td className="py-3 px-6 md:px-8 text-xs text-muted-foreground">{d.info?.sector?.slice(0, 18) || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {yfResult && <YFSingleCard result={yfResult} />}
        </Card>
      )}

      {/* TAB: CAPM */}
      {tab === "capm" && (
        <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium mb-4">
            <BarChart3 className="w-3.5 h-3.5" /> CAPM — Beta · Alpha · Correlación · R²
          </div>
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">Activo / Ticker</label>
              <Input placeholder="Ej: GGAL, AAPL" value={capmTicker} onChange={(e) => setCapmTicker(e.target.value)} className="h-10" />
            </div>
            <SelectField label="Benchmark" value={capmBench} onChange={(v) => setCapmBench(v)} options={[
              ["^SPX","S&P 500 (^SPX)"], ["^MERV","MERVAL (^MERV)"], ["^IXIC","NASDAQ"],
              ["SPY","SPY ETF"], ["XLK","Tech (XLK)"], ["XLF","Financiero (XLF)"]
            ]} />
          </div>
          <Button onClick={calcCAPMHandler} disabled={capmLoading} className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 mb-5">
            {capmLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculando…</> : "Calcular CAPM →"}
          </Button>

          {capmResult && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Beta" value={capmResult.beta.toFixed(3)} />
                <Stat label="Alpha (diario)" value={`${(capmResult.alpha * 100).toFixed(3)}%`} />
                <Stat label="Correlación r" value={capmResult.correl.toFixed(3)} />
                <Stat label="R²" value={`${(capmResult.r2 * 100).toFixed(1)}%`} />
              </div>
              <Card className="p-5 bg-accent-soft/40 border-accent/30">
                <h4 className="font-serif text-lg text-foreground mb-2">{capmResult.ticker} vs {capmResult.benchmark}</h4>
                <div className="space-y-1 text-sm">
                  <Row k="Beta"            v={`${capmResult.beta.toFixed(3)} — ${interpretBeta(capmResult.beta)}`} />
                  <Row k="Alpha anual"     v={`${(capmResult.alphaAnual * 100).toFixed(2)}%`} />
                  <Row k="Correlación"     v={`${capmResult.correl.toFixed(3)} (${interpretCorrel(capmResult.r2)})`} />
                  <Row k="R²"              v={`${(capmResult.r2 * 100).toFixed(1)}% del riesgo es sistémico`} />
                  <Row k="Observaciones"   v={`${capmResult.n} días`} />
                </div>
              </Card>
            </>
          )}
        </Card>
      )}

      {/* TAB: MARKOWITZ */}
      {tab === "markowitz" && (
        <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium mb-4">
            <PieChart className="w-3.5 h-3.5" /> Optimización de cartera — Markowitz / HRP
          </div>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">Universe (separados por coma)</label>
              <Input value={mkUniverse} onChange={(e) => setMkUniverse(e.target.value)} placeholder="GGAL,BMA,YPF,PAMP…" className="h-10" />
            </div>
            <SelectField label="Estrategia" value={mkStrat} onChange={(v) => setMkStrat(v as MarkowitzStrat)} options={[
              ["markowitz","Markowitz (max Sharpe)"], ["min-var","Min Varianza"], ["equi","Equal Weight"], ["hrp","HRP"]
            ]} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">Tasa libre de riesgo (TNA %)</label>
              <Input type="number" value={mkRf} onChange={(e) => setMkRf(e.target.value)} className="h-10" />
            </div>
            <SelectField label="Período" value={mkPeriod} onChange={(v) => setMkPeriod(v as typeof mkPeriod)} options={[
              ["1y","1 año"],["2y","2 años"],["3y","3 años"],["5y","5 años"]
            ]} />
          </div>
          <Button onClick={calcMarkowitzHandler} disabled={mkLoading} className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 mb-5">
            {mkLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Optimizando…</> : "Optimizar cartera →"}
          </Button>

          {mkResult && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Retorno (anual)" value={`${(mkResult.portReturn * 100).toFixed(2)}%`} variant={mkResult.portReturn >= 0 ? "success" : "destructive"} />
                <Stat label="Volatilidad" value={`${(mkResult.portVol * 100).toFixed(2)}%`} />
                <Stat label="Sharpe" value={mkResult.sharpe.toFixed(3)} />
                <Stat label="Max DD est." value={`${(mkResult.maxDD * 100).toFixed(2)}%`} variant="destructive" />
              </div>
              <div className="overflow-x-auto -mx-6 md:-mx-8">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 px-6 md:px-8">Ticker</th>
                      <th className="pb-3 px-2 text-right">Peso</th>
                      <th className="pb-3 px-2 text-right">Ret. anual</th>
                      <th className="pb-3 px-2 text-right">Vol</th>
                      <th className="pb-3 px-6 md:px-8 text-right">Contribución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mkResult.tickers.map((t, i) => (
                      <tr key={t} className="border-b border-border/40 hover:bg-secondary/40">
                        <td className="py-3 px-6 md:px-8"><TickerBadge symbol={t} /></td>
                        <td className="py-3 px-2 text-right tabular-nums font-medium">{(mkResult.weights[i] * 100).toFixed(2)}%</td>
                        <td className={cn("py-3 px-2 text-right tabular-nums", mkResult.annReturns[i] >= 0 ? "text-success" : "text-destructive")}>{(mkResult.annReturns[i] * 100).toFixed(2)}%</td>
                        <td className="py-3 px-2 text-right tabular-nums text-muted-foreground">{(mkResult.annVols[i] * 100).toFixed(2)}%</td>
                        <td className="py-3 px-6 md:px-8 text-right tabular-nums text-muted-foreground">{(mkResult.weights[i] * mkResult.annReturns[i] * 100).toFixed(3)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* TAB: EPS */}
      {tab === "eps" && (
        <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium mb-4">
            <Calculator className="w-3.5 h-3.5" /> EPS Engine — beat rate · sorpresa · próx. earnings
          </div>
          <div className="mb-3">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">Tickers a auditar (separados por coma)</label>
            <Input value={epsTickers} onChange={(e) => setEpsTickers(e.target.value)} placeholder="JPM,GGAL,MELI,TSLA,MSFT" className="h-10" />
          </div>
          <Button onClick={runEpsHandler} disabled={epsLoading} className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 mb-5">
            {epsLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Auditando…</> : "Auditar EPS →"}
          </Button>

          {epsResults.length > 0 && (
            <div className="space-y-3">
              {epsResults.map((r) => (
                <Card key={r.ticker} className="p-4 border-border/60">
                  {r.error ? (
                    <div className="text-sm text-destructive">{r.ticker} — Error: {r.error}</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <TickerBadge symbol={r.ticker} />
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-medium",
                          (r.beatRate ?? 0) >= 70 ? "bg-success-soft text-success" :
                          (r.beatRate ?? 0) >= 50 ? "bg-accent-soft text-accent-foreground" :
                          "bg-destructive-soft text-destructive"
                        )}>
                          Beat rate: {r.beatRate != null ? `${r.beatRate.toFixed(0)}%` : "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{r.quarters} trimestres</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                        <Row k="Sorpresa prom." v={r.avgSurprise != null ? `${r.avgSurprise.toFixed(2)}%` : "—"} />
                        <Row k="EPS est. próx Q" v={r.epsEst != null ? `$${r.epsEst.toFixed(2)}` : "—"} />
                        <Row k="Próx. earnings" v={r.nextDate || "—"} />
                      </div>
                      <p className="text-[11px] text-muted-foreground italic">{interpretBeatRate(r.beatRate)}</p>
                    </>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB: PORTFOLIO FINAL */}
      {tab === "portfolio" && (
        <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium">
              <FileText className="w-3.5 h-3.5" /> Portfolio ETR consolidado
            </div>
            {enriched.length > 0 && (
              <Button onClick={exportarCSV} variant="outline" size="sm" className="rounded-full">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar CSV
              </Button>
            )}
          </div>

          <Card className="p-5 bg-gradient-paper border-accent/30 mb-5">
            <h4 className="font-serif text-xl text-foreground mb-1">{profiles[selectedProfile].name}</h4>
            <p className="text-sm text-muted-foreground mb-4">{allocation.desc}</p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { v: allocation.rv, l: "RV" }, { v: allocation.cedears, l: "CEDEARs" },
                { v: allocation.rf, l: "RF" }, { v: allocation.cau, l: "Cauc" },
                { v: allocation.ef, l: "Ef" },
              ].map((c, i) => (
                <div key={i} className="bg-card rounded-lg p-2 text-center border border-border/40">
                  <div className="font-serif text-lg tabular-nums">{c.v}%</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{c.l}</div>
                </div>
              ))}
            </div>
          </Card>

          {buckets && (
            <Card className="p-5 mb-5 border-border/60">
              <h4 className="font-serif text-base text-foreground mb-3">Buckets en {monedaSym}</h4>
              {buckets.map((b, i) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-border/40 text-sm">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className="font-medium tabular-nums">{b.pct}% · {fmtMoney(b.monto)}</span>
                </div>
              ))}
            </Card>
          )}

          {(topActivos.length > 0 || watchlist.length > 0) ? (
            <div className="grid md:grid-cols-2 gap-4">
              {topActivos.length > 0 && (
                <Card className="p-5 bg-success-soft/40 border-success/20">
                  <div className="text-xs uppercase tracking-wider text-success font-medium mb-3">
                    Núcleo (score ≥ 60)
                  </div>
                  <div className="space-y-2">
                    {topActivos.map((d) => (
                      <div key={d.simbolo} className="flex items-center justify-between py-1">
                        <TickerBadge symbol={d.simbolo} />
                        <ScorePill score={d.score} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              {watchlist.length > 0 && (
                <Card className="p-5 bg-accent-soft/50 border-accent/30">
                  <div className="text-xs uppercase tracking-wider text-accent-foreground font-medium mb-3">
                    Watchlist (score 40-59)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {watchlist.map((d) => (
                      <span key={d.simbolo} className="px-2.5 py-1 rounded-md bg-card text-foreground text-xs font-mono border border-border">
                        {d.simbolo} · {d.score}
                      </span>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              💡 Para generar el portfolio consolidado: cargá un panel → enriquecé con fundamentales → opcionalmente optimizá con Markowitz.
            </p>
          )}

          {mkResult && (
            <Card className="p-5 mt-5 bg-primary-soft/40 border-primary/20">
              <h4 className="font-serif text-base text-foreground mb-3">Pesos óptimos (Markowitz · {mkResult.strategy})</h4>
              <div className="space-y-1.5">
                {mkResult.tickers.map((t, i) => (
                  <div key={t} className="flex items-center gap-3">
                    <TickerBadge symbol={t} />
                    <Progress value={mkResult.weights[i] * 100} className="flex-1 h-2" />
                    <span className="font-medium tabular-nums text-sm w-16 text-right">{(mkResult.weights[i] * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </Card>
      )}
    </div>
  );
};

// ============================================================
// SUB-COMPONENTES
// ============================================================
function ModuleCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-3 border border-border/40">
      <div className="font-serif text-sm text-foreground mb-1">{title}</div>
      <div className="text-[10px] text-muted-foreground leading-relaxed">{desc}</div>
    </div>
  );
}

function MacroCell({ label, value, prefix = "", suffix = "", decimals = 0 }: {
  label: string; value: number | null | undefined; prefix?: string; suffix?: string; decimals?: number;
}) {
  const display = value != null
    ? `${prefix}${value.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
    : "—";
  return (
    <div className="bg-secondary/50 rounded-lg p-3 text-center border border-border/40">
      <div className="font-serif text-lg md:text-xl text-foreground tabular-nums">{display}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 leading-tight">{label}</div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Stat({ label, value, variant = "muted" }: {
  label: string; value: string | number; variant?: "muted" | "success" | "destructive" | "amber";
}) {
  const colorMap = {
    muted: "text-foreground",
    success: "text-success",
    destructive: "text-destructive",
    amber: "text-accent-foreground",
  } as const;
  return (
    <div className="bg-secondary/50 rounded-lg p-3 text-center border border-border/40">
      <div className={cn("font-serif text-lg md:text-xl tabular-nums", colorMap[variant])}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const cls = scoreClass(score);
  const styles = {
    high: "bg-success-soft text-success",
    mid:  "bg-accent-soft text-accent-foreground",
    low:  "bg-destructive-soft text-destructive",
  }[cls];
  return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium tabular-nums", styles)}>{score}/100</span>;
}

function TickerBadge({ symbol }: { symbol: string }) {
  return (
    <span className="px-2 py-1 rounded-md bg-primary-soft text-primary font-mono text-xs font-medium">
      {symbol}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/40">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-foreground">{v}</span>
    </div>
  );
}

function YFSingleCard({ result }: { result: { info: YFInfo; score: number; detalle: Record<string, string>; ticker: string } }) {
  const { info, score, ticker } = result;
  const upside = info.targetMeanPrice && info.currentPrice
    ? ((info.targetMeanPrice / info.currentPrice - 1) * 100)
    : null;
  const recom = (info.recomBuy ?? 0) > (info.recomSell ?? 0) ? "BUY" :
                (info.recomSell ?? 0) > (info.recomBuy ?? 0) ? "SELL" : "HOLD";
  const recomCls = recom === "BUY" ? "bg-success-soft text-success" :
                   recom === "SELL" ? "bg-destructive-soft text-destructive" :
                   "bg-accent-soft text-accent-foreground";
  return (
    <Card className="mt-5 p-5 border-border/60">
      <div className="flex items-center gap-3 mb-4">
        <TickerBadge symbol={ticker} />
        <span className="text-sm text-muted-foreground flex-1">{info.longName || ""}</span>
        <ScorePill score={score} />
      </div>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Métricas clave</div>
          <Row k="P/E Trailing"      v={info.trailingPE ? `${info.trailingPE.toFixed(1)}x` : "—"} />
          <Row k="ROE"               v={info.returnOnEquity ? `${(info.returnOnEquity * 100).toFixed(1)}%` : "—"} />
          <Row k="Deuda/Equity"      v={info.debtToEquity != null ? info.debtToEquity.toFixed(0) : "—"} />
          <Row k="Current Ratio"     v={info.currentRatio ? info.currentRatio.toFixed(2) : "—"} />
          <Row k="Margen Neto"       v={info.profitMargins ? `${(info.profitMargins * 100).toFixed(1)}%` : "—"} />
          <Row k="Beta"              v={info.beta ? info.beta.toFixed(2) : "—"} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Consenso de analistas</div>
          <Row k="Analistas"         v={String(info.numberOfAnalysts || "—")} />
          <Row k="Target precio"     v={info.targetMeanPrice ? `$${info.targetMeanPrice.toFixed(2)}` : "—"} />
          <Row k="Precio actual"     v={info.currentPrice ? `$${info.currentPrice.toFixed(2)}` : "—"} />
          <Row k="Upside"            v={upside != null ? `${upside.toFixed(1)}%` : "—"} />
          <Row k="EPS est. próx Q"   v={info.epsEst ? `$${info.epsEst.toFixed(2)}` : "—"} />
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Recomendación</span>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", recomCls)}>{recom}</span>
          </div>
        </div>
      </div>
      <Progress value={score} className="mt-4 h-1.5" />
      <div className="text-[10px] text-muted-foreground text-right mt-1">Score ETR: {score}/100</div>
    </Card>
  );
}
