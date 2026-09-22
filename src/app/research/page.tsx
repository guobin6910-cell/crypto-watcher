"use client";

import { useCallback, useState } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import {
  formatPrice,
  formatUsd,
  fmtPct,
  runResearchScan,
  type ResearchCandidate,
  type ResearchReport,
} from "@/lib/researchScan";

export default function ResearchPage() {
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topN, setTopN] = useState(8);
  const [expanded, setExpanded] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await runResearchScan(topN);
      setReport(r);
      setExpanded(r.candidates[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "掃描失敗");
    } finally {
      setLoading(false);
    }
  }, [topN]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          加密研究分析師
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
          繁體中文介面。依「市場體制 → 公開估值篩選 → 催化劑／空方挑戰 →
          我可能錯在哪」產出 5–10
          檔候選觀察清單。資料來自 CoinGecko
          公開行情；不虛構鏈上或財報數字，缺口會標明。非投資建議。
        </p>
      </header>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-medium text-amber-200">研究角色（摘要）</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-400">
          <li>基本面／代幣經濟／創投式盡職調查取向，偏懷疑、找否證</li>
          <li>目標：估值與基本面可能脫鉤的非對稱觀察標的（不從熱門幣開頭）</li>
          <li>強制空方論證；無法驗證的指標標為資料缺口</li>
        </ul>
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-zinc-400">
          候選檔數
          <select
            className="ml-2 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
          >
            {[5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? "掃描中…" : "開始研究掃描"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-lg font-medium text-zinc-100">市場概況</h2>
            <p className="mt-1 text-sm text-amber-200/90">
              {report.regime.regimeLabel}
            </p>
            <p className="mt-2 text-sm text-zinc-300">{report.regime.summary}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {report.regime.btcDominanceHint}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              來源：{report.source}　產生：
              {new Date(report.generatedAt).toLocaleString("zh-TW", {
                timeZone: "Asia/Taipei",
              })}{" "}
              （台北）
            </p>
          </section>

          <CandidateTable
            candidates={report.candidates}
            onSelect={(id) => setExpanded((cur) => (cur === id ? null : id))}
          />

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-zinc-100">決選深度檔</h2>
            {report.candidates.map((c) => (
              <DetailCard
                key={c.id}
                c={c}
                open={expanded === c.id}
                onToggle={() =>
                  setExpanded((id) => (id === c.id ? null : c.id))
                }
              />
            ))}
          </section>

          <section className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
            <h2 className="text-lg font-medium text-rose-200">我可能錯在哪？</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-rose-100/70">
              {report.whatCouldBeWrong.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">{report.note}</p>
          </section>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}

function CandidateTable({
  candidates,
  onSelect,
}: {
  candidates: ResearchCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2">資產</th>
            <th className="px-3 py-2">代號</th>
            <th className="px-3 py-2">價格</th>
            <th className="px-3 py-2">市值</th>
            <th className="px-3 py-2">市值/FDV</th>
            <th className="px-3 py-2">24h</th>
            <th className="px-3 py-2">7d</th>
            <th className="px-3 py-2">研究分</th>
            <th className="px-3 py-2">核心論點</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr
              key={c.id}
              className="cursor-pointer border-t border-zinc-800/80 hover:bg-zinc-900/80"
              onClick={() => onSelect(c.id)}
            >
              <td className="px-3 py-2 text-zinc-100">{c.name}</td>
              <td className="px-3 py-2 font-mono text-amber-200/90">
                {c.symbol}
              </td>
              <td className="px-3 py-2 tabular-nums">{formatPrice(c.price)}</td>
              <td className="px-3 py-2 tabular-nums text-zinc-300">
                {formatUsd(c.marketCap)}
              </td>
              <td className="px-3 py-2 tabular-nums text-zinc-300">
                {c.mcapFdv != null ? c.mcapFdv.toFixed(2) : "—"}
              </td>
              <td
                className={`px-3 py-2 tabular-nums ${
                  (c.change24h ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {fmtPct(c.change24h)}
              </td>
              <td
                className={`px-3 py-2 tabular-nums ${
                  (c.change7d ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {fmtPct(c.change7d)}
              </td>
              <td className="px-3 py-2 font-semibold text-amber-300">
                {c.score}
              </td>
              <td className="max-w-xs truncate px-3 py-2 text-zinc-400">
                {c.thesis}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DetailCard({
  c,
  open,
  onToggle,
}: {
  c: ResearchCandidate;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-950/60">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={onToggle}
      >
        <span className="font-medium text-zinc-100">
          {c.name}{" "}
          <span className="font-mono text-amber-200">{c.symbol}</span>
          <span className="ml-2 text-sm text-zinc-500">研究分 {c.score}</span>
        </span>
        <span className="text-zinc-500">{open ? "收合" : "展開"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-zinc-800 px-4 py-3 text-sm text-zinc-300">
          <p>
            <span className="text-zinc-500">核心論點：</span>
            {c.thesis}
          </p>
          <p>
            <span className="text-zinc-500">標籤：</span>
            {c.tags.join("、") || "—"}
          </p>
          <div>
            <p className="text-emerald-300/90">多頭／催化劑（待核對）</p>
            <ul className="mt-1 list-inside list-disc text-zinc-400">
              {c.catalysts.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-rose-300/90">空方論證／風險</p>
            <ul className="mt-1 list-inside list-disc text-zinc-400">
              {c.risks.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-amber-200/80">資料缺口</p>
            <ul className="mt-1 list-inside list-disc text-zinc-500">
              {c.dataGaps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-zinc-500">
            量能／市值：
            {c.volMcap != null ? `${(c.volMcap * 100).toFixed(2)}%` : "—"}
            　距 ATH：{fmtPct(c.athChangePct)}
            　失效條件示例：大量解鎖、相對 BTC 轉弱且量能枯竭、官方敘事被否證。
          </p>
        </div>
      )}
    </article>
  );
}
