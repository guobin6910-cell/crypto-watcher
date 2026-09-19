"use client";

import { useCallback, useEffect, useState } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { RefreshButton } from "@/components/RefreshButton";
import { buildDailyTwPicks, type TwPick } from "@/lib/twStocks";

export default function TwPicksPage() {
  const [picks, setPicks] = useState<TwPick[]>([]);
  const [day, setDay] = useState("");
  const [note, setNote] = useState("");
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await buildDailyTwPicks(force);
      setPicks(res.picks);
      setDay(res.day);
      setNote(res.note);
      setLive(res.live);
      setUpdatedAt(
        new Date().toLocaleString("zh-TW", {
          timeZone: "Asia/Taipei",
          hour12: false,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">台股每日三檔｜觀察清單</h1>
          <p className="mt-1 text-sm text-zinc-400">
            依動能／均線／RSI／量能啟發式篩選 · 台北時間 {day || "—"}
            {updatedAt && (
              <span className="ml-2 text-zinc-600">更新於 {updatedAt}</span>
            )}
          </p>
        </div>
        <RefreshButton onClick={() => void load(true)} loading={loading} />
      </div>

      <aside className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
        <p className="font-medium text-amber-200">免責聲明</p>
        <p className="mt-1 text-amber-100/70">
          本頁僅供學習／模擬觀察，
          <strong className="text-amber-100">非投資建議</strong>
          ，不保證獲利；進場／目標／停損為啟發式推估，請自行判斷風險。無真實下單。
        </p>
      </aside>

      <Disclaimer compact />

      <p className={`text-sm ${live ? "text-emerald-400/80" : "text-rose-300/80"}`}>
        {note}
      </p>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading && picks.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">掃描台股觀察池中…</p>
      ) : (
        <ol className="space-y-4">
          {picks.map((p, i) => (
            <li
              key={p.code}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-zinc-500">
                    第 {i + 1} 檔 · {p.sector}
                  </p>
                  <h2 className="text-lg font-semibold text-zinc-50">
                    {p.code} {p.name}
                  </h2>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    參考價{" "}
                    <span className="font-mono text-amber-200">
                      {p.price.toFixed(2)}
                    </span>
                    <span className="ml-2 text-zinc-500">
                      5日 {p.ret5d >= 0 ? "+" : ""}
                      {p.ret5d.toFixed(1)}% · 分數 {p.score}
                    </span>
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    p.signal === "偏多觀察"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : p.signal === "偏空警戒"
                        ? "bg-rose-500/15 text-rose-300"
                        : "bg-zinc-700/60 text-zinc-300"
                  }`}
                >
                  {p.signal}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-zinc-950/60 px-3 py-2">
                  <p className="text-xs text-zinc-500">建議觀察進場</p>
                  <p className="font-mono text-zinc-100">{p.entry.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-zinc-950/60 px-3 py-2">
                  <p className="text-xs text-zinc-500">出場目標</p>
                  <p className="font-mono text-emerald-300">
                    {p.takeProfit.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-950/60 px-3 py-2">
                  <p className="text-xs text-zinc-500">停損參考</p>
                  <p className="font-mono text-rose-300">
                    {p.stopLoss.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-950/60 px-3 py-2">
                  <p className="text-xs text-zinc-500">風險報酬比</p>
                  <p className="font-mono text-amber-200">
                    {p.riskReward.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm text-zinc-300">
                <p>
                  <span className="text-zinc-500">技術面：</span>
                  {p.techReason}
                </p>
                <p>
                  <span className="text-zinc-500">題材／族群：</span>
                  {p.themeReason}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-200"
          onClick={() => setShowPlan((v) => !v)}
        >
          今日交易計畫檢查清單（模擬）
          <span className="text-zinc-500">{showPlan ? "收合" : "展開"}</span>
        </button>
        {showPlan && (
          <ul className="space-y-2 border-t border-zinc-800 px-4 py-3 text-sm text-zinc-400">
            <li>09:00 盤前：核對三檔是否有重大新聞／除權息／暫停交易。</li>
            <li>
              09:00–09:30 開盤：只在價格靠近「建議觀察進場」附近才模擬進場，不追高。
            </li>
            <li>盤中：碰到停損先執行；目標價可分批減碼。</li>
            <li>13:30 收盤：記錄結果到交易日誌，檢視是否違反自己的規則。</li>
          </ul>
        )}
      </div>
    </div>
  );
}
