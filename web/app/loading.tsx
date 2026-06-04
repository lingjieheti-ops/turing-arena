export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span
          className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-600 border-t-mint"
          aria-label="loading"
        />
        Loading the arena…
      </div>
    </div>
  );
}
