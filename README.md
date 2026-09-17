# 幣市觀測＋幣安虛擬倉

繁體中文 Web App：以 **幣安公開 REST** 觀測 USDT 現貨行情，並在瀏覽器以 **localStorage** 模擬虛擬現貨倉（無 API 金鑰、無真實下單）。

> **非投資建議。** 本專案僅供學習與介面練習，評分與「今日觀察」為啟發式規則，不構成任何買賣推薦。

## 功能

| 路由 | 說明 |
|------|------|
| `/` | 觀測看板：24h ticker、篩選（全部／熱門迷因／漲幅／量能）、分數標籤 |
| `/portfolio` | 虛擬倉：起始 10000 USDT（可改）、依最新價買賣、持倉／損益／紀錄／重置 |
| `/daily` | 今日觀察：候選排序＋繁中理由 |
| `/api/binance/ticker/24hr` | 伺服端代理幣安公開 API（短快取，避免 CORS） |

## 技術棧

- Next.js（App Router）+ TypeScript + Tailwind CSS
- 僅呼叫 Binance **public** REST：`GET /api/v3/ticker/24hr`

## 本機執行

```bash
# 需要 Node.js 20+
npm install
npm run dev
```

瀏覽器開啟 [http://localhost:3000](http://localhost:3000)。

正式建置：

```bash
npm run build
npm start
```

## 注意事項

- 虛擬倉只存在於你的瀏覽器；清除網站資料即消失。
- 行情經 `/api/binance/...` 代理並帶短 `Cache-Control`；若幣安端限流或網路不穩，頁面會顯示錯誤，可稍後再試。
- 迷因幣篩選依名稱關鍵字啟發式比對，並非官方分類。
- 本專案**不會**要求或儲存任何交易所 API Key。

## 免責聲明

加密貨幣波動劇烈，本站內容、分數與觀察理由**皆非投資建議**。請自行研究並承擔風險。
