// Cronogramas de pagos (cupón + amortización) de los principales bonos hard dollar argentinos.
// Fuente: prospectos oficiales (Bonar 2030/2035/2038/2041, Globales 2030/2035/2038/2041).
// Todos los flujos están expresados por VN 100 (valor nominal cada 100 USD).
// Convención: cupón semestral, base 30/360. Step-up cuando aplica.
//
// IMPORTANTE: estos flujos son fijos y conocidos hasta vencimiento. El precio
// de mercado se trae live desde ArgentinaDatos. La TIR / duration se calculan
// con esos dos inputs.

export type BondLaw = "NY" | "AR";
export type BondCurrency = "USD";

export interface BondCashflow {
  /** Fecha en formato YYYY-MM-DD */
  date: string;
  /** Tasa anual nominal vigente en ese período (informativa) */
  couponRate: number;
  /** Cupón pagado por VN 100 en esa fecha */
  coupon: number;
  /** Amortización pagada por VN 100 en esa fecha */
  amortization: number;
}

export interface BondDef {
  ticker: string;
  name: string;
  isin?: string;
  law: BondLaw;
  currency: BondCurrency;
  /** Valor nominal residual actual por cada VN 100 originales (1.0 = 100%) */
  residualPct: number;
  /** Flujos futuros remanentes desde HOY (los pasados están filtrados al calcular) */
  flows: BondCashflow[];
  /** Estrategia / nicho típico del bono */
  strategy: string;
  /** Texto de tesis breve */
  thesis: string;
}

// ============================================================
// Helper para generar cupones semestrales step-up
// ============================================================
function buildStepUpFlows(
  startDate: string,
  endDate: string,
  steps: { fromYear: number; rate: number }[],
  amortizations: { date: string; pct: number }[],
): BondCashflow[] {
  const flows: BondCashflow[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startYear = start.getUTCFullYear();

  // Generar fechas semestrales (cada 9-jan / 9-jul típicamente)
  const month = start.getUTCMonth();
  const day = start.getUTCDate();
  let cur = new Date(Date.UTC(startYear, month, day));
  let residual = 1.0; // % VN vigente

  while (cur <= end) {
    const yearsFromStart = cur.getUTCFullYear() - startYear;
    // tasa step-up: la última que aplique según fromYear
    const step = [...steps].reverse().find((s) => yearsFromStart >= s.fromYear) || steps[0];
    const rate = step.rate;
    const couponAmount = (rate / 2) * residual * 100; // semestral
    const dateStr = cur.toISOString().slice(0, 10);

    // amortización si corresponde a esta fecha
    const amort = amortizations.find((a) => a.date === dateStr);
    const amortAmt = amort ? amort.pct * 100 : 0;

    flows.push({
      date: dateStr,
      couponRate: rate,
      coupon: +couponAmount.toFixed(4),
      amortization: +amortAmt.toFixed(4),
    });

    if (amort) residual -= amort.pct;

    // siguiente semestre
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 6, day));
  }

  return flows;
}

// ============================================================
// CRONOGRAMAS HARDCODED
// Fuente: prospectos del canje 2020 (Decreto 391/2020).
// ============================================================

/** AL30 — Bonar 2030 (ley local). Step-up 0.125% → 0.50% → 0.75% → 1.75%.
 *  Amortización en 13 cuotas semestrales iguales desde jul-2024 hasta jul-2030. */
const AL30_AMORTS = [
  "2024-07-09", "2025-01-09", "2025-07-09", "2026-01-09", "2026-07-09",
  "2027-01-09", "2027-07-09", "2028-01-09", "2028-07-09", "2029-01-09",
  "2029-07-09", "2030-01-09", "2030-07-09",
].map((date) => ({ date, pct: 1 / 13 }));

const AL30_STEPS = [
  { fromYear: 0, rate: 0.00125 }, // 2020-2021
  { fromYear: 1, rate: 0.0050 },  // 2021-2023
  { fromYear: 3, rate: 0.0075 },  // 2023-2027
  { fromYear: 7, rate: 0.0175 },  // 2027-2030
];

/** GD30 — Global 2030 (ley NY). Mismo flujo que AL30. */
const GD30_AMORTS = AL30_AMORTS;
const GD30_STEPS = AL30_STEPS;

/** AL35 / GD35 — Bonos 2035. Step-up 0.125% → 1.125% → 1.50% → 3.625% → 4.125% → 4.875%.
 *  Amortización en 10 cuotas semestrales iguales desde jul-2031 hasta jul-2035. */
const BONO35_AMORTS = [
  "2031-01-09", "2031-07-09", "2032-01-09", "2032-07-09", "2033-01-09",
  "2033-07-09", "2034-01-09", "2034-07-09", "2035-01-09", "2035-07-09",
].map((date) => ({ date, pct: 0.10 }));

const BONO35_STEPS = [
  { fromYear: 0, rate: 0.00125 },
  { fromYear: 1, rate: 0.01125 },
  { fromYear: 3, rate: 0.0150 },
  { fromYear: 6, rate: 0.03625 },
  { fromYear: 9, rate: 0.04125 },
  { fromYear: 12, rate: 0.04875 },
];

/** AE38 / GD38 — Bonos 2038. Step-up 0.125% → 2.00% → 3.875% → 4.25% → 5.00%.
 *  Amortización en 22 cuotas semestrales desde jul-2027 hasta jul-2038 (1/22 cada una). */
const BONO38_AMORTS = (() => {
  const dates: string[] = [];
  for (let y = 2027; y <= 2038; y++) {
    dates.push(`${y}-01-09`, `${y}-07-09`);
  }
  return dates.slice(0, 22).map((date) => ({ date, pct: 1 / 22 }));
})();

const BONO38_STEPS = [
  { fromYear: 0, rate: 0.00125 },
  { fromYear: 1, rate: 0.0200 },
  { fromYear: 3, rate: 0.03875 },
  { fromYear: 6, rate: 0.04250 },
  { fromYear: 12, rate: 0.0500 },
];

/** GD41 — Global 2041. Step-up 0.125% → 2.50% → 3.50% → 3.875% → 4.875%.
 *  Amortización en 28 cuotas semestrales desde jul-2028 hasta jul-2041 (1/28 cada una). */
const BONO41_AMORTS = (() => {
  const dates: string[] = [];
  for (let y = 2028; y <= 2041; y++) {
    dates.push(`${y}-01-09`, `${y}-07-09`);
  }
  return dates.slice(0, 28).map((date) => ({ date, pct: 1 / 28 }));
})();

const BONO41_STEPS = [
  { fromYear: 0, rate: 0.00125 },
  { fromYear: 1, rate: 0.0250 },
  { fromYear: 3, rate: 0.0350 },
  { fromYear: 6, rate: 0.03875 },
  { fromYear: 9, rate: 0.04875 },
];

// ============================================================
// CATÁLOGO DE BONOS
// ============================================================
export const BONDS_AR: Record<string, BondDef> = {
  AL30: {
    ticker: "AL30",
    name: "Bonar 2030 (USD ley local)",
    isin: "ARARGE3203H1",
    law: "AR",
    currency: "USD",
    residualPct: 1.0,
    flows: buildStepUpFlows("2020-07-09", "2030-07-09", AL30_STEPS, AL30_AMORTS),
    strategy: "Carry corto USD ley local",
    thesis:
      "Vencimiento próximo y amortización en marcha: bajo riesgo de duration y alto carry en USD. Spread vs GD30 captura prima por jurisdicción local.",
  },
  GD30: {
    ticker: "GD30",
    name: "Global 2030 (USD ley NY)",
    isin: "US040114HX11",
    law: "NY",
    currency: "USD",
    residualPct: 1.0,
    flows: buildStepUpFlows("2020-07-09", "2030-07-09", GD30_STEPS, GD30_AMORTS),
    strategy: "Carry corto USD ley NY",
    thesis:
      "Mismo flujo que AL30 pero bajo legislación de Nueva York. Menor riesgo institucional, ideal para perfiles conservadores que buscan dolarización con renta.",
  },
  AL35: {
    ticker: "AL35",
    name: "Bonar 2035 (USD ley local)",
    law: "AR",
    currency: "USD",
    residualPct: 1.0,
    flows: buildStepUpFlows("2020-07-09", "2035-07-09", BONO35_STEPS, BONO35_AMORTS),
    strategy: "Duration media — captura compresión spreads",
    thesis:
      "Convexidad atractiva ante normalización de riesgo país. Step-up agresivo a partir de 2026 mejora carry futuro.",
  },
  GD35: {
    ticker: "GD35",
    name: "Global 2035 (USD ley NY)",
    law: "NY",
    currency: "USD",
    residualPct: 1.0,
    flows: buildStepUpFlows("2020-07-09", "2035-07-09", BONO35_STEPS, BONO35_AMORTS),
    strategy: "Compresión de spreads + ley NY",
    thesis:
      "El bono favorito para apuestas de compresión de riesgo país. Alta convexidad: ganancia desproporcionada si la TIR baja de 13% hacia 9-10%.",
  },
  AE38: {
    ticker: "AE38",
    name: "Bonar 2038 (USD ley local)",
    law: "AR",
    currency: "USD",
    residualPct: 1.0,
    flows: buildStepUpFlows("2020-07-09", "2038-07-09", BONO38_STEPS, BONO38_AMORTS),
    strategy: "Carry alto + duration larga",
    thesis:
      "Mejor carry corriente del tramo largo. Duration ~6 años: sensible a tasas pero con cupón corriente cercano a 4%.",
  },
  GD38: {
    ticker: "GD38",
    name: "Global 2038 (USD ley NY)",
    law: "NY",
    currency: "USD",
    residualPct: 1.0,
    flows: buildStepUpFlows("2020-07-09", "2038-07-09", BONO38_STEPS, BONO38_AMORTS),
    strategy: "Mayor cupón ley NY",
    thesis:
      "Combina ley NY con el cupón corriente más alto entre los Globales. Preferido por institucionales para 'income en USD'.",
  },
  GD41: {
    ticker: "GD41",
    name: "Global 2041 (USD ley NY)",
    law: "NY",
    currency: "USD",
    residualPct: 1.0,
    flows: buildStepUpFlows("2020-07-09", "2041-07-09", BONO41_STEPS, BONO41_AMORTS),
    strategy: "Máxima convexidad",
    thesis:
      "Bono más largo y de mayor convexidad del menú. Apostar a este es apostar a una Argentina rating B-/B en 2-4 años. No apto para conservadores.",
  },
};

export const BOND_TICKERS = Object.keys(BONDS_AR);

// ============================================================
// CÁLCULOS: TIR, Duration, Próximo cupón
// ============================================================

/** Devuelve los flujos remanentes (futuros desde la fecha dada). */
export function futureFlows(bond: BondDef, asOf: Date = new Date()): BondCashflow[] {
  const ms = asOf.getTime();
  return bond.flows.filter((f) => new Date(f.date).getTime() > ms);
}

/** Calcula la TIR anual a partir del precio sucio (clean+accrued) por VN 100. */
export function calcYTM(bond: BondDef, dirtyPrice: number, asOf: Date = new Date()): number | null {
  const flows = futureFlows(bond, asOf);
  if (!flows.length || dirtyPrice <= 0) return null;

  const cashflows = flows.map((f) => ({
    years: (new Date(f.date).getTime() - asOf.getTime()) / (365.25 * 24 * 3600 * 1000),
    amount: f.coupon + f.amortization,
  }));

  // Newton-Raphson sobre f(y) = -P + Σ CF / (1+y)^t
  let y = 0.10; // semilla 10%
  for (let i = 0; i < 100; i++) {
    let f = -dirtyPrice;
    let df = 0;
    for (const cf of cashflows) {
      const disc = Math.pow(1 + y, cf.years);
      f += cf.amount / disc;
      df -= (cf.years * cf.amount) / (disc * (1 + y));
    }
    const dy = f / df;
    y -= dy;
    if (Math.abs(dy) < 1e-7) return y;
    if (y < -0.5) y = -0.5;
    if (y > 5) y = 5;
  }
  return y;
}

/** Modified duration en años. */
export function calcModDuration(bond: BondDef, dirtyPrice: number, ytm: number, asOf: Date = new Date()): number | null {
  const flows = futureFlows(bond, asOf);
  if (!flows.length || dirtyPrice <= 0) return null;

  let macD = 0;
  for (const f of flows) {
    const t = (new Date(f.date).getTime() - asOf.getTime()) / (365.25 * 24 * 3600 * 1000);
    const cf = f.coupon + f.amortization;
    macD += (t * cf) / Math.pow(1 + ytm, t);
  }
  macD /= dirtyPrice;
  return macD / (1 + ytm);
}

/** Paridad: precio / valor técnico. Valor técnico = residual + intereses corridos (simplificado: residual*100). */
export function calcParity(bond: BondDef, dirtyPrice: number): number {
  const tecnico = bond.residualPct * 100;
  if (tecnico <= 0) return 0;
  return dirtyPrice / tecnico;
}

/** Próximo cupón futuro. */
export function nextCoupon(bond: BondDef, asOf: Date = new Date()): BondCashflow | null {
  const flows = futureFlows(bond, asOf);
  return flows.length ? flows[0] : null;
}

/** Total a cobrar entre dos fechas (suma cupón+amortización por VN100). */
export function totalCashflow(bond: BondDef, from: Date, to: Date): number {
  return bond.flows
    .filter((f) => {
      const t = new Date(f.date).getTime();
      return t > from.getTime() && t <= to.getTime();
    })
    .reduce((acc, f) => acc + f.coupon + f.amortization, 0);
}

/** Calcula cuántas láminas (VN 100) se compran con un monto USD a un precio dado. */
export function nominalsForAmount(amountUSD: number, dirtyPrice: number): number {
  if (dirtyPrice <= 0) return 0;
  return (amountUSD / dirtyPrice) * 100;
}
