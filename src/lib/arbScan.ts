/** 紙上多市場價差掃描：Binance vs OKX 公開行情，非真實套利 */

export type VenueQuote = {
  venue: "binance" | "okx";
  symbol: string; // BTCUSDT
  bid: number;
  ask: number;
  mid: number;
};

export type SpreadOpp = {
  symbol: string;
  buyVenue: "binance" | "okx";
  sellVenue: "binance" | "okx";
  buyAsk: number;
  sellBid: number;
  grossPct: number;
  netPct: number;
  feePct: number;
};

export type PaperTrade = {
  t: string;
  symbol: string;
  buyVenue: string;
  sellVenue: string;
  notional: number;
  netPct: number;
  pnl: number;
  equityAfter: number;
};

export type ArbPaperState = {
  equity: number;
  starting: number;
  trades: PaperTrade[];
  lastScanAt: string | null;
  scans: number;
};

const STORAGE_KEY = "crypto-watcher-arb-paper-v1";

export const ARB_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "DOTUSDT",
  "MATICUSDT",
  "NEARUSDT",
  "ATOMUSDT",
  "LTCUSDT",
  "UNIUSDT",
  "APTUSDT",
  "ARBUSDT",
  "OPUSDT",
  "SUIUSDT",
  "PEPEUSDT",
  "WIFUSDT",
  "TONUSDT",
  "TRXUSDT",
  "SHIBUSDT",
  "FILUSDT",
  "INJUSDT",
  "AAVEUSDT",
  "MKRUSDT",
  "SEIUSDT",
  "TIAUSDT",
  "ORDIUSDT",
  "WLDUSDT",
  "RENDERUSDT",
  "FETUSDT",
  "IMXUSDT",
  "STXUSDT",
  "INJUSDT",
  "HBARUSDT",
  "ICPUSDT",
  "ETCUSDT",
  "BCHUSDT",
  "ALGOUSDT",
  "VETUSDT",
  "SANDUSDT",
  "MANAUSDT",
  "AXSUSDT",
  "GALAUSDT",
  "FLOWUSDT",
  "XLMUSDT",
  "EOSUSDT",
] as const;

function uniqSymbols(): string[] {
  return [...new Set(ARB_WATCHLIST)];
}

async function fetchJson(url: string): Promise<unknown> {
  const proxies = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];
  let lastErr: unknown;
  for (const u of proxies) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(u, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}

function toOkxInst(symbol: string): string {
  // BTCUSDT -> BTC-USDT
  if (symbol.endsWith("USDT")) {
    return `${symbol.slice(0, -4)}-USDT`;
  }
  return symbol;
}

export async function fetchBinanceBooks(
  symbols: string[],
): Promise<Map<string, VenueQuote>> {
  const url = "https://api.binance.com/api/v3/ticker/bookTicker";
  const data = (await fetchJson(url)) as Array<{
    symbol: string;
    bidPrice: string;
    askPrice: string;
  }>;
  const want = new Set(symbols);
  const map = new Map<string, VenueQuote>();
  for (const row of data) {
    if (!want.has(row.symbol)) continue;
    const bid = Number(row.bidPrice);
    const ask = Number(row.askPrice);
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) {
      continue;
    }
    map.set(row.symbol, {
      venue: "binance",
      symbol: row.symbol,
      bid,
      ask,
      mid: (bid + ask) / 2,
    });
  }
  return map;
}

export async function fetchOkxBooks(
  symbols: string[],
): Promise<Map<string, VenueQuote>> {
  // OKX allows multiple instId with comma in one request (limit ~100)
  const instIds = symbols.map(toOkxInst).join(",");
  const url = `https://www.okx.com/api/v5/market/tickers?instType=SPOT`;
  const data = (await fetchJson(url)) as {
    code?: string;
    data?: Array<{
      instId: string;
      bidPx: string;
      askPx: string;
      last: string;
    }>;
  };
  const want = new Set(symbols.map(toOkxInst));
  const map = new Map<string, VenueQuote>();
  for (const row of data.data ?? []) {
    if (!want.has(row.instId)) continue;
    const bid = Number(row.bidPx);
    const ask = Number(row.askPx);
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) {
      continue;
    }
    const symbol = row.instId.replace("-", "");
    map.set(symbol, {
      venue: "okx",
      symbol,
      bid,
      ask,
      mid: (bid + ask) / 2,
    });
  }
  // silence unused
  void instIds;
  return map;
}

export function findCrossVenueOpps(
  binance: Map<string, VenueQuote>,
  okx: Map<string, VenueQuote>,
  feePctPerLeg = 0.1,
): SpreadOpp[] {
  const feePct = feePctPerLeg * 2;
  const out: SpreadOpp[] = [];
  for (const [symbol, b] of binance) {
    const o = okx.get(symbol);
    if (!o) continue;

    // Buy binance ask, sell okx bid
    const g1 = ((o.bid - b.ask) / b.ask) * 100;
    if (Number.isFinite(g1)) {
      out.push({
        symbol,
        buyVenue: "binance",
        sellVenue: "okx",
        buyAsk: b.ask,
        sellBid: o.bid,
        grossPct: g1,
        netPct: g1 - feePct,
        feePct,
      });
    }
    // Buy okx ask, sell binance bid
    const g2 = ((b.bid - o.ask) / o.ask) * 100;
    if (Number.isFinite(g2)) {
      out.push({
        symbol,
        buyVenue: "okx",
        sellVenue: "binance",
        buyAsk: o.ask,
        sellBid: b.bid,
        grossPct: g2,
        netPct: g2 - feePct,
        feePct,
      });
    }
  }
  return out
    .filter((x) => Number.isFinite(x.netPct))
    .sort((a, b) => b.netPct - a.netPct);
}

export function defaultPaperState(starting = 100): ArbPaperState {
  return {
    equity: starting,
    starting,
    trades: [],
    lastScanAt: null,
    scans: 0,
  };
}

export function loadPaperState(): ArbPaperState {
  if (typeof window === "undefined") return defaultPaperState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPaperState();
    const j = JSON.parse(raw) as ArbPaperState;
    if (!j || typeof j.equity !== "number") return defaultPaperState();
    return {
      ...defaultPaperState(),
      ...j,
      trades: Array.isArray(j.trades) ? j.trades.slice(0, 200) : [],
    };
  } catch {
    return defaultPaperState();
  }
}

export function savePaperState(s: ArbPaperState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function resetPaperState(starting = 100): ArbPaperState {
  const s = defaultPaperState(starting);
  savePaperState(s);
  return s;
}

/** 紙上執行：若淨利差 > 門檻，用固定名義本金模擬一筆 */
export function maybePaperExecute(
  state: ArbPaperState,
  opps: SpreadOpp[],
  opts: { minNetPct: number; notionalPct: number },
): ArbPaperState {
  const top = opps.find((o) => o.netPct >= opts.minNetPct);
  if (!top || state.equity <= 1) {
    return {
      ...state,
      lastScanAt: new Date().toISOString(),
      scans: state.scans + 1,
    };
  }
  const notional = Math.min(
    state.equity * Math.max(0.05, Math.min(0.5, opts.notionalPct)),
    state.equity * 0.95,
  );
  const pnl = notional * (top.netPct / 100);
  const equity = Math.max(0, state.equity + pnl);
  const trade: PaperTrade = {
    t: new Date().toISOString(),
    symbol: top.symbol,
    buyVenue: top.buyVenue,
    sellVenue: top.sellVenue,
    notional,
    netPct: top.netPct,
    pnl,
    equityAfter: equity,
  };
  const next: ArbPaperState = {
    equity,
    starting: state.starting,
    trades: [trade, ...state.trades].slice(0, 200),
    lastScanAt: trade.t,
    scans: state.scans + 1,
  };
  savePaperState(next);
  return next;
}

export async function runArbScan(feePctPerLeg = 0.1): Promise<{
  binanceCount: number;
  okxCount: number;
  opps: SpreadOpp[];
  note: string;
}> {
  const symbols = uniqSymbols();
  const [binance, okx] = await Promise.all([
    fetchBinanceBooks(symbols).catch(() => new Map<string, VenueQuote>()),
    fetchOkxBooks(symbols).catch(() => new Map<string, VenueQuote>()),
  ]);
  const opps = findCrossVenueOpps(binance, okx, feePctPerLeg);
  const note =
    binance.size === 0 && okx.size === 0
      ? "兩邊行情都抓不到（可能被 CORS／地區擋），請稍後再試。"
      : binance.size === 0
        ? "幣安行情失敗，僅有 OKX（跨所價差需兩邊）。"
        : okx.size === 0
          ? "OKX 行情失敗，僅有幣安（跨所價差需兩邊）。"
          : `幣安 ${binance.size}／OKX ${okx.size} 檔可對比；手續費假設單邊 ${feePctPerLeg}%`;
  return {
    binanceCount: binance.size,
    okxCount: okx.size,
    opps,
    note,
  };
}
