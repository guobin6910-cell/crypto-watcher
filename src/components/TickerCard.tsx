import type { ScoredTicker } from "@/lib/types";
import { formatPct, formatPrice, formatVolume } from "@/lib/scoring";

const tagColor: Record<string, string> = {
  熱門迷因: "bg-fuchsia-500/20 text-fuchsia-200",
  強勢上漲: "bg-emerald-500/20 text-emerald-200",
  溫和上漲: "bg-emerald-500/10 text-emerald-300/90",
  下跌: "bg-rose-500/10 text-rose-300",
  大跌: "bg-rose-500/20 text-rose-200",
  高量能: "bg-sky-500/20 text-sky-200",
  中量能: "bg-sky-500/10 text-sky-300",
  低量能: "bg-zinc-700 text-zinc-400",
  波動大: "bg-orange-500/20 text-orange-200",
};

export function TickerCard({ ticker }: { ticker: ScoredTicker }) {
  const change = parseFloat(ticker.priceChangePercent);
  const up = change >= 0;

  return (
    <article className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm transition hover:border-zinc-700">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-zinc-50">{ticker.baseAsset}</h3>
          <p className="text-xs text-zinc-500">{ticker.symbol}</p>
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${
            up ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
          }`}
        >
          分數 {ticker.score}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xs text-zinc-500">最新價 (USDT)</p>
          <p className="font-mono text-xl tabular-nums text-zinc-50">
            {formatPrice(ticker.lastPrice)}
          </p>
        </div>
        <p
          className={`font-mono text-lg font-medium tabular-nums ${
            up ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {formatPct(ticker.priceChangePercent)}
        </p>
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        24h 成交額{" "}
        <span className="font-mono text-zinc-300">{formatVolume(ticker.quoteVolume)}</span> USDT
      </p>

      {ticker.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ticker.tags.map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-[11px] ${tagColor[tag] ?? "bg-zinc-800 text-zinc-300"}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
