export default function Loading() {
  return (
    <div className="flex h-64 items-center justify-center gap-3 text-sm text-ink/50">
      <span className="spinner" aria-hidden />
      Loading
    </div>
  );
}
