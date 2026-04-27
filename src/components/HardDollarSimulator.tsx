import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  BONDS_AR,
  BOND_TICKERS,
  futureFlows,
  calcYTM,
  calcModDuration,
  calcParity,
  nextCoupon,
  totalCashflow,
  nominalsForAmount,
  type BondDef,
} from "@/data/bondsAR";
import {
  Loader2,
  TrendingUp,
  Calendar,
  Wallet,
  Target,
  RefreshCw,
  Coins,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BondPrice {
  price: number | null;
  change: number | null;
  volume: number | null;
  source: string;
  ts: string;
}

const fmtUSD = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtNum = (n: number, dec = 2) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

export const HardDollarSimulator = () => {
  const [selected, setSelected] = useState<string>("GD30");
  const [amount, setAmount] = useState<string>("10000");
  const [prices, setPrices] = useState<Record<string, BondPrice>>({});
  const [loading, setLoading] = useState(false);
  const [manualPrice, setManualPrice] = useState<string>("");
  const [usingManual, setUsingManual] = useState(false);

  const bond: BondDef = BONDS_AR[selected];
  const livePrice = prices[selected]?.price ?? null;
  const effectivePrice = usingManual && manualPrice ? parseFloat(manualPrice) : livePrice;

  // Cargar precios al montar y al cambiar selección
  const loadPrices = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("bonds-ar", {
      body: { tickers: BOND_TICKERS },
    });
    setLoading(false);
    if (!error && data?.prices) {
      setPrices(data.prices);
    }
  };

  useEffect(() => {
    loadPrices();
  }, []);

  // ============ Cálculos derivados ============
  const calculos = useMemo(() => {
    if (!effectivePrice || effectivePrice <= 0) return null;
    const ytm = calcYTM(bond, effectivePrice);
    const dur = ytm != null ? calcModDuration(bond, effectivePrice, ytm) : null;
    const par = calcParity(bond, effectivePrice);
    const next = nextCoupon(bond);
    const flows = futureFlows(bond);
    const amt = parseFloat(amount) || 0;
    const noms = nominalsForAmount(amt, effectivePrice);

    // Cobros próximos 12 meses
    const today = new Date();
    const in12 = new Date(today);
    in12.setMonth(in12.getMonth() + 12);
    const cobros12mUSDvn100 = totalCashflow(bond, today, in12);
    const cobros12mUSD = (cobros12mUSDvn100 * noms) / 100;

    // Total a cobrar a vencimiento
    const totalVN100 = flows.reduce((acc, f) => acc + f.coupon + f.amortization, 0);
    const totalUSD = (totalVN100 * noms) / 100;

    // Próximos 4 cobros mostrados
    const next4 = flows.slice(0, 4).map((f) => ({
      ...f,
      amountUSD: ((f.coupon + f.amortization) * noms) / 100,
    }));

    return {
      ytm,
      dur,
      par,
      next,
      noms,
      cobros12mUSD,
      totalUSD,
      flows,
      next4,
    };
  }, [bond, effectivePrice, amount]);

  const livePriceTxt = livePrice != null ? `${fmtNum(livePrice)} USD` : "—";
  const lawColor = bond.law === "NY" ? "bg-accent/15 text-accent-foreground border-accent/40"
                                     : "bg-muted text-muted-foreground border-border";

  return (
    <div className="space-y-6">
      {/* Estrategia banner */}
      <Card className="bg-gradient-warm border-accent/30 shadow-warm overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="text-xs uppercase tracking-widest text-accent font-medium mb-2">
            Renta fija hard dollar · Cronogramas oficiales
          </div>
          <h3 className="font-serif text-2xl md:text-3xl text-foreground mb-3 leading-tight">
            Cobrá en dólares, sin depender del tipo de cambio
          </h3>
          <p className="text-muted-foreground text-base leading-relaxed max-w-3xl">
            Calculá cuánto vas a cobrar, en qué fecha y durante cuánto tiempo — antes de tomar la decisión.
            Precios live desde ArgentinaDatos. Flujos hardcoded según prospecto del canje 2020.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* ============ COLUMNA IZQ: Selector + Inputs ============ */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 bg-secondary/60 border-b border-border">
              <span className="text-[10px] uppercase tracking-widest font-mono font-medium text-muted-foreground">
                Bonos disponibles
              </span>
            </div>
            <div className="divide-y divide-border">
              {BOND_TICKERS.map((t) => {
                const b = BONDS_AR[t];
                const p = prices[t];
                const isActive = selected === t;
                return (
                  <button
                    key={t}
                    onClick={() => setSelected(t)}
                    className={cn(
                      "w-full text-left px-5 py-4 transition-smooth relative",
                      isActive ? "bg-accent-soft" : "hover:bg-muted/40"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
                    )}
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-serif text-xl text-foreground">{t}</span>
                      <Badge variant="outline" className={cn("text-[10px] font-mono", lawColor)}>
                        {b.law === "NY" ? "Ley NY" : "Ley AR"}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-success font-medium mb-1">{b.strategy}</div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
                          Último
                        </div>
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {p?.price != null ? fmtNum(p.price) : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
                          Var %
                        </div>
                        <div className={cn(
                          "font-mono text-xs font-semibold",
                          (p?.change ?? 0) >= 0 ? "text-success" : "text-destructive"
                        )}>
                          {p?.change != null ? `${p.change > 0 ? "+" : ""}${fmtNum(p.change, 2)}%` : "—"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-3 bg-secondary/40 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadPrices}
                disabled={loading}
                className="w-full text-xs h-8"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                Actualizar precios
              </Button>
            </div>
          </Card>

          {/* Inputs */}
          <Card className="p-5 space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-mono font-medium text-muted-foreground mb-2 block">
                Monto a invertir (USD)
              </label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                className="font-mono text-base h-12"
              />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {[1000, 5000, 10000, 50000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-mono border transition-smooth",
                      parseFloat(amount) === v
                        ? "border-accent bg-accent-soft text-accent-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-accent/40"
                    )}
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <label className="text-[10px] uppercase tracking-widest font-mono font-medium text-muted-foreground mb-2 block">
                Precio (USD por VN 100)
              </label>
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setUsingManual(false)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-md text-xs font-medium border transition-smooth",
                    !usingManual
                      ? "border-accent bg-accent-soft text-accent-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  Live: {livePriceTxt}
                </button>
                <button
                  onClick={() => setUsingManual(true)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-md text-xs font-medium border transition-smooth",
                    usingManual
                      ? "border-accent bg-accent-soft text-accent-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  Manual
                </button>
              </div>
              {usingManual && (
                <Input
                  type="number"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder={livePrice ? String(livePrice) : "65.50"}
                  className="font-mono text-sm"
                />
              )}
            </div>
          </Card>
        </div>

        {/* ============ COLUMNA DER: Resultados ============ */}
        <div className="space-y-5">
          {!effectivePrice || !calculos ? (
            <Card className="min-h-[400px] flex flex-col items-center justify-center text-center p-10 border-dashed">
              <Coins className="w-10 h-10 text-muted-foreground/40 mb-4" />
              <h4 className="font-serif text-xl text-foreground mb-2">Sin precio disponible</h4>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Esperando datos live de ArgentinaDatos o ingresá un precio manual para calcular TIR, duration y flujos.
              </p>
            </Card>
          ) : (
            <>
              {/* Header bono */}
              <Card className="p-6 md:p-8 shadow-card">
                <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
                  <div>
                    <h3 className="font-serif text-2xl md:text-3xl text-foreground leading-tight">
                      {bond.name}
                    </h3>
                    <div className="text-xs text-muted-foreground mt-1 font-mono">
                      {bond.ticker} · {bond.isin || "ISIN —"} · Precio {fmtNum(effectivePrice)} USD/VN100
                    </div>
                  </div>
                  <Badge variant="outline" className={lawColor}>
                    {bond.law === "NY" ? "Ley Nueva York" : "Ley Argentina"}
                  </Badge>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 mt-6 border border-border rounded-lg overflow-hidden bg-card">
                  <KPI
                    label="TIR (anual USD)"
                    value={calculos.ytm != null ? `${fmtNum(calculos.ytm * 100, 2)}%` : "—"}
                    sub="Yield to maturity"
                    color="accent"
                  />
                  <KPI
                    label="Duration mod."
                    value={calculos.dur != null ? `${fmtNum(calculos.dur, 2)} años` : "—"}
                    sub="Sensibilidad a tasas"
                    color="ink"
                  />
                  <KPI
                    label="Paridad"
                    value={`${fmtNum(calculos.par * 100, 1)}%`}
                    sub="Precio / valor técnico"
                    color={calculos.par < 0.7 ? "destructive" : "ink"}
                  />
                  <KPI
                    label="Cobros 12m"
                    value={fmtUSD(calculos.cobros12mUSD)}
                    sub={`Sobre VN ${fmtNum(calculos.noms, 0)}`}
                    color="success"
                  />
                </div>
              </Card>

              {/* Próximos cobros */}
              <Card className="bg-foreground text-background overflow-hidden">
                <div className="p-6 md:p-7 relative">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-accent" />
                    <span className="text-[10px] uppercase tracking-widest font-mono font-medium text-accent">
                      Cronograma de cobros
                    </span>
                  </div>
                  <h4 className="font-serif text-xl md:text-2xl text-background mb-4">
                    Lo que vas a cobrar en USD
                  </h4>
                  <p className="text-sm text-background/70 leading-relaxed mb-5 max-w-2xl">
                    Comprando <strong className="text-accent">VN {fmtNum(calculos.noms, 0)}</strong> de{" "}
                    <strong className="text-background">{bond.ticker}</strong> con{" "}
                    <strong className="text-background">{fmtUSD(parseFloat(amount) || 0)}</strong>, los próximos cobros son:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {calculos.next4.map((c, i) => (
                      <div
                        key={c.date}
                        className={cn(
                          "rounded-lg p-3 border",
                          i === 0
                            ? "bg-accent/10 border-accent/40"
                            : "bg-background/5 border-background/10"
                        )}
                      >
                        <div className={cn(
                          "text-[10px] font-mono mb-1",
                          i === 0 ? "text-accent" : "text-background/50"
                        )}>
                          {fmtDate(c.date)}
                        </div>
                        <div className="font-serif text-lg text-accent font-semibold">
                          {fmtUSD(c.amountUSD)}
                        </div>
                        <div className="text-[10px] text-background/40 mt-0.5">
                          {c.amortization > 0 ? "Cupón + amort." : "Cupón"}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 pt-4 border-t border-background/10 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="text-background/50 font-mono uppercase tracking-wider text-[9px] mb-1">
                        Total a vencimiento
                      </div>
                      <div className="font-serif text-lg text-background">
                        {fmtUSD(calculos.totalUSD)}
                      </div>
                    </div>
                    <div>
                      <div className="text-background/50 font-mono uppercase tracking-wider text-[9px] mb-1">
                        Multiplicador
                      </div>
                      <div className="font-serif text-lg text-accent">
                        {fmtNum(calculos.totalUSD / (parseFloat(amount) || 1), 2)}x
                      </div>
                    </div>
                    <div>
                      <div className="text-background/50 font-mono uppercase tracking-wider text-[9px] mb-1">
                        Cupones restantes
                      </div>
                      <div className="font-serif text-lg text-background">
                        {calculos.flows.length}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Tesis */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-accent" />
                  <span className="text-[10px] uppercase tracking-widest font-mono font-medium text-muted-foreground">
                    Tesis del bono
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{bond.thesis}</p>
              </Card>

              {/* Tabla de flujos completa */}
              <Card className="overflow-hidden">
                <div className="px-5 py-3 bg-secondary/60 border-b border-border flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-widest font-mono font-medium text-muted-foreground">
                    Cronograma completo · {calculos.flows.length} cobros
                  </span>
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 font-mono font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Fecha</th>
                        <th className="text-right px-4 py-2 font-mono font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Cupón %</th>
                        <th className="text-right px-4 py-2 font-mono font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Cupón VN100</th>
                        <th className="text-right px-4 py-2 font-mono font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Amort. VN100</th>
                        <th className="text-right px-4 py-2 font-mono font-medium text-muted-foreground uppercase tracking-wider text-[9px]">A cobrar USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculos.flows.map((f, i) => {
                        const usd = ((f.coupon + f.amortization) * calculos.noms) / 100;
                        return (
                          <tr key={f.date} className={cn("border-t border-border", i === 0 && "bg-accent-soft")}>
                            <td className="px-4 py-2 font-mono text-foreground">
                              {fmtDate(f.date)}
                              {i === 0 && <span className="ml-2 text-[9px] text-accent font-semibold">PRÓXIMO</span>}
                            </td>
                            <td className="px-4 py-2 font-mono text-right text-muted-foreground">{fmtNum(f.couponRate * 100, 3)}%</td>
                            <td className="px-4 py-2 font-mono text-right text-foreground">{fmtNum(f.coupon, 3)}</td>
                            <td className="px-4 py-2 font-mono text-right text-success">
                              {f.amortization > 0 ? fmtNum(f.amortization, 3) : "—"}
                            </td>
                            <td className="px-4 py-2 font-mono text-right font-semibold text-accent-foreground">
                              {fmtUSD(usd)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Disclaimer */}
              <div className="text-[10px] text-muted-foreground leading-relaxed bg-muted/40 border border-border rounded-lg p-3 font-mono">
                Cálculos basados en cronograma oficial del canje 2020 (Decreto 391/2020). TIR calculada por Newton-Raphson.
                No incluye intereses corridos ni comisiones del agente. Carácter exclusivamente educativo.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const KPI = ({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: "accent" | "success" | "destructive" | "ink";
}) => {
  const colorMap = {
    accent: "text-accent",
    success: "text-success",
    destructive: "text-destructive",
    ink: "text-foreground",
  };
  return (
    <div className="p-4 md:p-5 border-r border-border last:border-r-0">
      <div className="text-[9px] uppercase tracking-widest font-mono font-medium text-muted-foreground mb-2">
        {label}
      </div>
      <div className={cn("font-serif text-2xl leading-none mb-1.5 font-semibold", colorMap[color])}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground font-mono">{sub}</div>
    </div>
  );
};