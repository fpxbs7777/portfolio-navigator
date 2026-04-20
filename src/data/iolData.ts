// Datos de la metodología IOL: test, perfiles y portafolios
// Basado en la guía "ETFs, Valor Intrínseco & Perfiles de Inversor — Argentina"

export type ProfileKey =
  | "cp_conservador"
  | "cp_especulativo"
  | "conservador"
  | "mod_conservador"
  | "moderado"
  | "mod_agresivo"
  | "agresivo";

export interface TestOption {
  label: string;
  score: number;
}

export interface TestQuestion {
  id: string;
  dimension: "HT" | "TR";
  question: string;
  options: TestOption[];
}

// Test IOL (simplificado, fiel a la metodología)
export const iolTest: TestQuestion[] = [
  {
    id: "ht1",
    dimension: "HT",
    question: "¿En cuánto tiempo planeás retirar tu inversión?",
    options: [
      { label: "Menos de 1 año", score: 1 },
      { label: "Entre 1 y 3 años", score: 3 },
      { label: "Entre 3 y 7 años", score: 6 },
      { label: "Más de 7 años", score: 9 },
    ],
  },
  {
    id: "ht2",
    dimension: "HT",
    question: "¿Cómo planeás retirar el capital invertido?",
    options: [
      { label: "Todo de una vez, lo antes posible", score: 1 },
      { label: "En cuotas, durante 1-3 años", score: 4 },
      { label: "Gradualmente, durante 5+ años", score: 7 },
      { label: "Solo retiraré renta, manteniendo el capital", score: 9 },
    ],
  },
  {
    id: "tr1",
    dimension: "TR",
    question: "¿Cuál es tu nivel de conocimiento del mercado financiero?",
    options: [
      { label: "Nulo o muy básico", score: 1 },
      { label: "Conozco productos básicos (plazo fijo, FCI)", score: 3 },
      { label: "Opero acciones, bonos, CEDEARs habitualmente", score: 6 },
      { label: "Avanzado: opciones, derivados, análisis fundamental", score: 9 },
    ],
  },
  {
    id: "tr2",
    dimension: "TR",
    question: "Frente a una caída del 25% del valor de tu cartera, ¿qué harías?",
    options: [
      { label: "Vendería todo de inmediato", score: 1 },
      { label: "Vendería parte para cubrirme", score: 3 },
      { label: "Mantendría sin cambios", score: 6 },
      { label: "Compraría más, aprovechando el precio", score: 9 },
    ],
  },
  {
    id: "tr3",
    dimension: "TR",
    question: "¿Qué experiencia tenés invirtiendo?",
    options: [
      { label: "Ninguna", score: 1 },
      { label: "Menos de 2 años", score: 3 },
      { label: "Entre 2 y 5 años", score: 6 },
      { label: "Más de 5 años con varios ciclos de mercado", score: 9 },
    ],
  },
  {
    id: "tr4",
    dimension: "TR",
    question: "¿Qué escenario de rendimiento elegirías?",
    options: [
      { label: "Ganar 4% sin riesgo de pérdida", score: 1 },
      { label: "Ganar 8% con riesgo de perder 5%", score: 4 },
      { label: "Ganar 15% con riesgo de perder 15%", score: 7 },
      { label: "Ganar 25%+ con riesgo de perder 30%", score: 9 },
    ],
  },
];

// Determina perfil según puntajes HT y TR
export function determineProfile(htScore: number, trScore: number): ProfileKey {
  // Horizonte: 1-4 corto, 5-11 mediano, 12+ largo
  // Tolerancia: 0-9 baja, 10-13 media, 14-18 alta (test simplificado: ajustamos a escala)
  const isShort = htScore <= 6;
  const isLong = htScore >= 14;

  const isLow = trScore <= 12;
  const isMid = trScore > 12 && trScore <= 22;
  const isHigh = trScore > 22;

  if (isShort) {
    if (isHigh) return "cp_especulativo";
    return "cp_conservador";
  }
  if (isLong) {
    if (isLow) return "conservador";
    if (isMid) return "moderado";
    return "agresivo";
  }
  // Mediano plazo
  if (isLow) return "conservador";
  if (isMid) return "mod_conservador";
  return "mod_agresivo";
}

export interface PortfolioRow {
  asset: string;
  ticker: string;
  weight: number;
  currency: string;
  review: string;
}

export interface Profile {
  key: ProfileKey;
  name: string;
  tagline: string;
  horizon: string;
  description: string;
  drawdown: string;
  expectedReturn: string;
  bestCase: string;
  worstCase: string;
  allocation: { rv: number; rf: number; cash: number };
  portfolio: PortfolioRow[];
  strategy: string;
  tips: string[];
}

export const profiles: Record<ProfileKey, Profile> = {
  cp_conservador: {
    key: "cp_conservador",
    name: "Corto Plazo Conservador",
    tagline: "Liquidez y preservación absoluta",
    horizon: "HT: 1-4 / TR: 0-9",
    description:
      "Necesita liquidez en menos de 5 años. Prioridad absoluta: preservar capital. Sin tolerancia a pérdidas.",
    drawdown: "-5% en 12 meses",
    expectedReturn: "7,2%",
    bestCase: "+16,3%",
    worstCase: "-5,6%",
    allocation: { rv: 0, rf: 40, cash: 60 },
    portfolio: [
      { asset: "Efectivo / Money Market", ticker: "LCTM, FCI MM IOL", weight: 60, currency: "ARS", review: "Diario" },
      { asset: "Bonos cortos", ticker: "AL29 / GD29 / BOPREAL S3", weight: 25, currency: "USD", review: "Mensual" },
      { asset: "CER corto", ticker: "TX24 / X18E5", weight: 10, currency: "ARS", review: "Mensual" },
      { asset: "CEDEAR defensivo", ticker: "BRK.B", weight: 5, currency: "USD", review: "Semanal" },
    ],
    strategy:
      "Casi 100% en renta fija y liquidez. Instrumentos CER y T+1 para proteger contra inflación sin exposición a renta variable.",
    tips: [
      "Confirmar que el cliente realmente necesitará el dinero <5 años",
      "Priorizar instrumentos con liquidez T+0 / T+1",
      "Evitar bonos largos (duration baja siempre)",
      "Revisar tasa real positiva mensualmente",
    ],
  },
  cp_especulativo: {
    key: "cp_especulativo",
    name: "Corto Plazo Especulativo",
    tagline: "Trader activo, alta beta",
    horizon: "HT: 1-4 / TR: 14-18",
    description:
      "Trader activo. Horizonte días/semanas. Opera con análisis técnico, opciones y acciones de alta beta.",
    drawdown: "Sin límite predefinido — gestión por stop-loss técnico",
    expectedReturn: "Variable alta",
    bestCase: "+50%+",
    worstCase: "-28%+",
    allocation: { rv: 100, rf: 0, cash: 0 },
    portfolio: [
      { asset: "Acciones ARG alta beta", ticker: "GGAL, BBAR, PAMP, VALO, TECO2", weight: 50, currency: "ARS", review: "Diario" },
      { asset: "CEDEARs volátiles", ticker: "MELI, GLOB, TSLA, NVDA", weight: 30, currency: "USD", review: "Diario" },
      { asset: "Opciones BYMA", ticker: "Calls/Puts GGAL, GFG, PAMP", weight: 15, currency: "ARS", review: "Diario" },
      { asset: "Caja táctica", ticker: "LCTM / FCI rescatable", weight: 5, currency: "ARS", review: "T+0" },
    ],
    strategy:
      "100% renta variable. Concentrado en acciones argentinas líderes y CEDEARs líquidos. Uso selectivo de opciones para apalancamiento o cobertura táctica.",
    tips: [
      "Definir SIEMPRE stop-loss antes de entrar",
      "No más de 5% del capital por trade individual",
      "Llevar bitácora de operaciones obligatoria",
      "Revisar exposición a margen y apalancamiento diario",
    ],
  },
  conservador: {
    key: "conservador",
    name: "Conservador",
    tagline: "Renta en USD, capital protegido",
    horizon: "HT: 5-18 / TR: 0-9",
    description:
      "Largo plazo con baja tolerancia al riesgo. Busca preservar capital en USD y obtener renta vía bonos.",
    drawdown: "-10% en USD en 12 meses",
    expectedReturn: "8-10% USD",
    bestCase: "+20%",
    worstCase: "-8%",
    allocation: { rv: 20, rf: 55, cash: 25 },
    portfolio: [
      { asset: "Bonos soberanos USD", ticker: "GD30, GD35, GD38, GD41", weight: 35, currency: "USD", review: "Semestral" },
      { asset: "Bonos sub/corp USD", ticker: "PGO5, YMCXO, CS38", weight: 20, currency: "USD", review: "Semestral" },
      { asset: "LECAP / LICTM", ticker: "Tramo 90-180 días", weight: 25, currency: "ARS", review: "Mensual" },
      { asset: "CEDEAR defensivo", ticker: "BRK.B, JNJ, KO, PG", weight: 10, currency: "USD", review: "Mensual" },
      { asset: "ETF dividendos", ticker: "DVY / VIG CEDEAR", weight: 5, currency: "USD", review: "Trimestral" },
      { asset: "Acción ARG defensiva", ticker: "TGSU2, PAMP", weight: 5, currency: "ARS", review: "Mensual" },
    ],
    strategy:
      "Anclado en bonos soberanos y corporativos en USD (55%). Complemento en acciones defensivas y ETFs de dividendo para batir inflación dólar sin asumir riesgo de equity puro.",
    tips: [
      "Priorizar TIR sobre potencial de upside",
      "Diversificar emisores corporativos (no concentrar >7% en una ON)",
      "Escalonar vencimientos para reducir riesgo de reinversión",
      "El cliente debe entender: bonos pueden caer aunque no defaulteen",
    ],
  },
  mod_conservador: {
    key: "mod_conservador",
    name: "Moderado Conservador",
    tagline: "Crecimiento con ancla de renta fija",
    horizon: "HT: 5-18 / TR: 10-13",
    description:
      "Busca crecimiento moderado con predominio de renta fija. Acepta algo de volatilidad por mayor rentabilidad.",
    drawdown: "-15% en USD en 12 meses",
    expectedReturn: "10-13% USD",
    bestCase: "+28%",
    worstCase: "-12%",
    allocation: { rv: 40, rf: 45, cash: 15 },
    portfolio: [
      { asset: "Bonos soberanos", ticker: "GD30/GD35 (60% HD, 40% CER)", weight: 30, currency: "USD/ARS", review: "Semestral" },
      { asset: "Corp / Subsoberano", ticker: "PGO5, YCA6O, Neuquén 2030", weight: 15, currency: "USD", review: "Semestral" },
      { asset: "CEDEAR S&P500", ticker: "SPY / IVV CEDEAR", weight: 15, currency: "USD", review: "Mensual" },
      { asset: "CEDEAR Nasdaq", ticker: "QQQ CEDEAR", weight: 5, currency: "USD", review: "Mensual" },
      { asset: "Acciones ARG líderes", ticker: "GGAL, BMA, PAMP", weight: 10, currency: "ARS", review: "Mensual" },
      { asset: "LECAP corto", ticker: "60-90 días", weight: 15, currency: "ARS", review: "Mensual" },
      { asset: "Caja", ticker: "FCI MM / Caja USD", weight: 10, currency: "ARS/USD", review: "Diario" },
    ],
    strategy:
      "Combinación equilibrada. Bonos USD como ancla (45%), renta variable vía CEDEARs de índices globales para capturar crecimiento sin selección de acciones individuales.",
    tips: [
      "Rebalanceo trimestral si una clase se desvía >5% del target",
      "ETFs de índice antes que acciones individuales",
      "Mantener buffer de caja del 10-15%",
      "Explicar al cliente: drawdowns del 10-15% son esperables",
    ],
  },
  moderado: {
    key: "moderado",
    name: "Moderado",
    tagline: "60/40 adaptado a Argentina",
    horizon: "HT: 5-18 / TR: 14-18",
    description:
      "Largo plazo. No necesita rentas corrientes. Acepta volatilidad moderada para crecer capital significativamente.",
    drawdown: "-20% en USD en 12 meses",
    expectedReturn: "12-15% USD",
    bestCase: "+35%",
    worstCase: "-18%",
    allocation: { rv: 60, rf: 30, cash: 10 },
    portfolio: [
      { asset: "ETF S&P500", ticker: "SPY / IVV CEDEAR", weight: 25, currency: "USD", review: "Trimestral" },
      { asset: "ETF Nasdaq / Tech", ticker: "QQQ / ARKK CEDEAR", weight: 10, currency: "USD", review: "Trimestral" },
      { asset: "ETF emergentes", ticker: "EEM CEDEAR", weight: 5, currency: "USD", review: "Trimestral" },
      { asset: "Acciones ARG líderes", ticker: "GGAL, PAMP, YPF, BMA, TGSU2", weight: 15, currency: "ARS/USD", review: "Mensual" },
      { asset: "Bonos USD", ticker: "GD30, AL30, BOPREAL", weight: 20, currency: "USD", review: "Semestral" },
      { asset: "ON corporativas", ticker: "YCA6O, PGO5", weight: 10, currency: "USD", review: "Semestral" },
      { asset: "Caja / LECAP", ticker: "Buffer liquidez", weight: 10, currency: "ARS", review: "Mensual" },
      { asset: "Opciones cobertura", ticker: "Puts GGAL / Collar SPY", weight: 5, currency: "ARS", review: "Trimestral" },
    ],
    strategy:
      "60/40 adaptado al mercado argentino. ETFs de índices como columna vertebral. Complemento en acciones locales selectivas y renta fija para reducir volatilidad.",
    tips: [
      "ETFs son el núcleo — no sobre-rotar",
      "Acciones ARG: solo líderes con FCF positivo",
      "Considerar coberturas tácticas en eventos electorales",
      "Disciplina: revisar trimestralmente, no semanalmente",
    ],
  },
  mod_agresivo: {
    key: "mod_agresivo",
    name: "Moderado Agresivo",
    tagline: "Selección activa con base global",
    horizon: "HT: 12+ / TR: 14-18",
    description:
      "Horizonte 7+ años. Acepta alta volatilidad. Foco en crecimiento. Selecciona acciones individuales además de índices.",
    drawdown: "-28% en USD en 12 meses",
    expectedReturn: "15-20% USD",
    bestCase: "+45%",
    worstCase: "-24%",
    allocation: { rv: 80, rf: 15, cash: 5 },
    portfolio: [
      { asset: "ETF S&P500 núcleo", ticker: "SPY CEDEAR", weight: 25, currency: "USD", review: "Trimestral" },
      { asset: "ETF Nasdaq / Growth", ticker: "QQQ / SOXX CEDEAR", weight: 15, currency: "USD", review: "Trimestral" },
      { asset: "Acciones globales select", ticker: "NVDA, MSFT, GOOGL, AMZN", weight: 10, currency: "USD", review: "Mensual" },
      { asset: "Acc. ARG alto potencial", ticker: "GGAL, YPF, BMA, VALO, MIRG", weight: 20, currency: "ARS/USD", review: "Mensual" },
      { asset: "ETF small caps", ticker: "IWM CEDEAR", weight: 5, currency: "USD", review: "Trimestral" },
      { asset: "Bonos USD cortos", ticker: "GD29 / AL29", weight: 15, currency: "USD", review: "Semestral" },
      { asset: "Caja + Opciones", ticker: "LCTM + Calls/CC GGAL", weight: 10, currency: "ARS", review: "Mensual" },
    ],
    strategy:
      "80% renta variable con diversificación global. Combinación de ETFs de índice + acciones individuales seleccionadas por valor intrínseco. Renta fija al mínimo estructural.",
    tips: [
      "Calcular valor intrínseco antes de cada acción individual",
      "Margen de seguridad mínimo del 25% antes de comprar",
      "No más del 8% del portafolio en una sola acción",
      "Aprovechar caídas del 15%+ para promediar a la baja",
    ],
  },
  agresivo: {
    key: "agresivo",
    name: "Agresivo",
    tagline: "Convicción y máxima exposición",
    horizon: "HT: 12+ / TR: 14-18",
    description:
      "Máxima exposición a renta variable. Horizonte 10+ años. Tolera caídas del 30%+ sin vender.",
    drawdown: "Sin piso — gestión por convicción en fundamentales",
    expectedReturn: "18-25%+ USD",
    bestCase: "+60%+",
    worstCase: "-35%+",
    allocation: { rv: 95, rf: 0, cash: 5 },
    portfolio: [
      { asset: "Acciones globales large", ticker: "NVDA, MSFT, GOOGL, META, AMZN", weight: 30, currency: "USD", review: "Mensual" },
      { asset: "ETF crecimiento", ticker: "QQQ / ARKK CEDEAR", weight: 15, currency: "USD", review: "Trimestral" },
      { asset: "Acc. ARG max retorno", ticker: "GGAL, BMA, YPF, MIRG, VALO, TECO2", weight: 25, currency: "ARS/USD", review: "Mensual" },
      { asset: "Small caps / sectoriales", ticker: "SOXX, IWM, XLK CEDEARs", weight: 15, currency: "USD", review: "Trimestral" },
      { asset: "Opciones BYMA", ticker: "Bull spread, calls GGAL/PAMP", weight: 10, currency: "ARS", review: "Mensual" },
      { asset: "Caja mínima", ticker: "FCI rescatable", weight: 5, currency: "ARS", review: "Diario" },
    ],
    strategy:
      "100% renta variable salvo buffer de liquidez. Selección activa por valor intrínseco + ETFs de crecimiento. Opciones para apalancamiento controlado.",
    tips: [
      "El cliente DEBE haber atravesado un bear market sin vender",
      "Concentración máxima por acción: 12-15%",
      "Análisis fundamental obligatorio (DCF, FCF yield, moat)",
      "Rebalanceo solo si la tesis cambia, no por precio",
    ],
  },
};

export const profileOrder: ProfileKey[] = [
  "cp_conservador",
  "cp_especulativo",
  "conservador",
  "mod_conservador",
  "moderado",
  "mod_agresivo",
  "agresivo",
];

// Glosario
export interface GlossaryTerm {
  term: string;
  category: string;
  definition: string;
}

export const glossary: GlossaryTerm[] = [
  { term: "ETF", category: "Instrumentos", definition: "Exchange Traded Fund. Fondo cotizado que replica un índice. Combina diversificación con liquidez de acción." },
  { term: "CEDEAR", category: "Instrumentos", definition: "Certificado de Depósito Argentino. Replica acciones o ETFs extranjeros en pesos en BYMA. Precio incorpora CCL." },
  { term: "TER / OCF", category: "Costos", definition: "Total Expense Ratio. Comisión anual de gestión del ETF. Buscar <0,30% para impacto mínimo en compuesto." },
  { term: "UCITS", category: "Regulación", definition: "Normativa europea de fondos de inversión. Esencial para inversores europeos, no aplica directamente en ARG." },
  { term: "Acc / Dist", category: "Instrumentos", definition: "Acumulación: dividendos reinvertidos automáticamente. Distribución: dividendos pagados en efectivo." },
  { term: "AUM", category: "Costos", definition: "Assets Under Management. Mínimo recomendado USD 500M para ETFs (riesgo de cierre por debajo)." },
  { term: "CCL", category: "Mercado ARG", definition: "Contado con Liquidación. Tipo de cambio implícito al comprar/vender activos en pesos y liquidar en USD afuera." },
  { term: "TIR", category: "Bonos", definition: "Tasa Interna de Retorno. Rendimiento anualizado si se mantiene el bono hasta vencimiento." },
  { term: "Paridad", category: "Bonos", definition: "Precio de mercado del bono como % del valor nominal. Paridad 50 = bono cotiza a la mitad del VN." },
  { term: "Duration", category: "Bonos", definition: "Sensibilidad del precio del bono a cambios en tasa de interés. Mayor duration = mayor volatilidad." },
  { term: "EMBI+", category: "Bonos", definition: "Emerging Markets Bond Index. Mide el spread de bonos soberanos emergentes sobre Treasuries EE.UU." },
  { term: "FCF", category: "Valuación", definition: "Free Cash Flow. Flujo de caja libre. Base del cálculo de valor intrínseco en acciones." },
  { term: "P/E (PER)", category: "Valuación", definition: "Price/Earnings Ratio. Precio sobre ganancia por acción. Múltiplo de valoración por excelencia." },
  { term: "CAPE", category: "Valuación", definition: "Cyclically Adjusted P/E (Shiller). P/E ajustado por ciclo, promedia 10 años de ganancias reales." },
  { term: "BYMA", category: "Mercado ARG", definition: "Bolsas y Mercados Argentinos. Mercado donde cotizan acciones, CEDEARs, bonos y opciones locales." },
  { term: "ON", category: "Instrumentos", definition: "Obligación Negociable. Bono corporativo emitido por empresas argentinas. Puede ser ARS o USD." },
  { term: "Spread bid-ask", category: "Mercado ARG", definition: "Diferencia entre precio de compra y venta. Amplio en CEDEARs — usar siempre órdenes limitadas." },
  { term: "Hedged", category: "Instrumentos", definition: "ETF con cobertura cambiaria. Elimina riesgo FX entre divisa del índice y divisa de cotización." },
  { term: "Drawdown", category: "Riesgo", definition: "Caída máxima desde un pico hasta un valle en un período. Métrica clave de tolerancia al riesgo." },
  { term: "Moat", category: "Valuación", definition: "Ventaja competitiva durable de una empresa. Concepto Buffett: foso defensivo del castillo." },
];

// Checklist
export interface ChecklistSection {
  title: string;
  items: string[];
}

export const checklist: ChecklistSection[] = [
  {
    title: "Definición de perfil",
    items: [
      "Completé el test IOL con respuestas veraces (no las que 'quisiera' dar)",
      "Entiendo qué significa mi score de Horizonte Temporal y Tolerancia al Riesgo",
      "Conozco mi asignación sugerida (% RV / RF / Caja)",
      "Sé cuándo necesitaré los fondos y a qué velocidad retiraré",
    ],
  },
  {
    title: "Selección de instrumentos",
    items: [
      "Elegí ETFs con TER < 0,30% anual",
      "Verifiqué que el AUM del ETF supere USD 500 millones",
      "No tengo falsa diversificación (mismo top-10 en múltiples ETFs)",
      "Los CEDEARs elegidos tienen volumen operado en BYMA > USD 100k/día",
      "Conozco TIR, paridad y duration de cada bono en cartera",
      "Analicé cobertura de deuda y rating implícito de las ONs corporativas",
    ],
  },
  {
    title: "Valoración",
    items: [
      "Para acciones individuales: calculé valor intrínseco con ≥ 2 métodos",
      "Para ETFs de índice: comparé el P/E actual vs. media histórica a 10 años",
      "Para bonos: la TIR justifica el riesgo soberano/corporativo asumido",
      "Apliqué margen de seguridad ≥ 20-30% antes de comprar acciones individuales",
    ],
  },
  {
    title: "Gestión del riesgo",
    items: [
      "Ninguna posición individual supera el 20% del portafolio total",
      "Definí mi plan de rebalanceo (¿cada cuánto? ¿con qué trigger?)",
      "Tengo exposición en USD (CEDEARs, bonos) para cubrir devaluación",
      "Tengo caja suficiente para aprovechar caídas sin vender posiciones en pérdida",
      "Conozco el peor escenario posible de mi portafolio y lo acepto",
    ],
  },
  {
    title: "Disciplina conductual",
    items: [
      "No voy a vender en la primera caída del 10-15% si los fundamentales no cambiaron",
      "Tengo un IPS (Investment Policy Statement) escrito con mi tesis",
      "Reviso fundamentales cada trimestre, no el precio cada día",
      "No concentraré más del 10% en ninguna tesis especulativa",
    ],
  },
];
