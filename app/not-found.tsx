import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
      <p className="font-display text-5xl text-ink/20">404</p>
      <h1 className="mt-3 font-display text-xl">This page does not exist</h1>
      <Link href="/" className="btn mt-6">Back to home</Link>
    </main>
  );
}
