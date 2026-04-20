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
  getDemoPanel,
  PANEL_LABELS,
  type PanelTitulo,
  type YFInfo,
} from "@/data/portfolioEngine";
import type { ProfileKey } from "@/data/iolData";
import { profiles } from "@/data/iolData";
import { cn } from "@/lib/utils";
import {
  Lock,
  Activity,
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
} from "lucide-react";

interface PortfolioEngineProps {
  selectedProfile: ProfileKey;
  onProfileChange: (key: ProfileKey) => void;
}

type Panel = "cedears" | "acciones" | "titulosPublicos" | "obligacionesNegociables" | "cauciones";
type StatusColor = "neutral" | "amber" | "green" | "red";

interface Enriched extends PanelTitulo {
  yfTicker: string;
  info: YFInfo | null;
  score: number;
  detalle: Record<string, string>;
}

export const PortfolioEngine = ({ selectedProfile, onProfileChange }: PortfolioEngineProps) => {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState({
    msg: "Ingresá credenciales IOL para datos en vivo, o usá el modo demo.",
    color: "neutral" as StatusColor,
  });
  const [panel, setPanel] = useState<Panel>("cedears");
  const [topN, setTopN] = useState(20);
  const [minScore, setMinScore] = useState(60);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<Enriched[]>([]);
  const [yfTicker, setYfTicker] = useState("");
  const [yfResult, setYfResult] = useState<{ info: YFInfo; score: number; detalle: Record<string, string>; ticker: string } | null>(null);
  const [yfLoading, setYfLoading] = useState(false);

  const allocation = engineAllocations[selectedProfile];

  const setMsg = (msg: string, color: StatusColor = "neutral") => setStatus({ msg, color });

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

  const analizar = async (useDemo = false) => {
    setAnalyzing(true);
    setResults([]);
    setMsg(`Cargando panel: ${PANEL_LABELS[panel]}…`, "amber");

    let titulos: PanelTitulo[] = [];

    if (token && !useDemo) {
      const { data, error } = await supabase.functions.invoke("iol-panel", {
        body: { token, panel, pais: "argentina" },
      });
      if (error || !data?.titulos) {
        setMsg(`Error IOL — usando datos demo. (${error?.message || data?.error || ""})`, "amber");
        titulos = getDemoPanel(panel);
      } else {
        titulos = data.titulos;
      }
    } else {
      titulos = getDemoPanel(panel);
      setMsg("Modo demo: mostrando datos de ejemplo.", "amber");
    }

    const filtrados = titulos
      .sort((a, b) => Math.abs(b.variacionPorcentual || 0) - Math.abs(a.variacionPorcentual || 0))
      .slice(0, topN);

    const enriched: Enriched[] = [];
    let i = 0;
    for (const t of filtrados) {
      i++;
      setMsg(`Analizando ${i}/${filtrados.length}: ${t.simbolo}…`, "amber");
      let info: YFInfo | null = null;
      if (panel === "cedears" || panel === "acciones") {
        const yfTickerMapped = mapYFTicker(t.simbolo || "");
        const { data } = await supabase.functions.invoke("yfinance-info", {
          body: { ticker: yfTickerMapped },
        });
        info = data?.info || null;
        await new Promise((r) => setTimeout(r, 200));
      }
      const { score, detalle } = calcScoreSalud(info);
      enriched.push({ ...t, yfTicker: mapYFTicker(t.simbolo), info, score, detalle });
    }

    enriched.sort((a, b) => b.score - a.score);
    const finalResults = enriched.filter((d) => d.score >= minScore || panel !== "cedears" && panel !== "acciones");
    setResults(finalResults.length ? finalResults : enriched);
    setMsg(`Análisis completo. ${enriched.length} activos analizados.`, "green");
    setAnalyzing(false);
  };

  const consultarYF = async () => {
    const t = yfTicker.trim().toUpperCase();
    if (!t) return;
    setYfLoading(true);
    setYfResult(null);
    const { data, error } = await supabase.functions.invoke("yfinance-info", {
      body: { ticker: t },
    });
    setYfLoading(false);
    if (error || !data?.info) {
      setMsg(`No se encontraron datos para ${t}`, "red");
      return;
    }
    const { score, detalle } = calcScoreSalud(data.info);
    setYfResult({ info: data.info, score, detalle, ticker: data.ticker || t });
  };

  const dotColor = {
    neutral: "bg-muted-foreground",
    amber: "bg-accent",
    green: "bg-success",
    red: "bg-destructive",
  }[status.color];

  const topActivos = results.filter((d) => d.score >= 60).slice(0, 8);
  const watchlist = results.filter((d) => d.score >= 40 && d.score < 60).slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 1. Credenciales */}
      <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium mb-4">
          <Lock className="w-3.5 h-3.5" />
          Paso 1 · Credenciales IOL (opcional)
        </div>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <Input
            placeholder="Usuario IOL (email)"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="h-11 rounded-lg border-border focus-visible:ring-accent"
          />
          <Input
            type="password"
            placeholder="Contraseña IOL"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="h-11 rounded-lg border-border focus-visible:ring-accent"
          />
        </div>
        <Button
          onClick={autenticar}
          variant="outline"
          className="w-full h-11 rounded-lg border-border bg-secondary/50 hover:bg-secondary"
        >
          {token ? "Reconectar a IOL" : "Conectar con IOL"}
        </Button>
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          🔒 Tus credenciales viajan a través de un edge function seguro (no quedan en el navegador
          ni se guardan). Si preferís, podés usar el modo demo sin login.
        </p>
      </Card>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/60 border border-border/60">
        <div className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
        <span className="text-sm text-muted-foreground">{status.msg}</span>
      </div>

      {/* 2. Asignación según perfil */}
      <Card className="p-6 md:p-8 bg-gradient-paper border-accent/30 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Paso 2 · Asignación según perfil
          </div>
          <span className="text-sm text-foreground font-medium">{profiles[selectedProfile].name}</span>
        </div>
        <div className="grid grid-cols-5 gap-2 md:gap-3">
          {[
            { v: allocation.rv, l: "Renta Variable" },
            { v: allocation.cedears, l: "CEDEARs SPY/DJ" },
            { v: allocation.rf, l: "Renta Fija" },
            { v: allocation.cau, l: "Cauciones" },
            { v: allocation.ef, l: "Efectivo" },
          ].map((c, i) => (
            <div key={i} className="bg-card rounded-lg p-3 text-center border border-border/40">
              <div className="font-serif text-xl md:text-2xl text-foreground tabular-nums">
                {c.v}%
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 leading-tight">
                {c.l}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Panel + filtros */}
      <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium mb-4">
          <Activity className="w-3.5 h-3.5" />
          Paso 3 · Panel a analizar
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {(Object.keys(PANEL_LABELS) as Panel[]).map((p) => (
            <button
              key={p}
              onClick={() => setPanel(p)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-medium transition-smooth",
                panel === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-accent-soft hover:text-foreground"
              )}
            >
              {PANEL_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1.5">Top activos</span>
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            >
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1.5">Score mínimo</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            >
              <option value={0}>Todos</option>
              <option value={40}>≥ 40</option>
              <option value={60}>≥ 60</option>
              <option value={75}>≥ 75</option>
            </select>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => analizar(false)}
            disabled={analyzing}
            className="flex-1 h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {analyzing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analizando…</>
            ) : (
              <>Analizar panel + salud financiera →</>
            )}
          </Button>
          <Button
            onClick={() => analizar(true)}
            disabled={analyzing}
            variant="outline"
            className="h-12 rounded-full border-border"
          >
            Modo demo
          </Button>
        </div>
      </Card>

      {/* Resultados */}
      {results.length > 0 && (
        <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card animate-fade-up">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium mb-4">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Paso 4 · Ranking por score de salud
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label="Analizados" value={results.length} variant="muted" />
            <Stat label="Score ≥ 60" value={results.filter((r) => r.score >= 60).length} variant="success" />
            <Stat label="Score 40-59" value={results.filter((r) => r.score >= 40 && r.score < 60).length} variant="amber" />
            <Stat label="Score < 40" value={results.filter((r) => r.score < 40).length} variant="destructive" />
          </div>

          <div className="overflow-x-auto -mx-6 md:-mx-8">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 px-6 md:px-8 font-medium">#</th>
                  <th className="pb-3 px-2 font-medium">Símbolo</th>
                  <th className="pb-3 px-2 font-medium text-right">Precio</th>
                  <th className="pb-3 px-2 font-medium text-right">Var %</th>
                  <th className="pb-3 px-2 font-medium">Score</th>
                  <th className="pb-3 px-2 font-medium text-right">P/E</th>
                  <th className="pb-3 px-2 font-medium text-right">ROE</th>
                  <th className="pb-3 px-2 font-medium text-right">D/E</th>
                  <th className="pb-3 px-6 md:px-8 font-medium">Sector</th>
                </tr>
              </thead>
              <tbody>
                {results.map((d, i) => {
                  const vp = d.variacionPorcentual || 0;
                  const pe = d.info?.trailingPE || d.info?.forwardPE;
                  return (
                    <tr key={`${d.simbolo}-${i}`} className="border-b border-border/40 hover:bg-secondary/40 transition-smooth">
                      <td className="py-3 px-6 md:px-8 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-1 rounded-md bg-primary-soft text-primary font-mono text-xs font-medium">
                          {d.simbolo}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right tabular-nums text-foreground">
                        ${d.ultimoPrecio?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "—"}
                      </td>
                      <td className={cn("py-3 px-2 text-right tabular-nums font-medium", vp >= 0 ? "text-success" : "text-destructive")}>
                        {vp >= 0 ? "+" : ""}{vp.toFixed(2)}%
                      </td>
                      <td className="py-3 px-2"><ScorePill score={d.score} /></td>
                      <td className="py-3 px-2 text-right tabular-nums text-muted-foreground">{pe ? `${pe.toFixed(1)}x` : "—"}</td>
                      <td className="py-3 px-2 text-right tabular-nums text-muted-foreground">
                        {d.info?.returnOnEquity ? `${(d.info.returnOnEquity * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-3 px-2 text-right tabular-nums text-muted-foreground">
                        {d.info?.debtToEquity != null ? d.info.debtToEquity.toFixed(0) : "—"}
                      </td>
                      <td className="py-3 px-6 md:px-8 text-xs text-muted-foreground">{d.info?.sector || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Portfolio sugerido */}
          {(topActivos.length > 0 || watchlist.length > 0) && (
            <div className="mt-8 pt-8 border-t border-border">
              <h4 className="font-serif text-2xl text-foreground mb-1">Portfolio sugerido</h4>
              <p className="text-sm text-muted-foreground mb-5">
                Para perfil <span className="text-accent font-medium">{profiles[selectedProfile].name}</span>, basado en el ranking actual.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {topActivos.length > 0 && (
                  <Card className="p-5 bg-success-soft/40 border-success/20">
                    <div className="text-xs uppercase tracking-wider text-success font-medium mb-3">
                      Núcleo (score ≥ 60)
                    </div>
                    <div className="space-y-2">
                      {topActivos.map((d) => (
                        <div key={d.simbolo} className="flex items-center justify-between py-1">
                          <span className="font-mono text-sm font-medium text-foreground">{d.simbolo}</span>
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
                        <span
                          key={d.simbolo}
                          className="px-2.5 py-1 rounded-md bg-card text-foreground text-xs font-mono border border-border"
                        >
                          {d.simbolo} · {d.score}
                        </span>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Consulta yFinance individual */}
      <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-medium mb-4">
          <Search className="w-3.5 h-3.5" />
          Consulta directa por ticker
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Ej: AAPL, MELI, GGAL"
            value={yfTicker}
            onChange={(e) => setYfTicker(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && consultarYF()}
            className="h-11 rounded-lg border-border focus-visible:ring-accent"
          />
          <Button
            onClick={consultarYF}
            disabled={yfLoading}
            className="h-11 px-6 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {yfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analizar"}
          </Button>
        </div>

        {yfResult && (
          <div className="mt-6 animate-fade-up">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1.5 rounded-md bg-primary-soft text-primary font-mono text-sm font-medium">
                {yfResult.ticker}
              </span>
              <span className="text-sm text-muted-foreground flex-1 truncate">
                {yfResult.info.longName || ""}
              </span>
              <ScorePill score={yfResult.score} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Métricas fundamentales
                </div>
                <Row k="P/E Trailing" v={yfResult.info.trailingPE ? `${yfResult.info.trailingPE.toFixed(1)}x` : "—"} />
                <Row k="ROE" v={yfResult.info.returnOnEquity ? `${(yfResult.info.returnOnEquity * 100).toFixed(1)}%` : "—"} />
                <Row k="ROA" v={yfResult.info.returnOnAssets ? `${(yfResult.info.returnOnAssets * 100).toFixed(1)}%` : "—"} />
                <Row k="Deuda/Equity" v={yfResult.info.debtToEquity != null ? yfResult.info.debtToEquity.toFixed(0) : "—"} />
                <Row k="Current Ratio" v={yfResult.info.currentRatio ? yfResult.info.currentRatio.toFixed(2) : "—"} />
                <Row k="Margen neto" v={yfResult.info.profitMargins ? `${(yfResult.info.profitMargins * 100).toFixed(1)}%` : "—"} />
                <Row k="Div. Yield" v={yfResult.info.dividendYield ? `${(yfResult.info.dividendYield * 100).toFixed(2)}%` : "—"} />
                <Row k="Sector" v={yfResult.info.sector || "—"} />
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Desglose del score
                </div>
                {Object.entries(yfResult.detalle).map(([k, v]) => (
                  <Row key={k} k={k} v={v} highlight={v.startsWith("+")} />
                ))}
                <div className="pt-3">
                  <Progress
                    value={yfResult.score}
                    className={cn(
                      "h-2 bg-secondary",
                      yfResult.score >= 60 && "[&>div]:bg-success",
                      yfResult.score >= 40 && yfResult.score < 60 && "[&>div]:bg-accent",
                      yfResult.score < 40 && "[&>div]:bg-destructive"
                    )}
                  />
                  <div className="text-right text-xs text-muted-foreground mt-1.5 tabular-nums">
                    Score total: {yfResult.score}/100
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

const Stat = ({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "success" | "amber" | "destructive" | "muted";
}) => {
  const styles = {
    success: "bg-success-soft text-success",
    amber: "bg-accent-soft text-accent-foreground",
    destructive: "bg-destructive-soft text-destructive",
    muted: "bg-secondary text-foreground",
  };
  return (
    <div className={cn("rounded-xl p-3 text-center", styles[variant])}>
      <div className="font-serif text-2xl tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80 mt-0.5">{label}</div>
    </div>
  );
};

const ScorePill = ({ score }: { score: number }) => {
  const cls = scoreClass(score);
  const styles = {
    high: "bg-success-soft text-success",
    mid: "bg-accent-soft text-accent-foreground",
    low: "bg-destructive-soft text-destructive",
  };
  return (
    <span className={cn("inline-block px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums", styles[cls])}>
      {score}/100
    </span>
  );
};

const Row = ({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) => (
  <div className="flex justify-between py-1.5 border-b border-border/40 text-sm">
    <span className="text-muted-foreground">{k}</span>
    <span className={cn("tabular-nums font-medium", highlight ? "text-success" : "text-foreground")}>{v}</span>
  </div>
);
