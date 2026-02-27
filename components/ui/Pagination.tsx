interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const btn = 'px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center justify-center gap-2">
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className={btn}>
        &lt;
      </button>
      <span className="text-sm text-gray-500">{page} / {totalPages}</span>
      <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className={btn}>
        &gt;
      </button>
    </div>
  );
}
