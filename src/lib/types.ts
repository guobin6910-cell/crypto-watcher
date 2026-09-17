/** Binance 24hr ticker response (subset we use) */
export interface BinanceTicker24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export type ScoreTag =
  | "熱門迷因"
  | "強勢上漲"
  | "溫和上漲"
  | "下跌"
  | "大跌"
  | "高量能"
  | "中量能"
  | "低量能"
  | "波動大";

export interface ScoredTicker extends BinanceTicker24hr {
  baseAsset: string;
  score: number;
  tags: ScoreTag[];
  isMeme: boolean;
}

export type FilterMode = "all" | "meme" | "gainers" | "volume";

export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  usdt: number;
  at: string; // ISO
}

export interface PortfolioState {
  cash: number;
  initialCash: number;
  positions: Position[];
  history: TradeRecord[];
  updatedAt: string;
}

export interface DailyCandidate {
  ticker: ScoredTicker;
  rank: number;
  reasons: string[];
}
