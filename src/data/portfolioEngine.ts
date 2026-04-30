// Motor v4 — lógica core (CAPM, Markowitz, scoring, perfiles)
// Convertido del HTML original a TypeScript puro y testeable.

import type { ProfileKey } from "./iolData";

// ============================================================
// 1. PERFILES Y ASIGNACIÓN ESTRATÉGICA
// ============================================================

export interface EngineAllocation {
  rv: number;       // Renta variable AR
  cedears: number;  // CEDEARs SPY/DJ
  rf: number;       // Renta fija (bonos/ONs)
  cau: number;      // Cauciones
  ef: number;       // Efectivo
  label: string;
  desc: string;
}

export const engineAllocations: Record<ProfileKey, EngineAllocation> = {
  conservador: {
    rv: 15, cedears: 0, rf: 55, cau: 25, ef: 5,
    label: "Conservador",
    desc: "Estabilidad máxima. Bonos CER y cauciones como eje, mínima exposición a renta variable.",
  },
  mod_conservador: {
    rv: 20, cedears: 10, rf: 45, cau: 15, ef: 10,
    label: "Mod. Conservador",
    desc: "Ingresos corrientes con modesto potencial. Bonos + algo de CEDEARs diversificados.",
  },
  moderado: {
    rv: 30, cedears: 15, rf: 30, cau: 10, ef: 15,
    label: "Moderado",
    desc: "Balance riesgo-retorno a largo plazo. Exposición moderada a RV local e internacional.",
  },
  mod_agresivo: {
    rv: 35, cedears: 20, rf: 25, cau: 15, ef: 5,
    label: "Mod. Agresivo",
    desc: "Mayor potencial de crecimiento. CEDEARs + acciones líderes con cobertura en RF.",
  },
  agresivo: {
    rv: 40, cedears: 25, rf: 30, cau: 0, ef: 5,
    label: "Agresivo",
    desc: "Máximo potencial a largo plazo. Renta variable como eje, diversificación global.",
  },
  cp_especulativo: {
    rv: 0, cedears: 100, rf: 0, cau: 0, ef: 0,
    label: "CP Especulativo",
    desc: "100% en CEDEARs SPY/DJ para capturar movimientos de corto plazo con alto riesgo.",
  },
  cp_conservador: {
    rv: 0, cedears: 0, rf: 40, cau: 60, ef: 0,
    label: "CP Conservador",
    desc: "Liquidez y preservación. Cauciones + instrumentos de corto plazo.",
  },
};

// CP Agresivo no existe en ProfileKey original — lo derivamos
export const ALLOC_LABELS = ["Renta Variable", "CEDEARs SPY/DJ", "Renta Fija", "Cauciones", "Efectivo"] as const;

export interface BucketRow {
  label: string;
  pct: number;
  monto: number;
}

export function calcBuckets(
  alloc: EngineAllocation,
  monto: number
): BucketRow[] {
  return [
    { label: "Renta Variable (acciones líderes AR)", pct: alloc.rv,      monto: (monto * alloc.rv) / 100 },
    { label: "CEDEARs SPY / Dow Jones",              pct: alloc.cedears, monto: (monto * alloc.cedears) / 100 },
    { label: "Renta Fija (bonos / ONs)",             pct: alloc.rf,      monto: (monto * alloc.rf) / 100 },
    { label: "Cauciones",                            pct: alloc.cau,     monto: (monto * alloc.cau) / 100 },
    { label: "Efectivo y equivalentes",              pct: alloc.ef,      monto: (monto * alloc.ef) / 100 },
  ];
}

// ============================================================
// 2. YFINANCE INFO + SCORING
// ============================================================

export interface YFInfo {
  forwardPE?: number | null;
  trailingPE?: number | null;
  returnOnEquity?: number | null;
  returnOnAssets?: number | null;
  debtToEquity?: number | null;
  currentRatio?: number | null;
  profitMargins?: number | null;
  dividendYield?: number | null;
  beta?: number | null;
  sector?: string | null;
  industry?: string | null;
  country?: string | null;
  longName?: string | null;
  currentPrice?: number | null;
  targetMeanPrice?: number | null;
  numberOfAnalysts?: number | null;
  recomBuy?: number | null;
  recomHold?: number | null;
  recomSell?: number | null;
  epsEst?: number | null;
  nextEarnings?: string | null;
  freeCashflow?: number | null;
  totalCash?: number | null;
  totalDebt?: number | null;
  ebitda?: number | null;
  marketCap?: number | null;
}

export interface ScoreResult {
  score: number;
  detalle: Record<string, string>;
}

export function calcScoreSalud(info: YFInfo | null | undefined): ScoreResult {
  const detalle: Record<string, string> = {};
  if (!info) return { score: 0, detalle };

  let score = 0;
  const pe = info.trailingPE ?? info.forwardPE ?? null;
  const roe = info.returnOnEquity;
  const roa = info.returnOnAssets;
  const de = info.debtToEquity;
  const cr = info.currentRatio;
  const pm = info.profitMargins;
  const dy = info.dividendYield;

  if (pe && pe > 0 && pe < 25) { score += 18; detalle["P/E < 25x"] = "+18"; }
  else if (pe && pe > 0 && pe < 50) { score += 10; detalle["P/E 25-50x"] = "+10"; }
  else { detalle["P/E alto / N/D"] = "0"; }

  if (roe && roe > 0.2) { score += 20; detalle["ROE > 20%"] = "+20"; }
  else if (roe && roe > 0.1) { score += 12; detalle["ROE 10-20%"] = "+12"; }
  else if (roe && roe > 0) { score += 5; detalle["ROE positivo"] = "+5"; }
  else { detalle["ROE neg / N/D"] = "0"; }

  if (de !== undefined && de !== null) {
    if (de < 50) { score += 18; detalle["D/E < 0.5x"] = "+18"; }
    else if (de < 150) { score += 9; detalle["D/E moderado"] = "+9"; }
    else { detalle["D/E alto"] = "0"; }
  } else { detalle["D/E N/D"] = "0"; }

  if (cr && cr > 2) { score += 14; detalle["Liquidez > 2x"] = "+14"; }
  else if (cr && cr > 1) { score += 7; detalle["Liquidez ok"] = "+7"; }
  else { detalle["Liquidez baja"] = "0"; }

  if (pm && pm > 0.2) { score += 15; detalle["Margen > 20%"] = "+15"; }
  else if (pm && pm > 0.08) { score += 8; detalle["Margen 8-20%"] = "+8"; }
  else { detalle["Margen bajo"] = "0"; }

  if (dy && dy > 0.015) { score += 8; detalle["Div > 1.5%"] = "+8"; }
  else { detalle["Sin div"] = "0"; }

  if (roa && roa > 0.08) { score += 7; detalle["ROA > 8%"] = "+7"; }

  return { score: Math.min(100, score), detalle };
}

export function scoreClass(s: number): "high" | "mid" | "low" {
  if (s >= 60) return "high";
  if (s >= 40) return "mid";
  return "low";
}

// ============================================================
// 3. MAPEO TICKERS IOL → YAHOO
// ============================================================

const TICKER_MAP: Record<string, string> = {
  VALE: "VALE", MELI: "MELI", GLOB: "GLOB", DESP: "DESP",
  YPF: "YPF", GGAL: "GGAL", BMA: "BMA", SUPV: "SUPV",
  CEPU: "CEPU", PAM: "PAM", PAMP: "PAM",
  LOMA: "LOMA.BA", TXAR: "TXAR.BA", ALUA: "ALUA.BA",
  TGNO4: "TGNO4.BA", CRES: "CRES.BA", VALO: "VALO.BA",
  TECO2: "TEO", COME: "COME.BA", IRSA: "IRS", AGRO: "AGRO.BA",
  AAPL: "AAPL", MSFT: "MSFT", GOOGL: "GOOGL", AMZN: "AMZN",
  TSLA: "TSLA", META: "META", NVDA: "NVDA", BABA: "BABA",
  KO: "KO", JPM: "JPM", V: "V", DIS: "DIS",
};

export function mapYFTicker(simbolo: string): string {
  const raiz = simbolo.replace(/[DC]$/, "");
  if (TICKER_MAP[raiz]) return TICKER_MAP[raiz];
  if (/\d$/.test(raiz)) return raiz + ".SA";
  return raiz;
}

// ============================================================
// 4. PANEL TITULOS
// ============================================================

export interface PanelTitulo {
  simbolo: string;
  ultimoPrecio: number;
  variacionPorcentual: number;
  volumenNominal?: number;
  volumen?: number;
  puntas?: { precioCompra?: number; precioVenta?: number };
}

export const PANEL_LABELS: Record<string, string> = {
  cedears: "CEDEARs",
  acciones: "Acciones AR",
  titulosPublicos: "Bonos Soberanos",
  obligacionesNegociables: "ONs",
  cauciones: "Cauciones",
  adrs: "ADRs",
  acciones_eeuu: "Acciones EE.UU",
};

// ============================================================
// 5. CAPM — beta, alpha, correlación, r²
// ============================================================

export interface CAPMResult {
  beta: number;
  alpha: number;        // diario
  alphaAnual: number;   // anualizado
  correl: number;
  r2: number;
  n: number;
}

export function pricesToReturns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] && prices[i - 1]) r.push(prices[i] / prices[i - 1] - 1);
  }
  return r;
}

export function calcCAPM(secPrices: number[], bmPrices: number[]): CAPMResult | null {
  const minLen = Math.min(secPrices.length, bmPrices.length);
  if (minLen < 30) return null;

  const sec = secPrices.slice(-minLen);
  const bm = bmPrices.slice(-minLen);
  const retSec = pricesToReturns(sec);
  const retBm = pricesToReturns(bm);
  const n = Math.min(retSec.length, retBm.length);
  if (n < 20) return null;

  const x = retBm.slice(0, n);
  const y = retSec.slice(0, n);
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let cov = 0, varX = 0, varY = 0;
  for (let i = 0; i < n; i++) {
    cov += (x[i] - meanX) * (y[i] - meanY);
    varX += (x[i] - meanX) ** 2;
    varY += (y[i] - meanY) ** 2;
  }
  const beta = cov / varX;
  const alpha = meanY - beta * meanX;
  const r = cov / Math.sqrt(varX * varY);
  return {
    beta,
    alpha,
    alphaAnual: alpha * 252,
    correl: r,
    r2: r * r,
    n,
  };
}

// ============================================================
// 6. MARKOWITZ — optimización de cartera
// ============================================================

export type MarkowitzStrat = "equi" | "min-var" | "markowitz" | "hrp";

function minimizeVariance(cov: number[][], n: number): number[] {
  let w = new Array(n).fill(1 / n);
  for (let iter = 0; iter < 200; iter++) {
    const grad = cov.map((row) => 2 * row.reduce((s, c, j) => s + c * w[j], 0));
    const lr = 0.01;
    w = w.map((wi, i) => Math.max(0, wi - lr * grad[i]));
    const sum = w.reduce((s, v) => s + v, 0);
    w = w.map((v) => (sum > 0 ? v / sum : 1 / n));
  }
  return w;
}

function maximizeSharpe(cov: number[][], ret: number[], rf: number, n: number): number[] {
  let w = new Array(n).fill(1 / n);
  for (let iter = 0; iter < 300; iter++) {
    const pRet = w.reduce((s, wi, i) => s + wi * ret[i], 0);
    let pVar = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pVar += w[i] * w[j] * cov[i][j];
    const pVol = Math.sqrt(Math.max(pVar, 1e-12));
    const sharpeGrad = ret.map((ri, i) => {
      const dRet = ri;
      const dVar = 2 * cov[i].reduce((s, c, j) => s + c * w[j], 0);
      return (dRet * pVol - (pRet - rf) * dVar / (2 * pVol)) / Math.max(pVar, 1e-12);
    });
    const lr = 0.005;
    w = w.map((wi, i) => Math.max(0.01, wi + lr * sharpeGrad[i]));
    const sum = w.reduce((s, v) => s + v, 0);
    w = w.map((v) => v / sum);
  }
  return w;
}

function hrpWeights(cov: number[][]): number[] {
  const vols = cov.map((row, i) => Math.sqrt(Math.max(row[i], 1e-12)));
  const invVol = vols.map((v) => 1 / v);
  const sum = invVol.reduce((s, v) => s + v, 0);
  return invVol.map((v) => v / sum);
}

export interface MarkowitzResult {
  tickers: string[];
  weights: number[];
  annReturns: number[];
  annVols: number[];
  portReturn: number;
  portVol: number;
  sharpe: number;
  maxDD: number;
  strategy: MarkowitzStrat;
}

/**
 * @param series mapa ticker -> array de retornos diarios (no precios)
 * @param strategy estrategia
 * @param rfDaily tasa libre de riesgo diaria (TNA/252)
 */
export function runMarkowitz(
  series: Record<string, number[]>,
  strategy: MarkowitzStrat,
  rfDaily: number
): MarkowitzResult | null {
  const tickers = Object.keys(series).filter((t) => series[t].length > 5);
  if (tickers.length < 2) return null;

  const minLen = Math.min(...tickers.map((t) => series[t].length));
  const rets = tickers.map((t) => series[t].slice(-minLen));
  const means = rets.map((r) => r.reduce((s, v) => s + v, 0) / r.length);
  const annRet = means.map((m) => m * 252);

  const n = tickers.length;
  const cov: number[][] = [];
  for (let i = 0; i < n; i++) {
    cov.push([]);
    for (let j = 0; j < n; j++) {
      let c = 0;
      for (let k = 0; k < minLen; k++) c += (rets[i][k] - means[i]) * (rets[j][k] - means[j]);
      cov[i].push((c / minLen) * 252);
    }
  }

  let weights: number[];
  if (strategy === "equi") weights = tickers.map(() => 1 / n);
  else if (strategy === "min-var") weights = minimizeVariance(cov, n);
  else if (strategy === "markowitz") weights = maximizeSharpe(cov, annRet, rfDaily * 252, n);
  else weights = hrpWeights(cov);

  const portReturn = weights.reduce((s, w, i) => s + w * annRet[i], 0);
  let portVar = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) portVar += weights[i] * weights[j] * cov[i][j];
  const portVol = Math.sqrt(Math.max(portVar, 1e-12));
  const sharpe = (portReturn - rfDaily * 252) / portVol;
  const maxDD = -portVol * 2.33 / Math.sqrt(252) * Math.sqrt(126);

  return {
    tickers,
    weights,
    annReturns: annRet,
    annVols: cov.map((row, i) => Math.sqrt(Math.max(row[i], 1e-12))),
    portReturn,
    portVol,
    sharpe,
    maxDD,
    strategy,
  };
}

// ============================================================
// 7. INTERPRETACIONES (helpers para UI)
// ============================================================

export function interpretBeta(beta: number): string {
  if (beta > 1.5) return "Alta volatilidad (β>1.5x): amplifica movimientos del mercado";
  if (beta > 1) return "Levemente más volátil que el benchmark";
  if (beta > 0.5) return "Menos volátil que el mercado, correlación positiva";
  if (beta > 0) return "Baja beta, refugio relativo";
  return "Correlación negativa o nula";
}

export function interpretCorrel(r2: number): string {
  if (r2 > 0.7) return "Alto co-movimiento";
  if (r2 > 0.4) return "Moderado co-movimiento";
  return "Bajo co-movimiento";
}

export function interpretBeatRate(beatRate: number | null): string {
  if (beatRate == null) return "Sin datos suficientes";
  if (beatRate >= 70) return "Empresa consistentemente supera estimaciones — alta fiabilidad predictiva";
  if (beatRate >= 50) return "Supera estimaciones en la mayoría de trimestres — fiabilidad moderada";
  return "Sorpresas negativas frecuentes — mayor incertidumbre pre-earnings";
}
