"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { marketSourceLabel } from "@/lib/binance";
import {
  DEFAULT_FUTURES_SETTINGS,
  DEFAULT_FUTURES_STATUS,
  LEVERAGE_OPTIONS,
  eventKindLabel,
  futuresEquity,
  liqFormulaTip,
  loadFuturesAccount,
  loadFuturesSettings,
  loadFuturesStatus,
  resetFuturesAccount,
  runFuturesBotOnce,
  saveFuturesSettings,
  saveFuturesStatus,
  sideModeLabel,
  totalUnrealized,
  universeLabel,
} from "@/lib/futuresBot";
import { formatPrice } from "@/lib/scoring";
import type {
  FuturesAccountState,
  FuturesBotSettings,
  FuturesBotStatus,
  FuturesLeverage,
} from "@/lib/types";

export default function FuturesBotPage() {
  const [settings, setSettings] = useState<FuturesBotSettings>(
    DEFAULT_FUTURES_SETTINGS
  );
  const [status, setStatus] = useState<FuturesBotStatus>(() => ({
    ...DEFAULT_FUTURES_STATUS,
    running: false,
  }));
  const [account, setAccount] = useState<FuturesAccountState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    setSettings(loadFuturesSettings());
    setStatus(loadFuturesStatus());
    setAccount(loadFuturesAccount());
    setHydrated(true);
  }, []);

  const persistSettings = (next: FuturesBotSettings) => {
    const cleaned: FuturesBotSettings = {
      ...next,
      pollIntervalSec: Math.max(30, Math.floor(next.pollIntervalSec) || 60),
      marginMode: "isolated",
    };
    saveFuturesSettings(cleaned);
    setSettings(cleaned);
  };

  const executeOnce = useCallback(async (fromAuto: boolean) => {
    setBusy(true);
    setFlash(null);
    try {
      const result = await runFuturesBotOnce(settingsRef.current);
      setStatus(result.status);
      setAccount(result.account);
      if (result.actions.length > 0) {
        setFlash(
          `本輪動作 ${result.actions.length} 筆${fromAuto ? "（自動）" : ""}`
        );
      } else if (!result.status.lastError) {
        setFlash(fromAuto ? "自動掃描完成，無進出場" : "掃描完成，無進出場");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!settings.enabled) {
      setStatus((prev) => {
        const next = { ...prev, running: false };
        saveFuturesStatus(next);
        return next;
      });
      return;
    }

    setStatus((prev) => {
      const next = { ...prev, running: true };
      saveFuturesStatus(next);
      return next;
    });

    void executeOnce(true);
    const ms = Math.max(30, settings.pollIntervalSec) * 1000;
    timerRef.current = setInterval(() => {
      void executeOnce(true);
    }, ms);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hydrated, settings.enabled, settings.pollIntervalSec, executeOnce]);

  const onEnable = () => persistSettings({ ...settings, enabled: true });
  const onPause = () => persistSettings({ ...settings, enabled: false });

  const onReset = () => {
    const capital = Math.max(1, settings.startingMarginBalanceUSDT);
    if (
      !confirm(
        `確定重置模擬合約倉？將以 ${capital} USDT 保證金重新開始，持倉與紀錄會清空。`
      )
    ) {
      return;
    }
    const next = resetFuturesAccount(capital);
    setAccount(next);
    persistSettings({ ...settings, startingMarginBalanceUSDT: capital });
    setFlash(`已重置模擬合約倉為 ${capital} USDT`);
  };

  const patch = <K extends keyof FuturesBotSettings>(
    key: K,
    value: FuturesBotSettings[K]
  ) => {
    persistSettings({ ...settings, [key]: value });
  };

  const equity = account ? futuresEquity(account) : 0;
  const uPnl = account ? totalUnrealized(account.positions) : 0;

  const equitySummary = useMemo(() => {
    if (!account || account.equityCurve.length === 0) return null;
    const pts = account.equityCurve;
    const first = pts[0].equity;
    const last = pts[pts.length - 1].equity;
    const peak = Math.max(...pts.map((p) => p.equity));
    const trough = Math.min(...pts.map((p) => p.equity));
    return {
      points: pts.length,
      first,
      last,
      peak,
      trough,
      changePct: first > 0 ? ((last - first) / first) * 100 : 0,
    };
  }, [account]);

  if (!hydrated) {
    return <p className="py-16 text-center text-zinc-500">載入模擬合約設定…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            模擬 USDT-M 合約機器人
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            紙上槓桿動能 · 與現貨{" "}
            <Link href="/bot" className="text-amber-300 hover:underline">
              模擬機器人
            </Link>{" "}
            分開儲存 · 無真實下單
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void executeOnce(false)}
            className="rounded-lg bg-amber-500/90 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? "執行中…" : "立即執行"}
          </button>
          {settings.enabled ? (
            <button
              type="button"
              onClick={onPause}
              className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              暫停
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnable}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              啟用
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
          >
            重置模擬合約倉
          </button>
        </div>
      </div>

      <aside className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/90">
        <p className="font-medium text-rose-200">模擬合約／重要免責</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-rose-100/75">
          <li>
            <strong>模擬合約</strong>：僅瀏覽器 localStorage 紙上倉，
            <strong>非投資建議</strong>。
          </li>
          <li>
            槓桿可能導致<strong>模擬爆倉</strong>
            （保證金歸零）；公式為逐倉近似，非交易所真實規則。
          </li>
          <li>
            <strong>僅頁面開啟時運行</strong>
            ：啟用後以 setInterval 輪詢；關閉分頁即停止。
          </li>
          <li>
            無幣安合約 API 金鑰、無真實下單；資金費率本版略過（未計）。
          </li>
        </ul>
      </aside>

      {flash && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
          {flash}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="狀態"
          value={
            settings.enabled
              ? busy
                ? "執行中"
                : "已啟用（輪詢）"
              : "已暫停"
          }
          accent={settings.enabled ? "up" : undefined}
        />
        <Stat label="資料來源" value={marketSourceLabel(status.dataSource)} />
        <Stat
          label="上次執行"
          value={
            status.lastRunAt
              ? new Date(status.lastRunAt).toLocaleString("zh-TW", {
                  hour12: false,
                })
              : "—"
          }
        />
        <Stat
          label="槓桿 / 模式"
          value={`${settings.leverage}x · ${sideModeLabel(settings.sideMode)} · 逐倉`}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="可用保證金"
          value={
            account ? `${formatPrice(account.marginBalance)} USDT` : "—"
          }
        />
        <Stat
          label="權益（保證金＋未實現）"
          value={`${formatPrice(equity)} USDT`}
          accent={
            account
              ? equity >= account.initialMarginBalance
                ? "up"
                : "down"
              : undefined
          }
        />
        <Stat
          label="未實現損益"
          value={`${uPnl >= 0 ? "+" : ""}${formatPrice(uPnl)}`}
          accent={uPnl > 0 ? "up" : uPnl < 0 ? "down" : undefined}
        />
        <Stat
          label="持倉數"
          value={account ? String(account.positions.length) : "—"}
        />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-medium text-zinc-300">執行狀態詳情</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-zinc-500">上次訊號</dt>
            <dd className="mt-0.5 break-words text-zinc-200">
              {status.lastSignal || "尚無"}
            </dd>
          </div>
          {status.lastError && (
            <div>
              <dt className="text-zinc-500">錯誤</dt>
              <dd className="mt-0.5 text-rose-300">{status.lastError}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Open positions */}
      <section>
        <h2 className="mb-3 font-medium text-zinc-200">模擬合約持倉</h2>
        {!account || account.positions.length === 0 ? (
          <p className="text-sm text-zinc-500">目前無持倉</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2">標的</th>
                  <th className="px-3 py-2">方向</th>
                  <th className="px-3 py-2">槓桿</th>
                  <th className="px-3 py-2">數量</th>
                  <th className="px-3 py-2">開倉價</th>
                  <th className="px-3 py-2">標記價</th>
                  <th className="px-3 py-2">強平價</th>
                  <th className="px-3 py-2">保證金</th>
                  <th className="px-3 py-2">未實現</th>
                </tr>
              </thead>
              <tbody>
                {account.positions.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-800/60 last:border-0"
                  >
                    <td className="px-3 py-2 font-medium">{p.symbol}</td>
                    <td
                      className={`px-3 py-2 ${
                        p.side === "long" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {p.side === "long" ? "多" : "空"}
                    </td>
                    <td className="px-3 py-2 font-mono">{p.leverage}x</td>
                    <td className="px-3 py-2 font-mono">
                      {p.qty.toPrecision(6)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatPrice(p.entryPrice)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatPrice(p.markPrice)}
                    </td>
                    <td className="px-3 py-2 font-mono text-amber-200/90">
                      {formatPrice(p.liquidationPrice)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatPrice(p.marginAllocated)}
                    </td>
                    <td
                      className={`px-3 py-2 font-mono ${
                        p.unrealizedPnl >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {p.unrealizedPnl >= 0 ? "+" : ""}
                      {formatPrice(p.unrealizedPnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-zinc-500" title={liqFormulaTip()}>
          {liqFormulaTip()}
        </p>
      </section>

      {/* Equity curve summary */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-zinc-200">權益曲線摘要</h2>
        <p className="mt-1 text-xs text-zinc-500">
          每次掃描記錄權益（可用保證金＋已用保證金＋未實現損益）。最多保留約
          120 點。
        </p>
        {!equitySummary ? (
          <p className="mt-3 text-sm text-zinc-500">尚無曲線資料（執行一輪後產生）</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="樣本數" value={String(equitySummary.points)} />
            <Stat
              label="起始權益"
              value={`${formatPrice(equitySummary.first)}`}
            />
            <Stat
              label="最新權益"
              value={`${formatPrice(equitySummary.last)}`}
            />
            <Stat
              label="期間高低"
              value={`${formatPrice(equitySummary.trough)} ~ ${formatPrice(equitySummary.peak)}`}
            />
            <Stat
              label="期間變動 %"
              value={`${equitySummary.changePct >= 0 ? "+" : ""}${equitySummary.changePct.toFixed(2)}%`}
              accent={
                equitySummary.changePct > 0
                  ? "up"
                  : equitySummary.changePct < 0
                    ? "down"
                    : undefined
              }
            />
          </div>
        )}
        {account && account.equityCurve.length > 1 && (
          <EquitySpark points={account.equityCurve.map((p) => p.equity)} />
        )}
      </section>

      {/* Settings */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-zinc-200">
          設定（localStorage: cw_futures_bot_v1）
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          與現貨機器人／虛擬倉分開。輪詢最少 30
          秒。新倉使用目前選定槓桿；已開倉槓桿不變。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumField
            label="起始保證金餘額 USDT"
            value={settings.startingMarginBalanceUSDT}
            min={1}
            step={100}
            onChange={(v) => patch("startingMarginBalanceUSDT", v)}
          />
          <label className="block text-sm">
            <span className="text-zinc-500">槓桿（新倉）</span>
            <select
              value={settings.leverage}
              onChange={(e) =>
                patch("leverage", Number(e.target.value) as FuturesLeverage)
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-amber-500/50"
            >
              {LEVERAGE_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}x
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">保證金模式</span>
            <select
              value="isolated"
              disabled
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-400 outline-none"
            >
              <option value="isolated">逐倉（MVP 僅此）</option>
            </select>
          </label>
          <NumField
            label="單筆名義佔權益 %"
            value={settings.maxPositionNotionalPct}
            min={0.1}
            max={100}
            step={0.5}
            onChange={(v) => patch("maxPositionNotionalPct", v)}
          />
          <NumField
            label="最大持倉數"
            value={settings.maxOpenPositions}
            min={1}
            max={50}
            step={1}
            onChange={(v) => patch("maxOpenPositions", Math.floor(v))}
          />
          <NumField
            label="輪詢間隔（秒）"
            value={settings.pollIntervalSec}
            min={30}
            step={10}
            onChange={(v) =>
              patch("pollIntervalSec", Math.max(30, Math.floor(v)))
            }
          />
          <NumField
            label="進場門檻 24h %"
            value={settings.entryThresholdPct}
            min={0}
            step={0.5}
            onChange={(v) => patch("entryThresholdPct", v)}
          />
          <NumField
            label="停利（價格變動 %）"
            value={settings.takeProfitPct}
            min={0.1}
            step={0.1}
            onChange={(v) => patch("takeProfitPct", v)}
          />
          <NumField
            label="停損（價格變動 %）"
            value={settings.stopLossPct}
            min={0.1}
            step={0.1}
            onChange={(v) => patch("stopLossPct", v)}
          />
          <label className="block text-sm">
            <span className="text-zinc-500">掃描宇宙</span>
            <select
              value={settings.universe}
              onChange={(e) =>
                patch(
                  "universe",
                  e.target.value as FuturesBotSettings["universe"]
                )
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-amber-500/50"
            >
              <option value="watchlist">觀察名單（啟發式）</option>
              <option value="top_volume">成交額前 50</option>
              <option value="meme_keywords">迷因關鍵字</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">方向模式</span>
            <select
              value={settings.sideMode}
              onChange={(e) =>
                patch(
                  "sideMode",
                  e.target.value as FuturesBotSettings["sideMode"]
                )
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-amber-500/50"
            >
              <option value="long_only">僅做多（較安全 MVP）</option>
              <option value="long_short">多空皆可（強負動能開空）</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={settings.exitOnReverse}
              onChange={(e) => patch("exitOnReverse", e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600"
            />
            <span className="text-zinc-300">反向動能平倉</span>
          </label>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          參考：價格停利 {settings.takeProfitPct}% × {settings.leverage}x ≈ ROE{" "}
          {(settings.takeProfitPct * settings.leverage).toFixed(1)}%；停損同理 ≈ −
          {(settings.stopLossPct * settings.leverage).toFixed(1)}% ROE。
        </p>
      </section>

      {/* Strategy */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
        <h2 className="font-medium text-zinc-100">策略說明（透明規則）</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-zinc-400">
          <li>
            <strong className="text-zinc-200">資料</strong>
            ：與現貨相同公開標記（幣安 → CoinGecko）。無合約下單端點、無金鑰。
          </li>
          <li>
            <strong className="text-zinc-200">宇宙</strong>：
            {universeLabel(settings.universe)}。
          </li>
          <li>
            <strong className="text-zinc-200">進場</strong>：24h 漲幅 ≥{" "}
            {settings.entryThresholdPct}% 開多
            {settings.sideMode === "long_short"
              ? `；≤ −${settings.entryThresholdPct}% 開空`
              : "（僅做多）"}
            ；報價量高於宇宙中位；名義 = 權益 ×{" "}
            {settings.maxPositionNotionalPct}%；保證金 = 名義 /{" "}
            {settings.leverage}；數量 = 名義 / 價格。
          </li>
          <li>
            <strong className="text-zinc-200">出場</strong>
            ：價格相對開倉價達停利／停損，或反向動能；標記穿越強平價則模擬爆倉（保證金歸零，
            <code className="text-xs">source:&apos;futures_bot&apos;</code>）。
          </li>
          <li>
            <strong className="text-zinc-200">資金費</strong>
            ：MVP 略過（未從餘額扣撥）。
          </li>
          <li>
            <strong className="text-zinc-200">執行</strong>
            ：僅本頁開啟且啟用時每{" "}
            {Math.max(30, settings.pollIntervalSec)} 秒一輪。
          </li>
        </ol>
      </section>

      {/* Trade log */}
      <section>
        <h2 className="mb-3 font-medium text-zinc-200">成交／事件紀錄</h2>
        {!account || account.history.length === 0 ? (
          <p className="text-sm text-zinc-500">尚無紀錄</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 p-3">
            {account.history.slice(0, 50).map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/50 pb-2 text-sm last:border-0"
              >
                <span>
                  <span
                    className={
                      h.kind === "liquidation"
                        ? "text-rose-300 font-medium"
                        : h.kind.startsWith("open")
                          ? "text-amber-300"
                          : "text-zinc-300"
                    }
                  >
                    {eventKindLabel(h.kind)}
                  </span>{" "}
                  {h.symbol} · {h.leverage}x · {h.qty.toPrecision(6)} @{" "}
                  {formatPrice(h.price)}
                  <span className="ml-2 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-200">
                    futures_bot
                  </span>
                  {h.reason && (
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {h.reason}
                    </span>
                  )}
                </span>
                <span className="font-mono text-zinc-400">
                  {h.pnl != null && (
                    <span
                      className={
                        h.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                      }
                    >
                      PnL {h.pnl >= 0 ? "+" : ""}
                      {formatPrice(h.pnl)} ·{" "}
                    </span>
                  )}
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

function EquitySpark({ points }: { points: number[] }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 320;
  const h = 56;
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-4 h-14 w-full max-w-md text-zinc-400"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={up ? "rgb(52 211 153)" : "rgb(251 113 133)"}
        strokeWidth="2"
      />
    </svg>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-zinc-500">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-amber-500/50"
      />
    </label>
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
        className={`mt-1 text-sm font-medium ${
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
