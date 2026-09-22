/** 公開行情研究掃描：對齊研究框架，但不虛構鏈上／財報數字 */

export type MarketRegime = {
  btcChange24h: number;
  ethChange24h: number;
  btcDominanceHint: string;
  regimeLabel: string;
  crowdedVsOverlooked: string;
  summary: string;
};

export type ResearchCandidate = {
  id: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number | null;
  fdv: number | null;
  mcapFdv: number | null;
  volume24h: number | null;
  volMcap: number | null;
  change24h: number | null;
  change7d: number | null;
  athChangePct: number | null;
  score: number;
  thesis: string;
  catalysts: string[];
  risks: string[];
  dataGaps: string[];
  tags: string[];
};

export type ResearchReport = {
  generatedAt: string;
  source: string;
  regime: MarketRegime;
  candidates: ResearchCandidate[];
  whatCouldBeWrong: string[];
  note: string;
};

interface CgMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  market_cap: number | null;
  fully_diluted_valuation: number | null;
  total_volume: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  ath_change_percentage: number | null;
  market_cap_rank: number | null;
}

const CG_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h,7d";

const BLUE_CHIPS = new Set([
  "bitcoin",
  "ethereum",
  "tether",
  "usd-coin",
  "binancecoin",
  "ripple",
  "staked-ether",
  "wrapped-bitcoin",
  "wrapped-steth",
]);

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

function scoreCoin(
  m: CgMarket,
  btcChg: number
): Omit<ResearchCandidate, "thesis" | "catalysts" | "risks" | "dataGaps"> & {
  rawBoost: number;
} {
  const tags: string[] = [];
  let score = 40;
  let rawBoost = 0;

  const mcap = m.market_cap;
  const fdv = m.fully_diluted_valuation;
  const vol = m.total_volume;
  const ch24 = m.price_change_percentage_24h;
  const ch7 = m.price_change_percentage_7d_in_currency ?? null;
  const ath = m.ath_change_percentage;
  const mcapFdv =
    mcap != null && fdv != null && fdv > 0 ? mcap / fdv : null;
  const volMcap =
    mcap != null && vol != null && mcap > 0 ? vol / mcap : null;

  // Prefer mid-cap asymmetric range (~$80M–$8B), not mega blue chips
  if (mcap != null) {
    if (mcap >= 8e7 && mcap <= 8e9) {
      score += 18;
      tags.push("中型市值區間");
      rawBoost += 1;
    } else if (mcap > 8e9 && mcap <= 3e10) {
      score += 6;
      tags.push("大型但非巨頭");
    } else if (mcap < 5e7) {
      score -= 8;
      tags.push("微型市值高風險");
    }
  }

  if (mcapFdv != null) {
    if (mcapFdv >= 0.7) {
      score += 10;
      tags.push("流通／FDV 較健康");
    } else if (mcapFdv < 0.35) {
      score -= 12;
      tags.push("未解鎖壓力偏高");
    } else {
      score += 2;
    }
  }

  if (volMcap != null) {
    if (volMcap >= 0.08 && volMcap <= 0.6) {
      score += 10;
      tags.push("量能／市值尚可");
    } else if (volMcap > 0.8) {
      score += 4;
      tags.push("量能異常高（注意炒作）");
    } else if (volMcap < 0.02) {
      score -= 10;
      tags.push("流動性偏弱");
    }
  }

  // Relative strength vs BTC 24h
  if (ch24 != null && Number.isFinite(btcChg)) {
    const rel = ch24 - btcChg;
    if (rel >= 4) {
      score += 12;
      tags.push("相對 BTC 偏強");
      rawBoost += 1;
    } else if (rel <= -6) {
      score -= 8;
      tags.push("相對 BTC 偏弱");
    }
  }

  if (ch7 != null) {
    if (ch7 >= 8 && ch7 <= 40) {
      score += 8;
      tags.push("七日溫和走強");
    } else if (ch7 > 60) {
      score -= 4;
      tags.push("七日過熱需警惕");
    } else if (ch7 <= -20) {
      score -= 6;
      tags.push("七日顯著回撤");
    }
  }

  // Drawdown from ATH can mean mispricing OR value trap
  if (ath != null) {
    if (ath <= -70 && ath >= -92) {
      score += 6;
      tags.push("距 ATH 大幅折價");
      rawBoost += 1;
    } else if (ath > -15) {
      score -= 4;
      tags.push("接近歷史高點");
    }
  }

  if (BLUE_CHIPS.has(m.id)) {
    score -= 25;
    tags.push("藍籌過濾（非非對稱首選）");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    id: m.id,
    name: m.name,
    symbol: (m.symbol || "").toUpperCase(),
    price: m.current_price ?? 0,
    marketCap: mcap,
    fdv,
    mcapFdv,
    volume24h: vol,
    volMcap,
    change24h: ch24,
    change7d: ch7,
    athChangePct: ath,
    score,
    tags,
    rawBoost,
  };
}

function buildNarrative(
  c: ReturnType<typeof scoreCoin>
): Pick<ResearchCandidate, "thesis" | "catalysts" | "risks" | "dataGaps"> {
  const thesisParts: string[] = [];
  if (c.tags.includes("中型市值區間")) {
    thesisParts.push("落在中型市值帶，較有機會出現估值與敘事脫鉤的觀察空間");
  }
  if (c.tags.includes("相對 BTC 偏強")) {
    thesisParts.push("短期相對比特幣走強，資金偏好可能轉向該敘事");
  }
  if (c.tags.includes("距 ATH 大幅折價")) {
    thesisParts.push("距離歷史高點折價深，需分辨是錯價還是基本面惡化");
  }
  if (c.tags.includes("流通／FDV 較健康")) {
    thesisParts.push("市值相對 FDV 較高，即期稀釋壓力表面上較低");
  }
  if (thesisParts.length === 0) {
    thesisParts.push("公開行情指標中性，尚不足以構成強非對稱論點");
  }

  const catalysts: string[] = [
    "需自行核對：生態路線圖、主網／升級時程（官方文件）",
    "需自行核對：解鎖日曆與關鍵夥伴上線",
  ];
  if (c.change7d != null && c.change7d > 0) {
    catalysts.push("近七日價格動能偏正（行情面，非保證延續）");
  }

  const risks: string[] = [];
  if (c.tags.includes("未解鎖壓力偏高")) {
    risks.push("FDV 遠高於流通市值，後續解鎖可能壓抑價格");
  }
  if (c.tags.includes("流動性偏弱")) {
    risks.push("成交量相對市值偏低，進出場滑價風險高");
  }
  if (c.tags.includes("七日過熱需警惕")) {
    risks.push("短期漲幅過大，回撤機率上升");
  }
  risks.push("公開 API 無法驗證內線拋售、合約集中度、真實收入");
  risks.push("監管、橋接、智慧合約與對手方風險未納入本掃描");

  const dataGaps = [
    "活躍地址／橋接流量／巨鯨持倉：本頁未接專用鏈上 API",
    "協議收入、TVL、開發者活躍度：請對照 DefiLlama／官方 dashboard",
    "競品對照與質押通膨：需人工補齊文件與財報",
  ];

  return {
    thesis: thesisParts.join("；") + "。",
    catalysts,
    risks,
    dataGaps,
  };
}

function regimeFrom(btc?: CgMarket, eth?: CgMarket): MarketRegime {
  const btcChange24h = btc?.price_change_percentage_24h ?? 0;
  const ethChange24h = eth?.price_change_percentage_24h ?? 0;
  let regimeLabel = "震盪整理";
  if (btcChange24h >= 3) regimeLabel = "風險偏好偏多（BTC 偏強）";
  else if (btcChange24h <= -3) regimeLabel = "風險偏好轉弱（BTC 偏弱）";

  const ethOut = ethChange24h - btcChange24h;
  let crowdedVsOverlooked =
    "巨頭流動性通常擁擠；非對稱機會較可能出現在中型、敘事未定價標的";
  if (ethOut >= 2) {
    crowdedVsOverlooked =
      "ETH 相對 BTC 偏強，資金可能擁擠在主流 L1／質押敘事；可對照中型生態是否被忽略";
  } else if (ethOut <= -2) {
    crowdedVsOverlooked =
      "ETH 相對偏弱，山寨風險偏好可能下降；Overlooked 標的更需流動性與解鎖檢查";
  }

  const btcDominanceHint =
    "本頁未直接抓 BTC.D；請另開 TradingView／CoinGecko 全球市佔核對";

  const summary = `BTC 24h ${fmtPct(btcChange24h)}、ETH 24h ${fmtPct(
    ethChange24h
  )}。體制判斷：${regimeLabel}。${crowdedVsOverlooked}。`;

  return {
    btcChange24h,
    ethChange24h,
    btcDominanceHint,
    regimeLabel,
    crowdedVsOverlooked,
    summary,
  };
}

export async function runResearchScan(topN = 8): Promise<ResearchReport> {
  const res = await fetch(CG_URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `CoinGecko HTTP ${res.status}（可能被限流，請稍後再試）`
    );
  }
  const markets = (await res.json()) as CgMarket[];
  if (!Array.isArray(markets) || markets.length === 0) {
    throw new Error("CoinGecko 回傳空白");
  }

  const btc = markets.find((m) => m.id === "bitcoin");
  const eth = markets.find((m) => m.id === "ethereum");
  const regime = regimeFrom(btc, eth);
  const btcChg = regime.btcChange24h;

  const scored = markets
    .filter((m) => m.current_price != null && (m.market_cap ?? 0) > 0)
    .map((m) => scoreCoin(m, btcChg))
    .filter((c) => !BLUE_CHIPS.has(c.id))
    .sort((a, b) => b.score - a.score || b.rawBoost - a.rawBoost)
    .slice(0, Math.max(5, Math.min(10, topN)));

  const candidates: ResearchCandidate[] = scored.map((c) => {
    const n = buildNarrative(c);
    const { rawBoost: _r, ...rest } = c;
    void _r;
    return { ...rest, ...n };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: "CoinGecko markets（公開、無金鑰）",
    regime,
    candidates,
    whatCouldBeWrong: [
      "市值／成交量可能被刷量或穩定幣流動性扭曲",
      "相對強度只看 24h／7d，無法代表中期趨勢",
      "未驗證代幣解鎖、團隊持股與真實收入，多頭論點可能瞬時失效",
      "總體流動性收縮時，中型標的回撤常大於模型預期",
      "API 限流或延遲會讓排序過時",
    ],
    note:
      "此報告依公開行情啟發式篩選，對齊研究框架的「市場體制→候選→空方挑戰」結構；鏈上與基本面缺口已標在資料缺口。非投資建議。",
  };
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(4)}`;
}

export { fmtPct };
