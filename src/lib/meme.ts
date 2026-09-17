/** 常見迷因／熱門關鍵字（以 base asset 比對，大小寫不敏感） */
export const MEME_KEYWORDS = [
  "DOGE",
  "SHIB",
  "PEPE",
  "FLOKI",
  "BONK",
  "WIF",
  "MEME",
  "BABYDOGE",
  "ELON",
  "MOG",
  "BRETT",
  "NEIRO",
  "PNUT",
  "GOAT",
  "ACT",
  "BAN",
  "TRUMP",
  "MELANIA",
  "FARTCOIN",
  "POPCAT",
  "MEW",
  "BOME",
  "MYRO",
  "TURBO",
  "SAMO",
  "CAT",
  "MOON",
  "AIDOGE",
  "LADYS",
  "SATS",
  "ORDI",
  "RATS",
  "1000SATS",
  "1000PEPE",
  "1000BONK",
  "1000FLOKI",
  "1000CAT",
  "1000RATS",
] as const;

export function isMemeSymbol(symbol: string): boolean {
  const base = symbol.replace(/USDT$/i, "").toUpperCase();
  return MEME_KEYWORDS.some(
    (k) => base === k || base.includes(k) || k.includes(base)
  );
}

export function extractBaseAsset(symbol: string): string {
  return symbol.replace(/USDT$/i, "");
}
