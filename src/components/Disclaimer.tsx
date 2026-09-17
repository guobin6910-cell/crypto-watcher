export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-zinc-500">
        資料來自幣安公開 API；虛擬倉僅存於本機。本站內容<strong className="font-medium text-zinc-400">非投資建議</strong>。
      </p>
    );
  }
  return (
    <aside className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
      <p className="font-medium text-amber-200">免責聲明</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-100/70">
        <li>僅使用幣安公開 REST，無 API 金鑰、無真實下單。</li>
        <li>虛擬倉資料儲存在瀏覽器 localStorage，清除瀏覽資料即消失。</li>
        <li>評分與「今日觀察」為啟發式規則，<strong>非投資建議</strong>，不構成任何買賣推薦。</li>
      </ul>
    </aside>
  );
}
