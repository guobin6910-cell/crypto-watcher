"use client";

import {
  fetchTickers24hr,
  getLastMarketSource,
  priceMap,
  type MarketDataSource,
} from "./binance";
import { selectUniverse, universeLabel } from "./bot";
import type {
  BinanceTicker24hr,
  FuturesAccountState,
  FuturesBotSettings,
  FuturesBotStatus,
  FuturesEquityPoint,
  FuturesEventKind,
  FuturesLeverage,
  FuturesPosition,
  FuturesSide,
  FuturesTradeEvent,
} from "./types";

export { universeLabel };

/** Settings key separate from spot bot */
export const FUTURES_SETTINGS_KEY = "cw_futures_bot_v1";
const ACCOUNT_KEY = "cw_futures_account_v1";
const STATUS_KEY = "cw_futures_bot_status_v1";

/** Isolated liq fee/maintenance buffer (~0.5%) — earlier liquidation than pure 1/L */
export const LIQ_FEE_BUFFER = 0.005;

export const LEVERAGE_OPTIONS: FuturesLeverage[] = [1, 2, 3, 5, 10, 20];

export const DEFAULT_FUTURES_SETTINGS: FuturesBotSettings = {
  startingMarginBalanceUSDT: 10_000,
  leverage: 5,
  marginMode: "isolated",
  maxPositionNotionalPct: 20,
  maxOpenPositions: 3,
  pollIntervalSec: 60,
  entryThresholdPct: 5,
  takeProfitPct: 2,
  stopLossPct: 1,
  universe: "watchlist",
  enabled: false,
  sideMode: "long_only",
  exitOnReverse: true,
};

export const DEFAULT_FUTURES_STATUS: FuturesBotStatus = {
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

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Isolated approximate liquidation price.
 * Long ≈ entry × (1 − 1/leverage + buffer)
 * Short ≈ entry × (1 + 1/leverage − buffer)
 */
export function estimateLiquidationPrice(
  entry: number,
  leverage: number,
  side: FuturesSide,
  buffer = LIQ_FEE_BUFFER
): number {
  const L = Math.max(1, leverage);
  if (side === "long") {
    return Math.max(0, entry * (1 - 1 / L + buffer));
  }
  return entry * (1 + 1 / L - buffer);
}

export function liqFormulaTip(): string {
  return `逐倉近似強平價：多單 ≈ 開倉價×(1−1/槓桿+${(LIQ_FEE_BUFFER * 100).toFixed(1)}%)；空單 ≈ 開倉價×(1+1/槓桿−${(LIQ_FEE_BUFFER * 100).toFixed(1)}%)。未計資金費與真實維持保證金。`;
}

export function unrealizedPnl(
  side: FuturesSide,
  qty: number,
  entry: number,
  mark: number
): number {
  if (side === "long") return (mark - entry) * qty;
  return (entry - mark) * qty;
}

export function createEmptyFuturesAccount(
  initial = DEFAULT_FUTURES_SETTINGS.startingMarginBalanceUSDT
): FuturesAccountState {
  return {
    marginBalance: initial,
    initialMarginBalance: initial,
    positions: [],
    history: [],
    equityCurve: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadFuturesSettings(): FuturesBotSettings {
  if (typeof window === "undefined") return { ...DEFAULT_FUTURES_SETTINGS };
  try {
    const raw = localStorage.getItem(FUTURES_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_FUTURES_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<FuturesBotSettings>;
    const merged: FuturesBotSettings = { ...DEFAULT_FUTURES_SETTINGS, ...parsed };
    merged.pollIntervalSec = Math.max(30, Number(merged.pollIntervalSec) || 60);
    merged.maxPositionNotionalPct = Math.min(
      100,
      Math.max(0.1, Number(merged.maxPositionNotionalPct) || 20)
    );
    merged.maxOpenPositions = Math.max(
      1,
      Math.floor(Number(merged.maxOpenPositions) || 3)
    );
    merged.startingMarginBalanceUSDT = Math.max(
      1,
      Number(merged.startingMarginBalanceUSDT) || 10_000
    );
    merged.takeProfitPct = Math.max(0.1, Number(merged.takeProfitPct) || 2);
    merged.stopLossPct = Math.max(0.1, Number(merged.stopLossPct) || 1);
    merged.entryThresholdPct = Math.max(0, Number(merged.entryThresholdPct) || 5);
    const lev = Number(merged.leverage) as FuturesLeverage;
    merged.leverage = LEVERAGE_OPTIONS.includes(lev) ? lev : 5;
    merged.marginMode = "isolated";
    if (!["watchlist", "top_volume", "meme_keywords"].includes(merged.universe)) {
      merged.universe = "watchlist";
    }
    if (merged.sideMode !== "long_short") merged.sideMode = "long_only";
    merged.enabled = Boolean(merged.enabled);
    merged.exitOnReverse = merged.exitOnReverse !== false;
    return merged;
  } catch {
    return { ...DEFAULT_FUTURES_SETTINGS };
  }
}

export function saveFuturesSettings(settings: FuturesBotSettings): void {
  if (typeof window === "undefined") return;
  const next = {
    ...settings,
    pollIntervalSec: Math.max(30, settings.pollIntervalSec),
    marginMode: "isolated" as const,
  };
  localStorage.setItem(FUTURES_SETTINGS_KEY, JSON.stringify(next));
}

export function loadFuturesAccount(): FuturesAccountState {
  if (typeof window === "undefined") return createEmptyFuturesAccount();
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return createEmptyFuturesAccount();
    const parsed = JSON.parse(raw) as FuturesAccountState;
    if (
      typeof parsed.marginBalance !== "number" ||
      typeof parsed.initialMarginBalance !== "number" ||
      !Array.isArray(parsed.positions) ||
      !Array.isArray(parsed.history)
    ) {
      return createEmptyFuturesAccount();
    }
    return {
      ...parsed,
      equityCurve: Array.isArray(parsed.equityCurve) ? parsed.equityCurve : [],
    };
  } catch {
    return createEmptyFuturesAccount();
  }
}

export function saveFuturesAccount(state: FuturesAccountState): void {
  if (typeof window === "undefined") return;
  const next = { ...state, updatedAt: new Date().toISOString() };
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next));
}

export function loadFuturesStatus(): FuturesBotStatus {
  if (typeof window === "undefined") return { ...DEFAULT_FUTURES_STATUS };
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    if (!raw) return { ...DEFAULT_FUTURES_STATUS };
    return {
      ...DEFAULT_FUTURES_STATUS,
      ...(JSON.parse(raw) as Partial<FuturesBotStatus>),
    };
  } catch {
    return { ...DEFAULT_FUTURES_STATUS };
  }
}

export function saveFuturesStatus(status: FuturesBotStatus): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATUS_KEY, JSON.stringify(status));
}

export function markPositions(
  positions: FuturesPosition[],
  prices: Record<string, number>
): FuturesPosition[] {
  return positions.map((p) => {
    const mark = prices[p.symbol] ?? p.markPrice ?? p.entryPrice;
    return {
      ...p,
      markPrice: mark,
      unrealizedPnl: unrealizedPnl(p.side, p.qty, p.entryPrice, mark),
    };
  });
}

export function totalUnrealized(positions: FuturesPosition[]): number {
  return positions.reduce((s, p) => s + p.unrealizedPnl, 0);
}

export function allocatedMargin(positions: FuturesPosition[]): number {
  return positions.reduce((s, p) => s + p.marginAllocated, 0);
}

/** Equity = free margin + allocated margins + unrealized PnL */
export function futuresEquity(account: FuturesAccountState): number {
  return (
    account.marginBalance +
    allocatedMargin(account.positions) +
    totalUnrealized(account.positions)
  );
}

function pushEvent(
  history: FuturesTradeEvent[],
  event: Omit<FuturesTradeEvent, "id" | "at" | "source">
): FuturesTradeEvent[] {
  const full: FuturesTradeEvent = {
    ...event,
    id: uid(),
    at: new Date().toISOString(),
    source: "futures_bot",
  };
  return [full, ...history].slice(0, 300);
}

function pushEquityPoint(
  curve: FuturesEquityPoint[],
  account: FuturesAccountState
): FuturesEquityPoint[] {
  const u = totalUnrealized(account.positions);
  const point: FuturesEquityPoint = {
    at: new Date().toISOString(),
    equity: account.marginBalance + allocatedMargin(account.positions) + u,
    marginBalance: account.marginBalance,
    unrealizedPnl: u,
  };
  return [...curve, point].slice(-120);
}

function isLiquidated(pos: FuturesPosition, mark: number): boolean {
  if (pos.side === "long") return mark <= pos.liquidationPrice;
  return mark >= pos.liquidationPrice;
}

function closePosition(
  account: FuturesAccountState,
  pos: FuturesPosition,
  exitPrice: number,
  kind: FuturesEventKind,
  reason: string,
  loseMargin: boolean
): FuturesAccountState {
  const pnl = loseMargin
    ? -pos.marginAllocated
    : unrealizedPnl(pos.side, pos.qty, pos.entryPrice, exitPrice);
  const returned = loseMargin ? 0 : pos.marginAllocated + pnl;
  const history = pushEvent(account.history, {
    symbol: pos.symbol,
    kind,
    side: pos.side,
    qty: pos.qty,
    price: exitPrice,
    leverage: pos.leverage,
    margin: pos.marginAllocated,
    pnl,
    reason,
  });
  return {
    ...account,
    marginBalance: account.marginBalance + returned,
    positions: account.positions.filter((p) => p.id !== pos.id),
    history,
    updatedAt: new Date().toISOString(),
  };
}

function openPosition(
  account: FuturesAccountState,
  symbol: string,
  side: FuturesSide,
  price: number,
  leverage: number,
  notional: number,
  reason: string
): { ok: true; state: FuturesAccountState } | { ok: false; error: string } {
  if (!(price > 0) || !(notional > 0) || !(leverage >= 1)) {
    return { ok: false, error: "參數無效" };
  }
  const margin = notional / leverage;
  if (margin > account.marginBalance + 1e-8) {
    return { ok: false, error: "保證金餘額不足" };
  }
  const qty = notional / price;
  if (!(qty > 0)) return { ok: false, error: "數量無效" };

  const pos: FuturesPosition = {
    id: uid(),
    symbol,
    side,
    qty,
    entryPrice: price,
    leverage,
    marginAllocated: margin,
    liquidationPrice: estimateLiquidationPrice(price, leverage, side),
    unrealizedPnl: 0,
    markPrice: price,
    openedAt: new Date().toISOString(),
  };

  const kind: FuturesEventKind = side === "long" ? "open_long" : "open_short";
  const history = pushEvent(account.history, {
    symbol,
    kind,
    side,
    qty,
    price,
    leverage,
    margin,
    reason,
  });

  return {
    ok: true,
    state: {
      ...account,
      marginBalance: account.marginBalance - margin,
      positions: [...account.positions, pos],
      history,
      updatedAt: new Date().toISOString(),
    },
  };
}

export interface FuturesRunResult {
  account: FuturesAccountState;
  status: FuturesBotStatus;
  actions: string[];
}

/**
 * One paper futures momentum scan (isolated USDT-M style).
 * Mark from same public feed as spot. No real orders / no API keys.
 */
export async function runFuturesBotOnce(
  settings: FuturesBotSettings
): Promise<FuturesRunResult> {
  const actions: string[] = [];
  let account = loadFuturesAccount();
  let dataSource: MarketDataSource | null = null;

  try {
    const tickers = await fetchTickers24hr();
    dataSource = getLastMarketSource();
    const prices = priceMap(tickers);
    const universe = selectUniverse(tickers, settings.universe);
    const bySymbol = new Map(universe.map((t) => [t.symbol, t]));

    const vols = universe.map((t) => num(t.quoteVolume)).filter((v) => v > 0);
    const medVol = median(vols);

    // Mark + liquidation checks first
    account = {
      ...account,
      positions: markPositions(account.positions, prices),
    };

    for (const pos of [...account.positions]) {
      const mark = prices[pos.symbol] ?? pos.markPrice;
      if (!(mark > 0)) continue;
      if (isLiquidated(pos, mark)) {
        account = closePosition(
          account,
          pos,
          pos.liquidationPrice,
          "liquidation",
          `模擬爆倉 @ ${pos.liquidationPrice.toPrecision(6)}（標記 ${mark.toPrecision(6)}）`,
          true
        );
        actions.push(
          `爆倉 ${pos.side === "long" ? "多" : "空"} ${pos.symbol} @ liq ${pos.liquidationPrice}`
        );
      }
    }

    // TP / SL / reverse exits (price-based)
    for (const pos of [...account.positions]) {
      const mark = prices[pos.symbol];
      if (!(mark > 0)) continue;
      const tpMove = settings.takeProfitPct / 100;
      const slMove = settings.stopLossPct / 100;
      let reason: string | null = null;

      if (pos.side === "long") {
        const up = (mark - pos.entryPrice) / pos.entryPrice;
        const down = (pos.entryPrice - mark) / pos.entryPrice;
        if (up >= tpMove) {
          reason = `停利 價格+${settings.takeProfitPct}%（約 ROE ${(settings.takeProfitPct * pos.leverage).toFixed(1)}%）`;
        } else if (down >= slMove) {
          reason = `停損 價格−${settings.stopLossPct}%（約 ROE −${(settings.stopLossPct * pos.leverage).toFixed(1)}%）`;
        }
      } else {
        const down = (pos.entryPrice - mark) / pos.entryPrice;
        const up = (mark - pos.entryPrice) / pos.entryPrice;
        if (down >= tpMove) {
          reason = `停利 價格−${settings.takeProfitPct}%（約 ROE ${(settings.takeProfitPct * pos.leverage).toFixed(1)}%）`;
        } else if (up >= slMove) {
          reason = `停損 價格+${settings.stopLossPct}%（約 ROE −${(settings.stopLossPct * pos.leverage).toFixed(1)}%）`;
        }
      }

      if (!reason && settings.exitOnReverse) {
        const t =
          bySymbol.get(pos.symbol) ??
          tickers.find((x) => x.symbol === pos.symbol);
        const changePct = t ? num(t.priceChangePercent) : 0;
        if (pos.side === "long" && changePct <= -settings.entryThresholdPct) {
          reason = `反向訊號 24h ${changePct.toFixed(2)}%`;
        } else if (
          pos.side === "short" &&
          changePct >= settings.entryThresholdPct
        ) {
          reason = `反向訊號 24h ${changePct.toFixed(2)}%`;
        }
      }

      if (!reason) continue;
      const kind: FuturesEventKind =
        pos.side === "long" ? "close_long" : "close_short";
      account = closePosition(account, pos, mark, kind, reason, false);
      actions.push(
        `平倉 ${pos.side === "long" ? "多" : "空"} ${pos.symbol} @ ${mark}（${reason}）`
      );
    }

    // Entries
    account = {
      ...account,
      positions: markPositions(account.positions, prices),
    };
    const eq = futuresEquity(account);
    const openCount = account.positions.length;
    const held = new Set(account.positions.map((p) => p.symbol));
    let slots = Math.max(0, settings.maxOpenPositions - openCount);

    if (slots > 0) {
      type Cand = { t: BinanceTicker24hr; side: FuturesSide; change: number };
      const candidates: Cand[] = [];

      for (const t of universe) {
        const change = num(t.priceChangePercent);
        const qv = num(t.quoteVolume);
        const last = num(t.lastPrice);
        if (!(last > 0) || qv <= medVol || held.has(t.symbol)) continue;

        if (change >= settings.entryThresholdPct) {
          candidates.push({ t, side: "long", change });
        } else if (
          settings.sideMode === "long_short" &&
          change <= -settings.entryThresholdPct
        ) {
          candidates.push({ t, side: "short", change });
        }
      }

      candidates.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

      for (const c of candidates) {
        if (slots <= 0) break;
        const last = num(c.t.lastPrice);
        const notional = eq * (settings.maxPositionNotionalPct / 100);
        const marginNeeded = notional / settings.leverage;
        if (notional < 1 || marginNeeded > account.marginBalance + 1e-8) {
          if (account.marginBalance < 1) break;
          continue;
        }
        const reason = `動能進場 24h ${c.change.toFixed(2)}% · ${settings.leverage}x · 名義≈${notional.toFixed(2)}`;
        const result = openPosition(
          account,
          c.t.symbol,
          c.side,
          last,
          settings.leverage,
          notional,
          reason
        );
        if (result.ok) {
          account = result.state;
          held.add(c.t.symbol);
          slots -= 1;
          actions.push(
            `開${c.side === "long" ? "多" : "空"} ${c.t.symbol} @ ${last}（${settings.leverage}x，24h ${c.change.toFixed(2)}%）`
          );
        }
      }
    }

    account = {
      ...account,
      positions: markPositions(account.positions, prices),
    };
    account = {
      ...account,
      equityCurve: pushEquityPoint(account.equityCurve, account),
    };
    saveFuturesAccount(account);

    const signal =
      actions.length > 0
        ? actions.join("；")
        : `掃描 ${universe.length} 檔（中位量 ${medVol.toFixed(0)}），無新進出場／爆倉`;

    const status: FuturesBotStatus = {
      lastRunAt: new Date().toISOString(),
      lastSignal: signal,
      lastError: null,
      dataSource,
      running: settings.enabled,
    };
    saveFuturesStatus(status);
    return { account, status, actions };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status: FuturesBotStatus = {
      lastRunAt: new Date().toISOString(),
      lastSignal: actions.length ? actions.join("；") : null,
      lastError: msg,
      dataSource,
      running: settings.enabled,
    };
    saveFuturesStatus(status);
    return { account, status, actions };
  }
}

export function resetFuturesAccount(
  startingMarginBalanceUSDT: number
): FuturesAccountState {
  const next = createEmptyFuturesAccount(startingMarginBalanceUSDT);
  saveFuturesAccount(next);
  return next;
}

export function sideModeLabel(mode: FuturesBotSettings["sideMode"]): string {
  return mode === "long_short" ? "多空皆可" : "僅做多";
}

export function eventKindLabel(kind: FuturesEventKind): string {
  switch (kind) {
    case "open_long":
      return "開多";
    case "open_short":
      return "開空";
    case "close_long":
      return "平多";
    case "close_short":
      return "平空";
    case "liquidation":
      return "爆倉";
    default:
      return kind;
  }
}
