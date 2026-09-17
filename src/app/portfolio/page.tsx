"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { RefreshButton } from "@/components/RefreshButton";
import { fetchTickers24hr, priceMap } from "@/lib/binance";
import {
  DEFAULT_CASH,
  buy,
  equity,
  loadPortfolio,
  resetPortfolio,
  savePortfolio,
  sell,
} from "@/lib/portfolio";
import { formatPrice } from "@/lib/scoring";
import type { PortfolioState } from "@/lib/types";

export default function PortfolioPage() {
  const [state, setState] = useState<PortfolioState | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [symbols, setSymbols] = useState<string[]>([]);
  const [loadingPx, setLoadingPx] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [qty, setQty] = useState("0.01");
  const [initialEdit, setInitialEdit] = useState(String(DEFAULT_CASH));

  useEffect(() => {
    const p = loadPortfolio();
    setState(p);
    setInitialEdit(String(p.initialCash));
  }, []);

  const loadPrices = useCallback(async () => {
    setLoadingPx(true);
    setError(null);
    try {
      const tickers = await fetchTickers24hr();
      const map = priceMap(tickers);
      setPrices(map);
      const usdt = Object.keys(map)
        .filter((s) => s.endsWith("USDT") && !s.includes("_"))
        .sort();
      setSymbols(usdt);
      setSymbol((prev) => {
        if (usdt.includes(prev)) return prev;
        if (usdt.includes("BTCUSDT")) return "BTCUSDT";
        return usdt[0] ?? prev;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "行情載入失敗");
    } finally {
      setLoadingPx(false);
    }
  }, []);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  const persist = (next: PortfolioState) => {
    savePortfolio(next);
    setState(next);
  };

  const lastPrice = prices[symbol] ?? 0;
  const totalEquity = useMemo(
    () => (state ? equity(state, prices) : 0),
    [state, prices]
  );
  const pnl = state ? totalEquity - state.initialCash : 0;
  const pnlPct = state && state.initialCash > 0 ? (pnl / state.initialCash) * 100 : 0;

  const onBuy = () => {
    if (!state) return;
    setMsg(null);
    const q = parseFloat(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setMsg("請輸入有效數量");
      return;
    }
    if (!(lastPrice > 0)) {
      setMsg("尚無最新價，請先重新整理行情");
      return;
    }
    const result = buy(state, symbol, q, lastPrice);
    if (!result.ok) {
      setMsg(result.error);
      return;
    }
    persist(result.state);
    setMsg(`已虛擬買入 ${q} ${symbol.replace("USDT", "")} @ ${formatPrice(lastPrice)}`);
  };

  const onSell = () => {
    if (!state) return;
    setMsg(null);
    const q = parseFloat(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setMsg("請輸入有效數量");
      return;
    }
    if (!(lastPrice > 0)) {
      setMsg("尚無最新價，請先重新整理行情");
      return;
    }
    const result = sell(state, symbol, q, lastPrice);
    if (!result.ok) {
      setMsg(result.error);
      return;
    }
    persist(result.state);
    setMsg(`已虛擬賣出 ${q} ${symbol.replace("USDT", "")} @ ${formatPrice(lastPrice)}`);
  };

  const onReset = () => {
    const cash = parseFloat(initialEdit);
    const initial = Number.isFinite(cash) && cash > 0 ? cash : DEFAULT_CASH;
    if (!confirm(`確定重置虛擬倉？將以 ${initial} USDT 重新開始，持倉與紀錄會清空。`)) {
      return;
    }
    const next = resetPortfolio(initial);
    setState(next);
    setMsg("已重置虛擬倉");
  };

  const applyInitialCash = () => {
    if (!state) return;
    const cash = parseFloat(initialEdit);
    if (!Number.isFinite(cash) || cash <= 0) {
      setMsg("起始資金必須大於 0");
      return;
    }
    if (state.positions.length > 0 || state.history.length > 0) {
      if (
        !confirm(
          "已有持倉或交易紀錄。調整起始資金會重置現金與部位（與重置相同）。是否繼續？"
        )
      ) {
        return;
      }
      const next = resetPortfolio(cash);
      setState(next);
      setMsg(`已設起始資金為 ${cash} USDT 並重置`);
      return;
    }
    const next: PortfolioState = {
      ...state,
      cash,
      initialCash: cash,
      updatedAt: new Date().toISOString(),
    };
    persist(next);
    setMsg(`起始資金已設為 ${cash} USDT`);
  };

  if (!state) {
    return <p className="py-16 text-center text-zinc-500">載入虛擬倉…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">虛擬倉</h1>
          <p className="mt-1 text-sm text-zinc-400">
            以幣安公開最新價模擬現貨 USDT 買賣 · 資料僅存本機
          </p>
        </div>
        <RefreshButton onClick={() => void loadPrices()} loading={loadingPx} />
      </div>

      <Disclaimer />

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
          {msg}
        </div>
      )}

      {/* Summary */}
      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="現金 (USDT)" value={formatPrice(state.cash)} />
        <Stat label="總權益 (USDT)" value={formatPrice(totalEquity)} />
        <Stat
          label="未實現／總損益"
          value={`${pnl >= 0 ? "+" : ""}${formatPrice(pnl)}`}
          accent={pnl >= 0 ? "up" : "down"}
        />
        <Stat
          label="報酬率"
          value={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`}
          accent={pnlPct >= 0 ? "up" : "down"}
        />
      </section>

      {/* Initial cash */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-medium text-zinc-300">起始資金</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            step={100}
            value={initialEdit}
            onChange={(e) => setInitialEdit(e.target.value)}
            className="w-40 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500/50"
          />
          <span className="text-sm text-zinc-500">USDT（預設 10000）</span>
          <button
            type="button"
            onClick={applyInitialCash}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
          >
            套用
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
          >
            重置虛擬倉
          </button>
        </div>
      </section>

      {/* Trade form */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-zinc-200">虛擬下單（現貨 USDT）</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="text-zinc-500">交易對</span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-amber-500/50"
            >
              {(symbols.length ? symbols : [symbol]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">數量</span>
            <input
              type="number"
              min={0}
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-amber-500/50"
            />
          </label>
          <div className="text-sm">
            <p className="text-zinc-500">最新價</p>
            <p className="mt-1 font-mono text-lg tabular-nums">
              {lastPrice > 0 ? formatPrice(lastPrice) : "—"}{" "}
              <span className="text-xs text-zinc-500">USDT</span>
            </p>
          </div>
          <div className="text-sm">
            <p className="text-zinc-500">預估金額</p>
            <p className="mt-1 font-mono text-lg tabular-nums">
              {lastPrice > 0 && parseFloat(qty) > 0
                ? formatPrice(lastPrice * parseFloat(qty))
                : "—"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onBuy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            買入
          </button>
          <button
            type="button"
            onClick={onSell}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
          >
            賣出
          </button>
        </div>
      </section>

      {/* Positions */}
      <section>
        <h2 className="mb-3 font-medium text-zinc-200">持倉</h2>
        {state.positions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
            尚無持倉，請先虛擬買入
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">標的</th>
                  <th className="px-3 py-2 font-medium">數量</th>
                  <th className="px-3 py-2 font-medium">均價</th>
                  <th className="px-3 py-2 font-medium">最新價</th>
                  <th className="px-3 py-2 font-medium">市值</th>
                  <th className="px-3 py-2 font-medium">浮盈虧</th>
                </tr>
              </thead>
              <tbody>
                {state.positions.map((p) => {
                  const px = prices[p.symbol] ?? p.avgPrice;
                  const mv = p.qty * px;
                  const upnl = (px - p.avgPrice) * p.qty;
                  return (
                    <tr key={p.symbol} className="border-t border-zinc-800/80">
                      <td className="px-3 py-2 font-medium">{p.symbol}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{p.qty}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {formatPrice(p.avgPrice)}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {formatPrice(px)}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {formatPrice(mv)}
                      </td>
                      <td
                        className={`px-3 py-2 font-mono tabular-nums ${
                          upnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {upnl >= 0 ? "+" : ""}
                        {formatPrice(upnl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <h2 className="mb-3 font-medium text-zinc-200">成交紀錄</h2>
        {state.history.length === 0 ? (
          <p className="text-sm text-zinc-500">尚無紀錄</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 p-3">
            {state.history.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/50 pb-2 text-sm last:border-0"
              >
                <span>
                  <span
                    className={
                      h.side === "buy" ? "text-emerald-400" : "text-rose-400"
                    }
                  >
                    {h.side === "buy" ? "買" : "賣"}
                  </span>{" "}
                  {h.symbol} · {h.qty} @ {formatPrice(h.price)}
                </span>
                <span className="font-mono text-zinc-400">
                  {formatPrice(h.usdt)} USDT ·{" "}
                  {new Date(h.at).toLocaleString("zh-TW", { hour12: false })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "up" | "down";
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`mt-1 font-mono text-lg tabular-nums ${
          accent === "up"
            ? "text-emerald-400"
            : accent === "down"
              ? "text-rose-400"
              : "text-zinc-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
