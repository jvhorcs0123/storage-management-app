"use client";

type TablePaginationProps = {
  total: number;
  page: number;
  pageSize?: number;
  showAll: boolean;
  onPageChange: (page: number) => void;
  onToggleShowAll: () => void;
};

export default function TablePagination({
  total,
  page,
  pageSize = 10,
  showAll,
  onPageChange,
  onToggleShowAll,
}: TablePaginationProps) {
  if (total <= pageSize) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <span>
        Showing{" "}
        {showAll
          ? total
          : `${(safePage - 1) * pageSize + 1}-${Math.min(
              safePage * pageSize,
              total,
            )}`}{" "}
        of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleShowAll}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {showAll ? "Show pages" : "Show all"}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={showAll || safePage <= 1}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prev
        </button>
        <span className="text-xs font-semibold text-slate-500">
          Page {safePage} of {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, safePage + 1))}
          disabled={showAll || safePage >= pageCount}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
