"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Sign in failed.");
    router.push(params.get("next") || "/app/leads");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <Link href="/" className="font-display text-lg">Company A</Link>
      <h1 className="mt-8 font-display text-2xl">Staff sign in</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Signing in" : "Sign in"}</button>
      </form>
      <div className="mt-6 rounded-md bg-sand/50 p-3 text-xs leading-relaxed text-ink/60">
        Demo accounts, password <span className="font-medium">demo1234</span>:<br />
        head@demo.in (sales head) | exec1@demo.in (sales executive)
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
