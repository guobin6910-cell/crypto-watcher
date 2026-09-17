"use client";

import { useCallback, useEffect, useState } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { RefreshButton } from "@/components/RefreshButton";
import {
  fetchTickers24hr,
  getLastMarketSource,
  marketSourceLabel,
  type MarketDataSource,
} from "@/lib/binance";
import {
  buildDailyWatchlist,
  filterUsdtSpot,
  formatPct,
  formatPrice,
  formatVolume,
  scoreTicker,
} from "@/lib/scoring";
import type { DailyCandidate } from "@/lib/types";

export default function DailyPage() {
  const [items, setItems] = useState<DailyCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [source, setSource] = useState<MarketDataSource | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchTickers24hr();
      const scored = filterUsdtSpot(raw).map(scoreTicker);
      setItems(buildDailyWatchlist(scored, 12));
      setSource(getLastMarketSource());
      setUpdatedAt(new Date().toLocaleString("zh-TW", { hour12: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">今日觀察</h1>
          <p className="mt-1 text-sm text-zinc-400">
            依漲幅、量能、迷因關鍵字與綜合分數排序 · {marketSourceLabel(source)}
            {updatedAt && (
              <span className="ml-2 text-zinc-600">更新於 {updatedAt}</span>
            )}
          </p>
        </div>
        <RefreshButton onClick={() => void load()} loading={loading} />
      </div>

      <Disclaimer />

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">產生觀察名單中…</p>
      ) : (
        <ol className="space-y-4">
          {items.map((c) => (
            <li
              key={c.ticker.symbol}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 text-sm font-bold text-amber-200">
                    {c.rank}
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">
                      {c.ticker.baseAsset}
                      <span className="ml-2 text-sm font-normal text-zinc-500">
                        {c.ticker.symbol}
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-500">
                      分數 {c.ticker.score} · 成交額{" "}
                      {formatVolume(c.ticker.quoteVolume)} USDT
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <p className="text-zinc-100">{formatPrice(c.ticker.lastPrice)}</p>
                  <p
                    className={
                      parseFloat(c.ticker.priceChangePercent) >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }
                  >
                    {formatPct(c.ticker.priceChangePercent)}
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 border-t border-zinc-800/80 pt-3 text-sm text-zinc-300">
                {c.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-500/80">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
