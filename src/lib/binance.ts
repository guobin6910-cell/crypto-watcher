import type { BinanceTicker24hr } from "./types";

export type MarketDataSource = "binance" | "coingecko";

const BINANCE_URL = "https://api.binance.com/api/v3/ticker/24hr";
const COINGECKO_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&sparkline=false&price_change_percentage=24h";

let lastSource: MarketDataSource | null = null;

export function getLastMarketSource(): MarketDataSource | null {
  return lastSource;
}

export function marketSourceLabel(source: MarketDataSource | null): string {
  if (source === "binance") return "幣安公開 REST";
  if (source === "coingecko") return "CoinGecko 公開市價（USDT 對映）";
  return "公開市場資料";
}

async function fetchBinance(): Promise<BinanceTicker24hr[]> {
  const res = await fetch(BINANCE_URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Binance HTTP ${res.status}`);
  }
  const data = (await res.json()) as BinanceTicker24hr[];
  if (!Array.isArray(data)) {
    throw new Error("Binance 行情資料格式錯誤");
  }
  return data;
}

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  high_24h: number | null;
  low_24h: number | null;
  total_volume: number | null;
  price_change_24h: number | null;
  price_change_percentage_24h: number | null;
}

function toBinanceShape(m: CoinGeckoMarket): BinanceTicker24hr | null {
  const base = (m.symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!base || base === "USDT" || base === "USD") return null;
  const last = m.current_price;
  if (last == null || !Number.isFinite(last) || last <= 0) return null;

  const changePct = m.price_change_percentage_24h ?? 0;
  const change = m.price_change_24h ?? (last * changePct) / 100;
  const open = last - change;
  const high = m.high_24h ?? last;
  const low = m.low_24h ?? last;
  const quoteVol = m.total_volume ?? 0;
  const volume = last > 0 ? quoteVol / last : 0;
  const s = (n: number) => String(n);

  return {
    symbol: `${base}USDT`,
    priceChange: s(change),
    priceChangePercent: s(changePct),
    weightedAvgPrice: s(last),
    prevClosePrice: s(open > 0 ? open : last),
    lastPrice: s(last),
    lastQty: "0",
    bidPrice: s(last),
    askPrice: s(last),
    openPrice: s(open > 0 ? open : last),
    highPrice: s(high),
    lowPrice: s(low),
    volume: s(volume),
    quoteVolume: s(quoteVol),
    openTime: 0,
    closeTime: Date.now(),
    firstId: 0,
    lastId: 0,
    count: 0,
  };
}

async function fetchCoinGeckoPage(page: number): Promise<CoinGeckoMarket[]> {
  const url = `${COINGECKO_MARKETS}&per_page=250&page=${page}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CoinGecko HTTP ${res.status} ${text.slice(0, 80)}`);
  }
  const data = (await res.json()) as CoinGeckoMarket[] | { status?: { error_message?: string } };
  if (!Array.isArray(data)) {
    const msg =
      data && typeof data === "object" && "status" in data
        ? data.status?.error_message
        : undefined;
    throw new Error(msg || "CoinGecko 行情資料格式錯誤");
  }
  return data;
}

async function fetchCoinGecko(): Promise<BinanceTicker24hr[]> {
  // Two pages ≈ top 500 by market cap (USDT-pair oriented symbols)
  const pages = await Promise.all([
    fetchCoinGeckoPage(1),
    fetchCoinGeckoPage(2).catch(() => [] as CoinGeckoMarket[]),
  ]);
  const seen = new Set<string>();
  const out: BinanceTicker24hr[] = [];
  for (const m of pages.flat()) {
    const t = toBinanceShape(m);
    if (!t || seen.has(t.symbol)) continue;
    seen.add(t.symbol);
    out.push(t);
  }
  if (out.length === 0) {
    throw new Error("CoinGecko 未回傳可用行情");
  }
  return out;
}

/**
 * Prefer Binance public REST from the browser when CORS/geo allows;
 * otherwise fall back to CoinGecko public markets (USD ≈ USDT marks).
 */
export async function fetchTickers24hr(): Promise<BinanceTicker24hr[]> {
  try {
    const data = await fetchBinance();
    lastSource = "binance";
    return data;
  } catch (binanceErr) {
    try {
      const data = await fetchCoinGecko();
      lastSource = "coingecko";
      return data;
    } catch (geckoErr) {
      const a = binanceErr instanceof Error ? binanceErr.message : String(binanceErr);
      const b = geckoErr instanceof Error ? geckoErr.message : String(geckoErr);
      throw new Error(`無法取得行情（幣安：${a}；CoinGecko：${b}）`);
    }
  }
}

export function priceMap(tickers: BinanceTicker24hr[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of tickers) {
    const p = parseFloat(t.lastPrice);
    if (Number.isFinite(p)) map[t.symbol] = p;
  }
  return map;
}
