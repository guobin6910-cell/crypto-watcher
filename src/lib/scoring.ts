import type { BinanceTicker24hr, ScoredTicker, ScoreTag, DailyCandidate } from "./types";
import { extractBaseAsset, isMemeSymbol } from "./meme";

function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** 簡易啟發式評分（非投資建議）：漲幅、量能、迷因加成 */
export function scoreTicker(t: BinanceTicker24hr): ScoredTicker {
  const changePct = num(t.priceChangePercent);
  const quoteVol = num(t.quoteVolume);
  const high = num(t.highPrice);
  const low = num(t.lowPrice);
  const last = num(t.lastPrice);
  const meme = isMemeSymbol(t.symbol);
  const tags: ScoreTag[] = [];

  let score = 50;

  // 漲跌
  if (changePct >= 15) {
    score += 25;
    tags.push("強勢上漲");
  } else if (changePct >= 5) {
    score += 15;
    tags.push("溫和上漲");
  } else if (changePct <= -15) {
    score -= 20;
    tags.push("大跌");
  } else if (changePct < -3) {
    score -= 10;
    tags.push("下跌");
  }

  // 量能（USDT 報價量）
  if (quoteVol >= 100_000_000) {
    score += 20;
    tags.push("高量能");
  } else if (quoteVol >= 20_000_000) {
    score += 10;
    tags.push("中量能");
  } else if (quoteVol < 1_000_000) {
    score -= 15;
    tags.push("低量能");
  }

  // 波動（高低差）
  if (last > 0 && high > 0 && low > 0) {
    const rangePct = ((high - low) / last) * 100;
    if (rangePct >= 20) {
      score += 5;
      tags.push("波動大");
    }
  }

  if (meme) {
    score += 12;
    tags.push("熱門迷因");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    ...t,
    baseAsset: extractBaseAsset(t.symbol),
    score,
    tags,
    isMeme: meme,
  };
}

export function filterUsdtSpot(tickers: BinanceTicker24hr[]): BinanceTicker24hr[] {
  return tickers.filter(
    (t) =>
      t.symbol.endsWith("USDT") &&
      !t.symbol.includes("_") && // 排除槓桿代幣等特殊符號
      num(t.lastPrice) > 0
  );
}

export function buildDailyWatchlist(scored: ScoredTicker[], limit = 12): DailyCandidate[] {
  // 綜合：分數 + 漲幅 + 量能排序，過濾極低量
  const candidates = scored
    .filter((t) => num(t.quoteVolume) >= 500_000)
    .slice()
    .sort((a, b) => {
      const va = a.score * 0.5 + num(a.priceChangePercent) * 0.3 + Math.log10(Math.max(1, num(a.quoteVolume))) * 5;
      const vb = b.score * 0.5 + num(b.priceChangePercent) * 0.3 + Math.log10(Math.max(1, num(b.quoteVolume))) * 5;
      return vb - va;
    })
    .slice(0, limit);

  return candidates.map((ticker, i) => {
    const reasons: string[] = [];
    const changePct = num(ticker.priceChangePercent);
    const quoteVol = num(ticker.quoteVolume);

    if (ticker.isMeme) {
      reasons.push("名稱／標的符合常見迷因幣關鍵字，社群關注度可能較高。");
    }
    if (changePct >= 10) {
      reasons.push(`24 小時漲幅約 ${changePct.toFixed(2)}%，短線動能偏強。`);
    } else if (changePct >= 3) {
      reasons.push(`24 小時溫和上漲 ${changePct.toFixed(2)}%，可列入觀察。`);
    } else if (changePct <= -10) {
      reasons.push(`24 小時下跌約 ${Math.abs(changePct).toFixed(2)}%，波動較大，僅供風險警示觀察。`);
    }
    if (quoteVol >= 50_000_000) {
      reasons.push(`USDT 成交額約 ${(quoteVol / 1e6).toFixed(1)}M，流動性相對充足。`);
    } else if (quoteVol >= 5_000_000) {
      reasons.push(`USDT 成交額約 ${(quoteVol / 1e6).toFixed(1)}M，量能尚可。`);
    }
    if (ticker.tags.includes("波動大")) {
      reasons.push("日內高低價差偏大，適合當成波動觀察標的（非進出場訊號）。");
    }
    if (ticker.score >= 70) {
      reasons.push(`綜合啟發式分數 ${ticker.score}，相對同儕偏高（規則引擎，非預測）。`);
    }
    if (reasons.length === 0) {
      reasons.push("綜合分數與量能進入今日候選名單，建議自行交叉驗證。");
    }
    reasons.push("※ 以上為公開行情啟發式說明，非投資建議。");

    return { ticker, rank: i + 1, reasons };
  });
}

export function formatPrice(price: number | string): string {
  const p = typeof price === "string" ? num(price) : price;
  if (!Number.isFinite(p)) return "-";
  if (p >= 1000) return p.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toLocaleString("zh-TW", { maximumFractionDigits: 4 });
  if (p >= 0.01) return p.toLocaleString("zh-TW", { maximumFractionDigits: 6 });
  return p.toLocaleString("zh-TW", { maximumFractionDigits: 8 });
}

export function formatVolume(v: number | string): string {
  const n = typeof v === "string" ? num(v) : v;
  if (!Number.isFinite(n)) return "-";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

export function formatPct(p: number | string): string {
  const n = typeof p === "string" ? num(p) : p;
  if (!Number.isFinite(n)) return "-";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
