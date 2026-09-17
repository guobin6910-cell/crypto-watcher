"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { RefreshButton } from "@/components/RefreshButton";
import { TickerCard } from "@/components/TickerCard";
import { fetchTickers24hr } from "@/lib/binance";
import { filterUsdtSpot, scoreTicker } from "@/lib/scoring";
import type { FilterMode, ScoredTicker } from "@/lib/types";

const FILTERS: { id: FilterMode; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "meme", label: "熱門迷因" },
  { id: "gainers", label: "漲幅" },
  { id: "volume", label: "量能" },
];

export default function WatchboardPage() {
  const [scored, setScored] = useState<ScoredTicker[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchTickers24hr();
      const usdt = filterUsdtSpot(raw);
      setScored(usdt.map(scoreTicker));
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

  const visible = useMemo(() => {
    let list = scored;
    if (filter === "meme") {
      list = list.filter((t) => t.isMeme);
    } else if (filter === "gainers") {
      list = [...list].sort(
        (a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
      );
    } else if (filter === "volume") {
      list = [...list].sort(
        (a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)
      );
    } else {
      list = [...list].sort((a, b) => b.score - a.score);
    }

    const query = q.trim().toUpperCase();
    if (query) {
      list = list.filter(
        (t) => t.symbol.includes(query) || t.baseAsset.includes(query)
      );
    }

    return list.slice(0, filter === "all" && !query ? 60 : 120);
  }, [scored, filter, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">觀測看板</h1>
          <p className="mt-1 text-sm text-zinc-400">
            幣安公開 24 小時行情 · USDT 現貨交易對
            {updatedAt && (
              <span className="ml-2 text-zinc-600">更新於 {updatedAt}</span>
            )}
          </p>
        </div>
        <RefreshButton onClick={() => void load()} loading={loading} />
      </div>

      <Disclaimer />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                filter === f.id
                  ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/40"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="搜尋幣種，例如 BTC"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-500/50 sm:w-56"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading && scored.length === 0 ? (
        <p className="text-center text-zinc-500 py-16">載入行情中…</p>
      ) : (
        <>
          <p className="text-xs text-zinc-500">顯示 {visible.length} 筆</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((t) => (
              <TickerCard key={t.symbol} ticker={t} />
            ))}
          </div>
          {visible.length === 0 && (
            <p className="py-12 text-center text-zinc-500">沒有符合條件的交易對</p>
          )}
        </>
      )}
    </div>
  );
}
