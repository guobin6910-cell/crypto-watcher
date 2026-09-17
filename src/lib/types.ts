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

export type TradeSource = "bot" | "manual";

export interface TradeRecord {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  usdt: number;
  at: string; // ISO
  /** 來源：機器人自動成交或手動；舊資料可能缺省 */
  source?: TradeSource;
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

export type BotUniverse = "watchlist" | "top_volume" | "meme_keywords";

export interface BotSettings {
  startingCapitalUSDT: number;
  maxPositionPct: number;
  maxOpenPositions: number;
  pollIntervalSec: number;
  takeProfitPct: number;
  stopLossPct: number;
  entryThresholdPct: number;
  universe: BotUniverse;
  /** 24h 漲幅 ≤ −entryThreshold 時出場 */
  exitOnReverse: boolean;
  enabled: boolean;
}

export interface BotStatus {
  lastRunAt: string | null;
  lastSignal: string | null;
  lastError: string | null;
  dataSource: "binance" | "coingecko" | null;
  running: boolean;
}
