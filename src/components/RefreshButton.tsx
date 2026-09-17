"use client";

export function RefreshButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
    >
      <span className={loading ? "animate-spin" : ""} aria-hidden>
        ↻
      </span>
      {loading ? "更新中…" : "重新整理"}
    </button>
  );
}
