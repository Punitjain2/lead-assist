"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h2 className="font-display text-xl">Something went wrong</h2>
      <p className="mt-2 text-sm text-ink/50">
        The page could not load. Your data is safe; this is usually a one-off.
      </p>
      <button onClick={reset} className="btn mt-5">Try again</button>
    </div>
  );
}
