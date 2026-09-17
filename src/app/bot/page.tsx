"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { marketSourceLabel } from "@/lib/binance";
import {
  DEFAULT_BOT_SETTINGS,
  loadBotSettings,
  loadBotStatus,
  resetVirtualBook,
  runBotOnce,
  saveBotSettings,
  saveBotStatus,
  universeLabel,
} from "@/lib/bot";
import { equity, loadPortfolio } from "@/lib/portfolio";
import { formatPrice } from "@/lib/scoring";
import type { BotSettings, BotStatus, PortfolioState } from "@/lib/types";

export default function BotPage() {
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_BOT_SETTINGS);
  const [status, setStatus] = useState<BotStatus>(() => ({
    ...loadBotStatus(),
    running: false,
  }));
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const s = loadBotSettings();
    setSettings(s);
    setStatus(loadBotStatus());
    setPortfolio(loadPortfolio());
    setHydrated(true);
  }, []);

  const persistSettings = (next: BotSettings) => {
    const cleaned = {
      ...next,
      pollIntervalSec: Math.max(30, Math.floor(next.pollIntervalSec) || 60),
    };
    saveBotSettings(cleaned);
    setSettings(cleaned);
  };

  const refreshPortfolio = () => setPortfolio(loadPortfolio());

  const executeOnce = useCallback(async (fromAuto: boolean) => {
    setBusy(true);
    setFlash(null);
    try {
      const current = settingsRef.current;
      const result = await runBotOnce(current);
      setStatus(result.status);
      setPortfolio(result.portfolio);
      if (result.actions.length > 0) {
        setFlash(`本輪成交 ${result.actions.length} 筆${fromAuto ? "（自動）" : ""}`);
      } else if (!result.status.lastError) {
        setFlash(fromAuto ? "自動掃描完成，無進出場" : "掃描完成，無進出場");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  // Auto runner while enabled and page open
  useEffect(() => {
    if (!hydrated) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!settings.enabled) {
      setStatus((prev) => {
        const next = { ...prev, running: false };
        saveBotStatus(next);
        return next;
      });
      return;
    }

    setStatus((prev) => {
      const next = { ...prev, running: true };
      saveBotStatus(next);
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

  const onResetBook = () => {
    const capital = Math.max(1, settings.startingCapitalUSDT);
    if (
      !confirm(
        `確定重置虛擬倉？將以 ${capital} USDT 重新開始，持倉與成交紀錄會清空。`
      )
    ) {
      return;
    }
    const next = resetVirtualBook(capital);
    setPortfolio(next);
    persistSettings({ ...settings, startingCapitalUSDT: capital });
    setFlash(`已重置虛擬倉為 ${capital} USDT`);
  };

  const patch = <K extends keyof BotSettings>(key: K, value: BotSettings[K]) => {
    persistSettings({ ...settings, [key]: value });
  };

  const displayEquity = portfolio
    ? equity(
        portfolio,
        Object.fromEntries(portfolio.positions.map((p) => [p.symbol, p.avgPrice]))
      )
    : 0;

  if (!hydrated) {
    return <p className="py-16 text-center text-zinc-500">載入機器人設定…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">模擬自動交易機器人</h1>
          <p className="mt-1 text-sm text-zinc-400">
            紙上動能策略 · 僅本機模擬 · 與{" "}
            <Link href="/portfolio" className="text-amber-300 hover:underline">
              虛擬倉
            </Link>{" "}
            共用成交紀錄
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void executeOnce(false)}
            className="rounded-lg bg-amber-500/90 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? "執行中…" : "立即執行一輪"}
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
            onClick={onResetBook}
            className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
          >
            重置虛擬倉
          </button>
        </div>
      </div>

      <aside className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-sm text-rose-100/90">
        <p className="font-medium text-rose-200">重要免責</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-rose-100/70">
          <li>模擬交易非投資建議；過去或缺省參數不代表未來。</li>
          <li>僅在本頁開啟且「啟用」時以 setInterval 輪詢，關閉分頁即停止。</li>
          <li>無真實交易所下單、無 API 金鑰；成交寫入本機 localStorage。</li>
        </ul>
      </aside>

      {flash && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
          {flash}
        </div>
      )}

      {/* Status */}
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
        <Stat
          label="資料來源"
          value={marketSourceLabel(status.dataSource)}
        />
        <Stat
          label="上次執行"
          value={
            status.lastRunAt
              ? new Date(status.lastRunAt).toLocaleString("zh-TW", { hour12: false })
              : "—"
          }
        />
        <Stat
          label="虛擬現金 / 持倉數"
          value={
            portfolio
              ? `${formatPrice(portfolio.cash)} / ${portfolio.positions.length}`
              : "—"
          }
        />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-medium text-zinc-300">執行狀態詳情</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-zinc-500">上次訊號</dt>
            <dd className="mt-0.5 text-zinc-200 break-words">
              {status.lastSignal || "尚無"}
            </dd>
          </div>
          {status.lastError && (
            <div>
              <dt className="text-zinc-500">錯誤</dt>
              <dd className="mt-0.5 text-rose-300">{status.lastError}</dd>
            </div>
          )}
          <div>
            <dt className="text-zinc-500">參考權益（持倉以均價估）</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-zinc-200">
              {formatPrice(displayEquity)} USDT
              <span className="ml-2 text-xs text-zinc-500">
                （即時標記見虛擬倉頁）
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Settings */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-zinc-200">設定（localStorage）</h2>
        <p className="mt-1 text-xs text-zinc-500">
          輪詢間隔最少 30 秒，以降低公開 API 壓力。重置虛擬倉會同步起始資金。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumField
            label="起始資金 USDT"
            value={settings.startingCapitalUSDT}
            min={1}
            step={100}
            onChange={(v) => patch("startingCapitalUSDT", v)}
          />
          <NumField
            label="單筆上限佔權益 %"
            value={settings.maxPositionPct}
            min={0.1}
            max={100}
            step={0.5}
            onChange={(v) => patch("maxPositionPct", v)}
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
            onChange={(v) => patch("pollIntervalSec", Math.max(30, Math.floor(v)))}
          />
          <NumField
            label="進場門檻 24h %"
            value={settings.entryThresholdPct}
            min={0}
            step={0.5}
            onChange={(v) => patch("entryThresholdPct", v)}
          />
          <NumField
            label="停利 %"
            value={settings.takeProfitPct}
            min={0.1}
            step={0.5}
            onChange={(v) => patch("takeProfitPct", v)}
          />
          <NumField
            label="停損 %"
            value={settings.stopLossPct}
            min={0.1}
            step={0.5}
            onChange={(v) => patch("stopLossPct", v)}
          />
          <label className="block text-sm">
            <span className="text-zinc-500">掃描宇宙</span>
            <select
              value={settings.universe}
              onChange={(e) =>
                patch("universe", e.target.value as BotSettings["universe"])
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-amber-500/50"
            >
              <option value="watchlist">觀察名單（啟發式）</option>
              <option value="top_volume">成交額前 50</option>
              <option value="meme_keywords">迷因關鍵字</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={settings.exitOnReverse}
              onChange={(e) => patch("exitOnReverse", e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600"
            />
            <span className="text-zinc-300">
              反向訊號出場（24h ≤ −進場門檻）
            </span>
          </label>
        </div>
      </section>

      {/* Strategy doc */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
        <h2 className="font-medium text-zinc-100">策略說明（透明規則）</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-zinc-400">
          <li>
            <strong className="text-zinc-200">資料</strong>：優先幣安公開{" "}
            <code className="text-xs">/api/v3/ticker/24hr</code>，失敗則
            CoinGecko 公開市價（USD≈USDT 標記）。無交易端點、無金鑰。
          </li>
          <li>
            <strong className="text-zinc-200">宇宙</strong>：目前為「
            {universeLabel(settings.universe)}」。
          </li>
          <li>
            <strong className="text-zinc-200">進場</strong>：24h 漲幅 ≥{" "}
            {settings.entryThresholdPct}%，且報價成交額高於宇宙中位數；略過已持倉、現金不足、達最大持倉數。
          </li>
          <li>
            <strong className="text-zinc-200">下單（模擬市價）</strong>：以最新價買入，名義金額 =
            權益 × {settings.maxPositionPct}%。
          </li>
          <li>
            <strong className="text-zinc-200">出場</strong>：標記價 ≥ 均價 × (1+
            {settings.takeProfitPct}%)，或 ≤ 均價 × (1−{settings.stopLossPct}%)
            {settings.exitOnReverse
              ? `，或 24h 漲幅 ≤ −${settings.entryThresholdPct}%（反向）`
              : ""}
            ；一次出清該標的。
          </li>
          <li>
            <strong className="text-zinc-200">執行</strong>：僅本頁開啟且啟用時每{" "}
            {Math.max(30, settings.pollIntervalSec)} 秒一輪；成交寫入與虛擬倉相同的
            localStorage，並標記 <code className="text-xs">source: &apos;bot&apos;</code>。
          </li>
        </ol>
        <p className="mt-3 text-xs text-zinc-500">
          此為教學用極簡動能規則，不保證獲利，亦不構成投資建議。
        </p>
      </section>

      {/* Recent bot fills */}
      <section>
        <h2 className="mb-3 font-medium text-zinc-200">最近機器人成交</h2>
        {!portfolio || portfolio.history.filter((h) => h.source === "bot").length === 0 ? (
          <p className="text-sm text-zinc-500">尚無機器人成交（手動單見虛擬倉頁）</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 p-3">
            {portfolio.history
              .filter((h) => h.source === "bot")
              .slice(0, 40)
              .map((h) => (
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
                    {h.symbol} · {h.qty.toPrecision(6)} @ {formatPrice(h.price)}
                    <span className="ml-2 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-200">
                      bot
                    </span>
                  </span>
                  <span className="font-mono text-zinc-400">
                    {formatPrice(h.usdt)} ·{" "}
                    {new Date(h.at).toLocaleString("zh-TW", { hour12: false })}
                  </span>
                </li>
              ))}
          </ul>
        )}
        <button
          type="button"
          onClick={refreshPortfolio}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
        >
          重新讀取虛擬倉
        </button>
      </section>

    </div>
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
