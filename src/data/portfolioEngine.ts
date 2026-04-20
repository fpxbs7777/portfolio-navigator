// Motor de score de salud financiera (basado en metodología Coronar/ETR)
// Convertido del HTML original a TypeScript puro y testeable.

export interface YFInfo {
  forwardPE?: number | null;
  trailingPE?: number | null;
  returnOnEquity?: number | null;
  returnOnAssets?: number | null;
  debtToEquity?: number | null;
  currentRatio?: number | null;
  profitMargins?: number | null;
  dividendYield?: number | null;
  sector?: string | null;
  industry?: string | null;
  longName?: string | null;
}

export interface ScoreResult {
  score: number;
  detalle: Record<string, string>;
}

export function calcScoreSalud(info: YFInfo | null | undefined): ScoreResult {
  const detalle: Record<string, string> = {};
  if (!info) return { score: 0, detalle };

  let score = 0;
  const pe = info.trailingPE ?? info.forwardPE;
  const roe = info.returnOnEquity;
  const roa = info.returnOnAssets;
  const de = info.debtToEquity;
  const cr = info.currentRatio;
  const pm = info.profitMargins;
  const dy = info.dividendYield;

  if (pe && pe > 0 && pe < 50) { score += 15; detalle["P/E razonable"] = "+15"; }
  else if (pe && pe >= 50) { score += 5; detalle["P/E elevado"] = "+5"; }
  else { detalle["P/E N/D"] = "0"; }

  if (roe && roe > 0.15) { score += 20; detalle["ROE > 15%"] = "+20"; }
  else if (roe && roe > 0.05) { score += 10; detalle["ROE 5-15%"] = "+10"; }
  else { detalle["ROE bajo/neg"] = "0"; }

  if (de !== undefined && de !== null) {
    if (de < 50) { score += 20; detalle["D/E < 0.5x"] = "+20"; }
    else if (de < 150) { score += 10; detalle["D/E moderado"] = "+10"; }
    else { detalle["D/E alto"] = "0"; }
  } else { detalle["D/E N/D"] = "0"; }

  if (cr && cr > 2) { score += 15; detalle["Liquidez alta"] = "+15"; }
  else if (cr && cr > 1) { score += 8; detalle["Liquidez ok"] = "+8"; }
  else { detalle["Liquidez baja"] = "0"; }

  if (pm && pm > 0.15) { score += 15; detalle["Margen > 15%"] = "+15"; }
  else if (pm && pm > 0.05) { score += 8; detalle["Margen 5-15%"] = "+8"; }
  else { detalle["Margen bajo"] = "0"; }

  if (dy && dy > 0.01) { score += 10; detalle["Dividendo > 1%"] = "+10"; }
  else { detalle["Sin dividendo"] = "0"; }

  if (roa && roa > 0.05) { score += 5; detalle["ROA > 5%"] = "+5"; }

  return { score: Math.min(100, score), detalle };
}

// Mapeo CEDEAR/Acción ARG → ticker Yahoo Finance
const TICKER_MAP: Record<string, string> = {
  VALE: "VALE", MELI: "MELI", GLOB: "GLOB", DESP: "DESP",
  LOMA: "LOMA.BA", GGAL: "GGAL", BMA: "BMA", SUPV: "SUPV",
  TXAR: "TXAR.BA", ALUA: "ALUA.BA", PAMP: "PAM",
  YPF: "YPF", CEPU: "CEPU", TGNO4: "TGNO4.BA",
  VALO: "VALO.BA", CRES: "CRES.BA",
  AAPL: "AAPL", MSFT: "MSFT", GOOGL: "GOOGL", AMZN: "AMZN",
  TSLA: "TSLA", META: "META", NVDA: "NVDA", BABA: "BABA",
};

export function mapYFTicker(simbolo: string): string {
  const raiz = simbolo.replace(/[DC]$/, "");
  if (TICKER_MAP[raiz]) return TICKER_MAP[raiz];
  if (/\d$/.test(raiz)) return raiz + ".SA";
  return raiz;
}

export function scoreClass(s: number): "high" | "mid" | "low" {
  if (s >= 60) return "high";
  if (s >= 40) return "mid";
  return "low";
}

// Mapeo del perfil IOL del test → asignación de cartera del motor ETR
import type { ProfileKey } from "./iolData";

export interface EngineAllocation {
  rv: number;
  cedears: number;
  rf: number;
  cau: number;
  ef: number;
}

export const engineAllocations: Record<ProfileKey, EngineAllocation> = {
  cp_conservador:  { rv: 0,  cedears: 0,   rf: 40, cau: 60, ef: 0 },
  cp_especulativo: { rv: 30, cedears: 25,  rf: 30, cau: 15, ef: 0 },
  conservador:     { rv: 15, cedears: 0,   rf: 55, cau: 25, ef: 5 },
  mod_conservador: { rv: 20, cedears: 10,  rf: 45, cau: 15, ef: 10 },
  moderado:        { rv: 30, cedears: 15,  rf: 30, cau: 10, ef: 15 },
  mod_agresivo:    { rv: 35, cedears: 20,  rf: 25, cau: 15, ef: 5 },
  agresivo:        { rv: 40, cedears: 25,  rf: 30, cau: 0,  ef: 5 },
};

// Datos demo para usar sin login IOL
export interface PanelTitulo {
  simbolo: string;
  ultimoPrecio: number;
  variacionPorcentual: number;
}

export function getDemoPanel(panel: string): PanelTitulo[] {
  const data: Record<string, PanelTitulo[]> = {
    cedears: [
      { simbolo: "AAPL", ultimoPrecio: 22150.5, variacionPorcentual: 1.23 },
      { simbolo: "MSFT", ultimoPrecio: 19800, variacionPorcentual: 0.87 },
      { simbolo: "GOOGL", ultimoPrecio: 18500.75, variacionPorcentual: -0.45 },
      { simbolo: "AMZN", ultimoPrecio: 21300, variacionPorcentual: 2.1 },
      { simbolo: "TSLA", ultimoPrecio: 16800.25, variacionPorcentual: -3.2 },
      { simbolo: "META", ultimoPrecio: 24100, variacionPorcentual: 1.55 },
      { simbolo: "NVDA", ultimoPrecio: 31500.5, variacionPorcentual: 4.3 },
      { simbolo: "MELI", ultimoPrecio: 195000, variacionPorcentual: 2.8 },
      { simbolo: "BABA", ultimoPrecio: 9800, variacionPorcentual: -1.1 },
      { simbolo: "VALE", ultimoPrecio: 11200.3, variacionPorcentual: 0.65 },
    ],
    acciones: [
      { simbolo: "GGAL", ultimoPrecio: 6850, variacionPorcentual: 2.3 },
      { simbolo: "BMA", ultimoPrecio: 8200, variacionPorcentual: 1.8 },
      { simbolo: "YPF", ultimoPrecio: 31200, variacionPorcentual: 3.1 },
      { simbolo: "PAMP", ultimoPrecio: 3450, variacionPorcentual: -0.9 },
      { simbolo: "TXAR", ultimoPrecio: 1120, variacionPorcentual: 0.45 },
      { simbolo: "ALUA", ultimoPrecio: 1650, variacionPorcentual: 1.2 },
      { simbolo: "CEPU", ultimoPrecio: 2300, variacionPorcentual: -1.5 },
      { simbolo: "CRES", ultimoPrecio: 4200, variacionPorcentual: 0.75 },
    ],
    titulosPublicos: [
      { simbolo: "AL30", ultimoPrecio: 66200, variacionPorcentual: 0.3 },
      { simbolo: "GD30", ultimoPrecio: 65800, variacionPorcentual: 0.25 },
      { simbolo: "AL35", ultimoPrecio: 58500, variacionPorcentual: -0.1 },
      { simbolo: "GD35", ultimoPrecio: 58100, variacionPorcentual: 0.15 },
      { simbolo: "TX26", ultimoPrecio: 110200, variacionPorcentual: 0.08 },
    ],
    obligacionesNegociables: [
      { simbolo: "YCA6O", ultimoPrecio: 102.5, variacionPorcentual: 0.05 },
      { simbolo: "YMCHO", ultimoPrecio: 103.2, variacionPorcentual: 0.12 },
      { simbolo: "TGS2O", ultimoPrecio: 101.8, variacionPorcentual: 0.03 },
    ],
    cauciones: [
      { simbolo: "CAUC1", ultimoPrecio: 100, variacionPorcentual: 0.08 },
      { simbolo: "CAUC7", ultimoPrecio: 100, variacionPorcentual: 0.09 },
    ],
  };
  return data[panel] || data.cedears;
}

export const PANEL_LABELS: Record<string, string> = {
  cedears: "CEDEARs",
  acciones: "Acciones AR",
  titulosPublicos: "Bonos Soberanos",
  obligacionesNegociables: "ONs",
  cauciones: "Cauciones",
};
