"use client";

import type { PortfolioState, Position, TradeRecord } from "./types";

const STORAGE_KEY = "crypto-watcher-portfolio-v1";
export const DEFAULT_CASH = 10_000;

export function createEmptyPortfolio(initialCash = DEFAULT_CASH): PortfolioState {
  return {
    cash: initialCash,
    initialCash,
    positions: [],
    history: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadPortfolio(): PortfolioState {
  if (typeof window === "undefined") return createEmptyPortfolio();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyPortfolio();
    const parsed = JSON.parse(raw) as PortfolioState;
    if (
      typeof parsed.cash !== "number" ||
      typeof parsed.initialCash !== "number" ||
      !Array.isArray(parsed.positions) ||
      !Array.isArray(parsed.history)
    ) {
      return createEmptyPortfolio();
    }
    return parsed;
  } catch {
    return createEmptyPortfolio();
  }
}

export function savePortfolio(state: PortfolioState): void {
  if (typeof window === "undefined") return;
  const next = { ...state, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buy(
  state: PortfolioState,
  symbol: string,
  qty: number,
  price: number
): { ok: true; state: PortfolioState } | { ok: false; error: string } {
  if (!symbol.endsWith("USDT")) {
    return { ok: false, error: "僅支援現貨 USDT 交易對" };
  }
  if (!(qty > 0) || !(price > 0)) {
    return { ok: false, error: "數量與價格必須大於 0" };
  }
  const cost = qty * price;
  if (cost > state.cash + 1e-8) {
    return { ok: false, error: "現金不足" };
  }

  const positions = [...state.positions];
  const idx = positions.findIndex((p) => p.symbol === symbol);
  if (idx >= 0) {
    const old = positions[idx];
    const newQty = old.qty + qty;
    const avgPrice = (old.avgPrice * old.qty + price * qty) / newQty;
    positions[idx] = { symbol, qty: newQty, avgPrice };
  } else {
    positions.push({ symbol, qty, avgPrice: price });
  }

  const record: TradeRecord = {
    id: uid(),
    symbol,
    side: "buy",
    qty,
    price,
    usdt: cost,
    at: new Date().toISOString(),
  };

  return {
    ok: true,
    state: {
      ...state,
      cash: state.cash - cost,
      positions,
      history: [record, ...state.history].slice(0, 200),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function sell(
  state: PortfolioState,
  symbol: string,
  qty: number,
  price: number
): { ok: true; state: PortfolioState } | { ok: false; error: string } {
  if (!(qty > 0) || !(price > 0)) {
    return { ok: false, error: "數量與價格必須大於 0" };
  }
  const idx = state.positions.findIndex((p) => p.symbol === symbol);
  if (idx < 0) {
    return { ok: false, error: "沒有該持倉" };
  }
  const pos = state.positions[idx];
  if (qty > pos.qty + 1e-12) {
    return { ok: false, error: "持倉數量不足" };
  }

  const proceeds = qty * price;
  const positions: Position[] = [...state.positions];
  const remain = pos.qty - qty;
  if (remain < 1e-12) {
    positions.splice(idx, 1);
  } else {
    positions[idx] = { ...pos, qty: remain };
  }

  const record: TradeRecord = {
    id: uid(),
    symbol,
    side: "sell",
    qty,
    price,
    usdt: proceeds,
    at: new Date().toISOString(),
  };

  return {
    ok: true,
    state: {
      ...state,
      cash: state.cash + proceeds,
      positions,
      history: [record, ...state.history].slice(0, 200),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function equity(
  state: PortfolioState,
  prices: Record<string, number>
): number {
  let total = state.cash;
  for (const p of state.positions) {
    const px = prices[p.symbol] ?? p.avgPrice;
    total += p.qty * px;
  }
  return total;
}

export function resetPortfolio(initialCash = DEFAULT_CASH): PortfolioState {
  const next = createEmptyPortfolio(initialCash);
  savePortfolio(next);
  return next;
}
