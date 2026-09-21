"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import {
  loadPaperState,
  maybePaperExecute,
  resetPaperState,
  runArbScan,
  savePaperState,
  type ArbPaperState,
  type SpreadOpp,
} from "@/lib/arbScan";

export default function ArbPage() {
  const [opps, setOpps] = useState<SpreadOpp[]>([]);
  const [note, setNote] = useState("尚未掃描");
  const [state, setState] = useState<ArbPaperState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [minNetPct, setMinNetPct] = useState(0.05);
  const [feeLeg, setFeeLeg] = useState(0.1);
  const [intervalSec, setIntervalSec] = useState(20);
  const [autoTrade, setAutoTrade] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optsRef = useRef({ minNetPct, feeLeg, autoTrade });
  optsRef.current = { minNetPct, feeLeg, autoTrade };

  useEffect(() => {
    setState(loadPaperState());
  }, []);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { feeLeg: fee, minNetPct: minN, autoTrade: doTrade } =
        optsRef.current;
      const res = await runArbScan(fee);
      setOpps(res.opps.slice(0, 40));
      setNote(res.note);
      setState((prev) => {
        const base = prev ?? loadPaperState();
        const next = doTrade
          ? maybePaperExecute(base, res.opps, {
              minNetPct: minN,
              notionalPct: 0.15,
            })
          : {
              ...base,
              lastScanAt: new Date().toISOString(),
              scans: base.scans + 1,
            };
        if (!doTrade) savePaperState(next);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "掃描失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!auto) return;
    void scan();
    timerRef.current = setInterval(() => {
      void scan();
    }, Math.max(10, intervalSec) * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auto, intervalSec, scan]);

  const equity = state?.equity ?? 100;
  const starting = state?.starting ?? 100;
  const retPct = ((equity / starting - 1) * 100) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            價差掃描｜紙上跨所模擬
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            幣安 ↔ OKX 公開盤口比對 · 扣手續費後的淨利差 · 不上真錢
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void scan()}
            disabled={loading}
            className="rounded-lg bg-amber-500/90 px-3 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            {loading ? "掃描中…" : "立即掃描"}
          </button>
          <button
            type="button"
            onClick={() => setAuto((v) => !v)}
            className={`rounded-lg px-3 py-2 text-sm ${
              auto
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-zinc-800 text-zinc-300"
            }`}
          >
            {auto ? "自動掃描：開" : "自動掃描：關"}
          </button>
          <button
            type="button"
            onClick={() => setState(resetPaperState(100))}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300"
          >
            重置 100U
          </button>
        </div>
      </div>

      <aside className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-sm text-rose-100/90">
        <p className="font-medium text-rose-200">這不是那個 68→75 萬神話</p>
        <p className="mt-1 text-rose-100/70">
          真實跨所套利要拚延遲、深度、提幣與風控；這裡只是用公開 API
          算「紙上」價差並模擬成交，學習用，
          <strong className="text-rose-100">非投資建議、無真實下單</strong>。
        </p>
      </aside>

      <Disclaimer compact />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">紙上權益</p>
          <p className="font-mono text-lg text-amber-200">
            {equity.toFixed(2)} U
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">報酬率</p>
          <p
            className={`font-mono text-lg ${
              retPct >= 0 ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {retPct >= 0 ? "+" : ""}
            {retPct.toFixed(2)}%
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">掃描次數</p>
          <p className="font-mono text-lg text-zinc-100">{state?.scans ?? 0}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">模擬成交</p>
          <p className="font-mono text-lg text-zinc-100">
            {state?.trades.length ?? 0}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">單邊手續費 %</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={feeLeg}
            onChange={(e) => setFeeLeg(Number(e.target.value) || 0)}
            className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">自動成交門檻（淨利差 %）</span>
          <input
            type="number"
            step="0.01"
            value={minNetPct}
            onChange={(e) => setMinNetPct(Number(e.target.value) || 0)}
            className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">自動間隔（秒）</span>
          <input
            type="number"
            min="10"
            value={intervalSec}
            onChange={(e) => setIntervalSec(Number(e.target.value) || 20)}
            className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono"
          />
        </label>
        <label className="flex items-center gap-2 pb-1.5">
          <input
            type="checkbox"
            checked={autoTrade}
            onChange={(e) => setAutoTrade(e.target.checked)}
          />
          <span className="text-zinc-300">掃描後自動紙上成交</span>
        </label>
      </div>

      <p className="text-sm text-zinc-400">{note}</p>
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-300">
          價差排行（扣手續費後）
        </h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-2">標的</th>
                <th className="px-3 py-2">買入所</th>
                <th className="px-3 py-2">賣出所</th>
                <th className="px-3 py-2">毛利差%</th>
                <th className="px-3 py-2">淨利差%</th>
              </tr>
            </thead>
            <tbody>
              {opps.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-zinc-500"
                  >
                    {loading ? "掃描中…" : "尚無資料，按「立即掃描」"}
                  </td>
                </tr>
              ) : (
                opps.map((o) => (
                  <tr
                    key={`${o.symbol}-${o.buyVenue}-${o.sellVenue}`}
                    className="border-t border-zinc-800/80"
                  >
                    <td className="px-3 py-2 font-mono text-zinc-100">
                      {o.symbol}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{o.buyVenue}</td>
                    <td className="px-3 py-2 text-zinc-400">{o.sellVenue}</td>
                    <td className="px-3 py-2 font-mono text-zinc-300">
                      {o.grossPct.toFixed(3)}
                    </td>
                    <td
                      className={`px-3 py-2 font-mono ${
                        o.netPct >= minNetPct
                          ? "text-emerald-300"
                          : o.netPct > 0
                            ? "text-amber-200"
                            : "text-zinc-500"
                      }`}
                    >
                      {o.netPct.toFixed(3)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-300">紙上成交紀錄</h2>
        <ul className="space-y-2 text-sm">
          {(state?.trades ?? []).length === 0 && (
            <li className="text-zinc-500">還沒有模擬成交（多數時候淨利差為負）</li>
          )}
          {(state?.trades ?? []).slice(0, 30).map((t, i) => (
            <li
              key={`${t.t}-${i}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
            >
              <span className="font-mono text-zinc-400">
                {new Date(t.t).toLocaleString("zh-TW", {
                  timeZone: "Asia/Taipei",
                  hour12: false,
                })}
              </span>
              <span className="ml-2 text-zinc-200">
                {t.symbol} 買 {t.buyVenue} → 賣 {t.sellVenue}
              </span>
              <span className="ml-2 font-mono text-emerald-300">
                淨 {t.netPct.toFixed(3)}% · PnL {t.pnl >= 0 ? "+" : ""}
                {t.pnl.toFixed(3)}U
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
