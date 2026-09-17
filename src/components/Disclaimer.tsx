export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-zinc-500">
        即時標記優先幣安公開 API，失敗時改用 CoinGecko 公開市價；虛擬倉僅存本機。本站內容
        <strong className="font-medium text-zinc-400">非投資建議</strong>。
      </p>
    );
  }
  return (
    <aside className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
      <p className="font-medium text-amber-200">免責聲明</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-100/70">
        <li>
          瀏覽器直接呼叫幣安公開 REST；若 CORS／地區限制失敗，改以 CoinGecko
          公開市價作為 USDT 對映標記。無 API 金鑰、無真實下單。
        </li>
        <li>虛擬倉資料儲存在瀏覽器 localStorage，清除瀏覽資料即消失。</li>
        <li>
          評分、「今日觀察」與模擬機器人規則為啟發式，
          <strong>非投資建議</strong>
          ，不構成任何買賣推薦。
        </li>
        <li>模擬機器人僅在頁面開啟時輪詢，無真實下單。</li>
      </ul>
    </aside>
  );
}
