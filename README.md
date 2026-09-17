# 幣市觀測＋幣安虛擬倉＋模擬機器人

繁體中文 Web App：以 **公開市場資料** 觀測 USDT 現貨對映行情，並在瀏覽器以 **localStorage** 模擬虛擬現貨倉、紙上動能現貨機器人與 **USDT-M 模擬合約機器人**（無 API 金鑰、無真實下單）。

> **非投資建議。** 本專案僅供學習與介面練習，評分、「今日觀察」與模擬機器人規則為啟發式，不構成任何買賣推薦。

**線上示範（GitHub Pages）：** https://guobin6910-cell.github.io/crypto-watcher/

## 功能

| 路由 | 說明 |
|------|------|
| `/` | 觀測看板：24h ticker、篩選（全部／熱門迷因／漲幅／量能）、分數標籤 |
| `/portfolio` | 虛擬倉：起始 10000 USDT（可改）、依最新價買賣、持倉／損益／紀錄／重置 |
| `/bot` | 模擬現貨自動交易：localStorage 設定、動能進場／停利停損、僅頁面開啟時輪詢 |
| `/futures-bot` | **模擬 USDT-M 合約**：可選槓桿、逐倉近似強平、動能多／空、獨立 localStorage |
| `/daily` | 今日觀察：候選排序＋繁中理由 |

## 模擬現貨機器人預設參數

| 參數 | 預設 |
|------|------|
| startingCapitalUSDT | 10000 |
| maxPositionPct | 10 |
| maxOpenPositions | 5 |
| pollIntervalSec | 60（最少 30） |
| entryThresholdPct | 5 |
| takeProfitPct | 5 |
| stopLossPct | 3 |
| universe | `watchlist`（亦可 `top_volume` / `meme_keywords`） |
| exitOnReverse | true |
| enabled | false |

成交紀錄與虛擬倉共用，並標記 `source: 'bot' | 'manual'`。

## 模擬合約機器人預設參數（`/futures-bot`）

| 參數 | 預設 |
|------|------|
| startingMarginBalanceUSDT | 10000 |
| leverage | 5（可選 1,2,3,5,10,20；套用於新倉） |
| marginMode | isolated（MVP 僅逐倉） |
| maxPositionNotionalPct | 20（名義佔權益） |
| maxOpenPositions | 3 |
| pollIntervalSec | 60（最少 30） |
| entryThresholdPct | 5 |
| takeProfitPct | 2（**價格**變動；ROE ≈ 價格% × 槓桿） |
| stopLossPct | 1（價格變動） |
| universe | `watchlist` |
| sideMode | `long_only`（可改 `long_short`） |
| exitOnReverse | true |
| enabled | false |

- 設定鍵：`cw_futures_bot_v1`（與現貨機器人／虛擬倉分開）
- 帳戶／持倉／紀錄：`cw_futures_account_v1`
- 事件標記：`source: 'futures_bot'`（含模擬爆倉）
- 強平近似：多 ≈ entry×(1−1/L+0.5%)；空 ≈ entry×(1+1/L−0.5%)
- 資金費率：MVP 略過
- **僅頁面開啟且啟用時**運行；可能模擬爆倉

## 技術棧

- Next.js（App Router）靜態匯出（`output: 'export'`）+ TypeScript + Tailwind CSS
- 部署於 **GitHub Pages**（無伺服端 API）；`basePath`：`/crypto-watcher`
- 瀏覽器優先呼叫 Binance **public** REST：`GET /api/v3/ticker/24hr`
- 若 CORS／地區限制失敗，改用 **CoinGecko** 公開 `/coins/markets`（USD ≈ USDT 標記；符號仍以 `*USDT` 呈現）
- 虛擬倉與機器人設定僅存 localStorage

## 本機執行

```bash
# 需要 Node.js 20+
npm install
npm run dev
```

瀏覽器開啟 [http://localhost:3000/crypto-watcher/](http://localhost:3000/crypto-watcher/)（已設定 `basePath`）。

正式建置（靜態匯出至 `out/`）：

```bash
npm run build
```

## GitHub Pages

推送到 `main` 後，`.github/workflows/pages.yml` 會建置並部署。網站路徑：

`https://guobin6910-cell.github.io/crypto-watcher/`

- 現貨機器人：`https://guobin6910-cell.github.io/crypto-watcher/bot/`
- 模擬合約：`https://guobin6910-cell.github.io/crypto-watcher/futures-bot/`

## 注意事項

- 虛擬倉／模擬合約倉只存在於你的瀏覽器；清除網站資料即消失。
- 模擬機器人**僅在對應頁面開啟且啟用時**運行。
- 即時標記：優先幣安；失敗時自動切換 CoinGecko，並在 UI 顯示資料來源。
- 本專案**不會**要求或儲存任何交易所 API Key，也**不會**呼叫真實下單端點（現貨或合約）。

## 免責聲明

加密貨幣波動劇烈，本站內容、分數、觀察理由與模擬交易結果**皆非投資建議**。槓桿模擬可能爆倉。過去或缺省參數不代表未來。請自行研究並承擔風險。
