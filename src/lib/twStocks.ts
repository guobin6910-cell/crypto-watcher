/** 台股每日三檔：公開行情啟發式評分（非投資建議） */

export type TwStockMeta = {
  code: string;
  name: string;
  sector: string;
};

export type TwBar = { t: number; c: number; v: number };

export type TwPick = {
  code: string;
  name: string;
  sector: string;
  price: number;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  riskReward: number;
  signal: "偏多觀察" | "中性觀察" | "偏空警戒";
  score: number;
  ret5d: number;
  ret20d: number;
  techReason: string;
  themeReason: string;
  source: string;
};

export const TW_WATCHLIST: TwStockMeta[] = [
  { code: "2330", name: "台積電", sector: "半導體" },
  { code: "2317", name: "鴻海", sector: "電子代工" },
  { code: "2454", name: "聯發科", sector: "半導體" },
  { code: "2308", name: "台達電", sector: "電子零組件" },
  { code: "2382", name: "廣達", sector: "電子代工" },
  { code: "2303", name: "聯電", sector: "半導體" },
  { code: "2881", name: "富邦金", sector: "金融" },
  { code: "2882", name: "國泰金", sector: "金融" },
  { code: "2891", name: "中信金", sector: "金融" },
  { code: "2886", name: "兆豐金", sector: "金融" },
  { code: "2412", name: "中華電", sector: "電信" },
  { code: "1301", name: "台塑", sector: "傳產" },
  { code: "1303", name: "南亞", sector: "傳產" },
  { code: "2002", name: "中鋼", sector: "鋼鐵" },
  { code: "2207", name: "和泰車", sector: "汽車" },
  { code: "2912", name: "統一超", sector: "通路" },
  { code: "1216", name: "統一", sector: "食品" },
  { code: "1101", name: "台泥", sector: "水泥" },
  { code: "2603", name: "長榮", sector: "航運" },
  { code: "2609", name: "陽明", sector: "航運" },
  { code: "2615", name: "萬海", sector: "航運" },
  { code: "3034", name: "聯詠", sector: "半導體" },
  { code: "2379", name: "瑞昱", sector: "半導體" },
  { code: "3037", name: "欣興", sector: "電子零組件" },
  { code: "3711", name: "日月光投控", sector: "半導體" },
  { code: "6669", name: "緯穎", sector: "電子代工" },
  { code: "3231", name: "緯創", sector: "電子代工" },
  { code: "2357", name: "華碩", sector: "電腦週邊" },
  { code: "2327", name: "國巨", sector: "被動元件" },
  { code: "3008", name: "大立光", sector: "光學" },
  { code: "2395", name: "研華", sector: "工業電腦" },
  { code: "2345", name: "智邦", sector: "網通" },
  { code: "3661", name: "世芯-KY", sector: "半導體" },
  { code: "5274", name: "信驊", sector: "半導體" },
  { code: "6446", name: "藥華藥", sector: "生技" },
  { code: "6505", name: "台塑化", sector: "石化" },
  { code: "5871", name: "中租-KY", sector: "租賃" },
  { code: "2801", name: "彰銀", sector: "金融" },
  { code: "2884", name: "玉山金", sector: "金融" },
  { code: "2880", name: "華南金", sector: "金融" },
];

function sma(xs: number[], n: number): number | null {
  if (xs.length < n) return null;
  const slice = xs.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

function rsi(closes: number[], n = 14): number | null {
  if (closes.length < n + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function dayKeyTaipei(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function fetchYahooChart(
  code: string,
): Promise<{ bars: TwBar[]; source: string } | null> {
  const yahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.TW?interval=1d&range=3mo`;
  const proxies = [
    yahoo,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(yahoo)}`,
    `https://corsproxy.io/?${encodeURIComponent(yahoo)}`,
  ];
  for (const url of proxies) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const j = await res.json();
      const r = j?.chart?.result?.[0];
      const ts: number[] = r?.timestamp ?? [];
      const q = r?.indicators?.quote?.[0];
      const closes: (number | null)[] = q?.close ?? [];
      const vols: (number | null)[] = q?.volume ?? [];
      const bars: TwBar[] = [];
      for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (c == null || !Number.isFinite(c)) continue;
        bars.push({ t: ts[i]! * 1000, c, v: vols[i] ?? 0 });
      }
      if (bars.length >= 25) {
        return { bars, source: url === yahoo ? "Yahoo" : "Yahoo（代理）" };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function synthBars(code: string, day: string): TwBar[] {
  const seed = hashSeed(`${code}-${day}`);
  let price = 50 + (seed % 800);
  const bars: TwBar[] = [];
  const now = Date.now();
  for (let i = 60; i >= 0; i--) {
    const n = ((seed >> (i % 16)) ^ (i * 2654435761)) >>> 0;
    const chg = ((n % 200) - 100) / 1000;
    price = Math.max(5, price * (1 + chg));
    bars.push({
      t: now - i * 86400000,
      c: Math.round(price * 100) / 100,
      v: 1e6 + (n % 5e6),
    });
  }
  return bars;
}

function scoreBars(meta: TwStockMeta, bars: TwBar[], day: string): TwPick {
  const closes = bars.map((b) => b.c);
  const price = closes[closes.length - 1]!;
  const c5 = closes[closes.length - 6] ?? closes[0]!;
  const c20 = closes[closes.length - 21] ?? closes[0]!;
  const ret5d = (price / c5 - 1) * 100;
  const ret20d = (price / c20 - 1) * 100;
  const ma20 = sma(closes, 20);
  const ma60 = sma(closes, Math.min(60, closes.length));
  const r = rsi(closes, 14);
  const vols = bars.map((b) => b.v);
  const volAvg = sma(vols, 20) ?? 1;
  const volRatio = (vols[vols.length - 1] ?? 0) / volAvg;

  let score = 50;
  score += Math.max(-15, Math.min(15, ret5d * 1.2));
  score += Math.max(-10, Math.min(10, ret20d * 0.4));
  if (ma20 != null) score += price > ma20 ? 8 : -6;
  if (ma60 != null) score += price > ma60 ? 6 : -4;
  if (r != null) {
    if (r >= 45 && r <= 68) score += 8;
    else if (r > 75) score -= 8;
    else if (r < 30) score += 3;
  }
  if (volRatio > 1.3) score += 5;
  score += (hashSeed(`${meta.code}-${day}`) % 100) / 50;

  const atrProxy = Math.max(
    0.01,
    Math.abs(price - (ma20 ?? price)) * 0.5 + price * 0.015,
  );
  const entry = Math.round(price * 100) / 100;
  const takeProfit = Math.round((price + atrProxy * 2.2) * 100) / 100;
  const stopLoss = Math.round((price - atrProxy * 1.1) * 100) / 100;
  const risk = entry - stopLoss;
  const reward = takeProfit - entry;
  const riskReward = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;

  let signal: TwPick["signal"] = "中性觀察";
  if (score >= 62 && ret5d > 0) signal = "偏多觀察";
  if (score < 45 || (r != null && r > 78)) signal = "偏空警戒";

  const techBits: string[] = [];
  if (ma20 != null) techBits.push(price > ma20 ? "站上 MA20" : "跌破 MA20");
  if (ma60 != null) techBits.push(price > ma60 ? "位在 MA60 上方" : "低於 MA60");
  if (r != null) techBits.push(`RSI≈${r.toFixed(0)}`);
  techBits.push(`近5日 ${ret5d >= 0 ? "+" : ""}${ret5d.toFixed(1)}%`);

  return {
    code: meta.code,
    name: meta.name,
    sector: meta.sector,
    price: entry,
    entry,
    takeProfit,
    stopLoss,
    riskReward,
    signal,
    score: Math.round(score * 10) / 10,
    ret5d,
    ret20d,
    techReason: techBits.join("；"),
    themeReason: `${meta.sector}族群流動性佳；今日清單依動能／均線／量能啟發式篩選，僅供模擬觀察。`,
    source: "",
  };
}

export async function buildDailyTwPicks(force = false): Promise<{
  day: string;
  picks: TwPick[];
  live: boolean;
  note: string;
}> {
  const day = dayKeyTaipei();
  const results: TwPick[] = [];
  let liveCount = 0;
  let source = "";

  const batch = 8;
  for (let i = 0; i < TW_WATCHLIST.length; i += batch) {
    const chunk = TW_WATCHLIST.slice(i, i + batch);
    const got = await Promise.all(
      chunk.map(async (m) => {
        const live = await fetchYahooChart(m.code);
        if (live) {
          liveCount++;
          source = live.source;
          const pick = scoreBars(m, live.bars, day);
          pick.source = live.source;
          return pick;
        }
        const pick = scoreBars(m, synthBars(m.code, day), day);
        pick.source = "示意資料";
        return pick;
      }),
    );
    results.push(...got);
    if (!force && i === 0 && liveCount === 0) {
      for (const m of TW_WATCHLIST.slice(batch)) {
        const pick = scoreBars(m, synthBars(m.code, day), day);
        pick.source = "示意資料";
        results.push(pick);
      }
      break;
    }
  }

  results.sort((a, b) => b.score - a.score);

  const picks: TwPick[] = [];
  const usedSectors = new Set<string>();
  for (const r of results) {
    if (picks.length >= 3) break;
    if (usedSectors.has(r.sector)) {
      if (picks.length === 2) {
        picks.push(r);
        break;
      }
      continue;
    }
    picks.push(r);
    usedSectors.add(r.sector);
  }
  while (picks.length < 3) {
    const next = results.find((r) => !picks.includes(r));
    if (!next) break;
    picks.push(next);
  }

  const live = liveCount > 0;
  return {
    day,
    picks: picks.slice(0, 3),
    live,
    note: live
      ? `行情來源：${source || "Yahoo"}（成功 ${liveCount}/${TW_WATCHLIST.length}）`
      : "無法取得即時台股行情，目前顯示示意評分（仍可瀏覽介面）。",
  };
}
