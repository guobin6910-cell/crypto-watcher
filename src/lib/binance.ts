import type { BinanceTicker24hr } from "./types";

const CLIENT_PATH = "/api/binance/ticker/24hr";

export async function fetchTickers24hr(): Promise<BinanceTicker24hr[]> {
  const res = await fetch(CLIENT_PATH, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`無法取得行情 (${res.status}) ${text.slice(0, 120)}`);
  }
  const data = (await res.json()) as BinanceTicker24hr[];
  if (!Array.isArray(data)) {
    throw new Error("行情資料格式錯誤");
  }
  return data;
}

export function priceMap(tickers: BinanceTicker24hr[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of tickers) {
    const p = parseFloat(t.lastPrice);
    if (Number.isFinite(p)) map[t.symbol] = p;
  }
  return map;
}
