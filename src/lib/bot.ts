"use client";

import {
  fetchTickers24hr,
  getLastMarketSource,
  priceMap,
  type MarketDataSource,
} from "./binance";
import { isMemeSymbol } from "./meme";
import {
  buy,
  equity,
  loadPortfolio,
  resetPortfolio,
  savePortfolio,
  sell,
} from "./portfolio";
import { buildDailyWatchlist, filterUsdtSpot, scoreTicker } from "./scoring";
import type { BinanceTicker24hr, BotSettings, BotStatus, PortfolioState } from "./types";

const SETTINGS_KEY = "crypto-watcher-bot-settings-v1";
const STATUS_KEY = "crypto-watcher-bot-status-v1";

export const DEFAULT_BOT_SETTINGS: BotSettings = {
  startingCapitalUSDT: 10_000,
  maxPositionPct: 10,
  maxOpenPositions: 5,
  pollIntervalSec: 60,
  takeProfitPct: 5,
  stopLossPct: 3,
  entryThresholdPct: 5,
  universe: "watchlist",
  exitOnReverse: true,
  enabled: false,
};

export const DEFAULT_BOT_STATUS: BotStatus = {
  lastRunAt: null,
  lastSignal: null,
  lastError: null,
  dataSource: null,
  running: false,
};

function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function loadBotSettings(): BotSettings {
  if (typeof window === "undefined") return { ...DEFAULT_BOT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_BOT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<BotSettings>;
    const merged: BotSettings = { ...DEFAULT_BOT_SETTINGS, ...parsed };
    merged.pollIntervalSec = Math.max(30, Number(merged.pollIntervalSec) || 60);
    merged.maxPositionPct = Math.min(100, Math.max(0.1, Number(merged.maxPositionPct) || 10));
    merged.maxOpenPositions = Math.max(1, Math.floor(Number(merged.maxOpenPositions) || 5));
    merged.startingCapitalUSDT = Math.max(1, Number(merged.startingCapitalUSDT) || 10_000);
    merged.takeProfitPct = Math.max(0.1, Number(merged.takeProfitPct) || 5);
    merged.stopLossPct = Math.max(0.1, Number(merged.stopLossPct) || 3);
    merged.entryThresholdPct = Math.max(0, Number(merged.entryThresholdPct) || 5);
    if (!["watchlist", "top_volume", "meme_keywords"].includes(merged.universe)) {
      merged.universe = "watchlist";
    }
    merged.enabled = Boolean(merged.enabled);
    merged.exitOnReverse = merged.exitOnReverse !== false;
    return merged;
  } catch {
    return { ...DEFAULT_BOT_SETTINGS };
  }
}

export function saveBotSettings(settings: BotSettings): void {
  if (typeof window === "undefined") return;
  const next = {
    ...settings,
    pollIntervalSec: Math.max(30, settings.pollIntervalSec),
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

export function loadBotStatus(): BotStatus {
  if (typeof window === "undefined") return { ...DEFAULT_BOT_STATUS };
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    if (!raw) return { ...DEFAULT_BOT_STATUS };
    return { ...DEFAULT_BOT_STATUS, ...(JSON.parse(raw) as Partial<BotStatus>) };
  } catch {
    return { ...DEFAULT_BOT_STATUS };
  }
}

export function saveBotStatus(status: BotStatus): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATUS_KEY, JSON.stringify(status));
}

/** Build the scan universe from raw tickers. */
export function selectUniverse(
  tickers: BinanceTicker24hr[],
  mode: BotSettings["universe"]
): BinanceTicker24hr[] {
  const usdt = filterUsdtSpot(tickers);
  if (mode === "meme_keywords") {
    return usdt.filter((t) => isMemeSymbol(t.symbol));
  }
  if (mode === "top_volume") {
    return [...usdt]
      .sort((a, b) => num(b.quoteVolume) - num(a.quoteVolume))
      .slice(0, 50);
  }
  // watchlist ≈ 今日觀察候選（啟發式分數排序）
  const scored = usdt.map(scoreTicker);
  return buildDailyWatchlist(scored, 30).map((c) => c.ticker);
}

export interface BotRunResult {
  portfolio: PortfolioState;
  status: BotStatus;
  actions: string[];
}

/**
 * One paper-trading momentum scan:
 * - Exit: mark ≥ avg*(1+tp) OR mark ≤ avg*(1-sl) OR optional reverse (24h ≤ −entry)
 * - Entry: 24h change ≥ entryThreshold AND quoteVol > universe median
 * - Size: equity * maxPositionPct at last price (market-sim)
 */
export async function runBotOnce(settings: BotSettings): Promise<BotRunResult> {
  const actions: string[] = [];
  let portfolio = loadPortfolio();
  let dataSource: MarketDataSource | null = null;

  try {
    const tickers = await fetchTickers24hr();
    dataSource = getLastMarketSource();
    const prices = priceMap(tickers);
    const universe = selectUniverse(tickers, settings.universe);
    const bySymbol = new Map(universe.map((t) => [t.symbol, t]));

    const vols = universe.map((t) => num(t.quoteVolume)).filter((v) => v > 0);
    const medVol = median(vols);

    // --- Exits ---
    for (const pos of [...portfolio.positions]) {
      const mark = prices[pos.symbol];
      if (!(mark > 0)) continue;
      const tp = pos.avgPrice * (1 + settings.takeProfitPct / 100);
      const sl = pos.avgPrice * (1 - settings.stopLossPct / 100);
      const t = bySymbol.get(pos.symbol) ?? tickers.find((x) => x.symbol === pos.symbol);
      const changePct = t ? num(t.priceChangePercent) : 0;
      let reason: string | null = null;
      if (mark >= tp) reason = `停利 +${settings.takeProfitPct}%`;
      else if (mark <= sl) reason = `停損 −${settings.stopLossPct}%`;
      else if (settings.exitOnReverse && changePct <= -settings.entryThresholdPct) {
        reason = `反向訊號 24h ${changePct.toFixed(2)}%`;
      }
      if (!reason) continue;
      const result = sell(portfolio, pos.symbol, pos.qty, mark, "bot");
      if (result.ok) {
        portfolio = result.state;
        actions.push(`賣出 ${pos.symbol} @ ${mark}（${reason}）`);
      }
    }

    // --- Entries ---
    const eq = equity(portfolio, prices);
    const openCount = portfolio.positions.length;
    const held = new Set(portfolio.positions.map((p) => p.symbol));
    const slots = Math.max(0, settings.maxOpenPositions - openCount);

    if (slots > 0) {
      const candidates = universe
        .filter((t) => {
          const change = num(t.priceChangePercent);
          const qv = num(t.quoteVolume);
          const last = num(t.lastPrice);
          return (
            change >= settings.entryThresholdPct &&
            qv > medVol &&
            last > 0 &&
            !held.has(t.symbol)
          );
        })
        .sort((a, b) => num(b.priceChangePercent) - num(a.priceChangePercent));

      let remainingSlots = slots;
      let state = portfolio;
      for (const t of candidates) {
        if (remainingSlots <= 0) break;
        const last = num(t.lastPrice);
        const notional = eq * (settings.maxPositionPct / 100);
        if (notional < 1 || notional > state.cash + 1e-8) {
          if (state.cash < 1) break;
          continue;
        }
        const qty = notional / last;
        if (!(qty > 0)) continue;
        const result = buy(state, t.symbol, qty, last, "bot");
        if (result.ok) {
          state = result.state;
          held.add(t.symbol);
          remainingSlots -= 1;
          actions.push(
            `買入 ${t.symbol} @ ${last}（24h ${num(t.priceChangePercent).toFixed(2)}%，量>${medVol.toFixed(0)} 中位）`
          );
        }
      }
      portfolio = state;
    }

    savePortfolio(portfolio);

    const signal =
      actions.length > 0
        ? actions.join("；")
        : `掃描 ${universe.length} 檔（中位量 ${medVol.toFixed(0)}），無新進出場`;

    const status: BotStatus = {
      lastRunAt: new Date().toISOString(),
      lastSignal: signal,
      lastError: null,
      dataSource,
      running: settings.enabled,
    };
    saveBotStatus(status);
    return { portfolio, status, actions };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status: BotStatus = {
      lastRunAt: new Date().toISOString(),
      lastSignal: actions.length ? actions.join("；") : null,
      lastError: msg,
      dataSource,
      running: settings.enabled,
    };
    saveBotStatus(status);
    return { portfolio, status, actions };
  }
}

export function resetVirtualBook(startingCapitalUSDT: number): PortfolioState {
  return resetPortfolio(startingCapitalUSDT);
}

export function universeLabel(mode: BotSettings["universe"]): string {
  switch (mode) {
    case "top_volume":
      return "成交額前 50";
    case "meme_keywords":
      return "迷因關鍵字";
    default:
      return "觀察名單（啟發式）";
  }
}
