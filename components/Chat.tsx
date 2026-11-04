"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "buyer" | "assistant" | "system"; content: string };

const CHIPS = [
  "What is the price of a 2 BHK?",
  "Book a site visit",
  "मुझे हिंदी में बताइए",
  "મને ગુજરાતીમાં માહિતી આપો"
];

export default function Chat({ initialProject, reras }: { initialProject?: "PROJECT_1" | "PROJECT_2"; reras: string[] }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Namaste. I can tell you about our two Ahmedabad projects and book your site visit, in English, Hindi or Gujarati. What would you like to know?"
    }
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [mockNoted, setMockNoted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setError(undefined);
    setMessages((m) => [...m, { role: "buyer", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message, project: initialProject })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setConversationId(data.conversationId);
      if (data.mock && !mockNoted) {
        setMockNoted(true);
        setMessages((m) => [...m, { role: "system", content: "Demo mode: scripted assistant (no AI key configured). The full AI handles free-form questions and Hindi/Gujarati." }]);
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      if (data.booked) {
        setMessages((m) => [
          ...m,
          { role: "system", content: `Visit confirmed: ${data.booked.when}. A confirmation and two reminders are on their way to your number.` }
        ]);
      } else if (data.handedOff) {
        setMessages((m) => [
          ...m,
          { role: "system", content: data.handedOff.execName ? `Handed to ${data.handedOff.execName} with your chat history.` : "Handed to our sales team with your chat history." }
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the assistant. Check your connection and try again.");
      setMessages((m) => m.slice(0, -1));
      setInput(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col px-4">
      <header className="flex items-center justify-between border-b border-line py-4">
        <Link href="/" className="font-display text-lg">Company A</Link>
        <span className="text-xs text-ink/40">Replies in under two minutes</span>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto py-6" aria-live="polite">
        {messages.map((m, i) =>
          m.role === "system" ? (
            <p key={i} className="msg-in mx-auto max-w-md rounded-md bg-pine-soft px-3 py-2 text-center text-xs text-pine">
              {m.content}
            </p>
          ) : m.role === "buyer" ? (
            <div key={i} className="msg-in flex justify-end">
              <p className="max-w-[85%] rounded-lg bg-ink px-4 py-2.5 text-sm leading-relaxed text-paper">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="msg-in flex">
              <p className="max-w-[85%] whitespace-pre-line border-l-2 border-pine pl-4 text-sm leading-relaxed text-ink/90">
                {m.content}
              </p>
            </div>
          )
        )}
        {busy && (
          <div className="msg-in flex items-center gap-1.5 border-l-2 border-pine/40 pl-4" aria-label="Assistant is typing">
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </div>
        )}
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}{" "}
            <button onClick={() => send(input)} className="font-medium underline">Try again</button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 pb-3">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => send(c)} disabled={busy} className="chip hover:border-pine hover:text-pine">
              {c}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex gap-2 border-t border-line py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          placeholder="Type in English, Hindi or Gujarati"
          className="input flex-1"
          aria-label="Your message"
          autoFocus
        />
        <button type="submit" disabled={busy || !input.trim()} className="btn">Send</button>
      </form>
      <p className="pb-3 text-[10px] leading-snug text-ink/35">
        {reras.join(" | ")}. Details from registered information only; final prices confirmed by the
        sales team. We contact you only with your consent (DPDP Act, 2023). Ask for a person any time.
      </p>
    </main>
  );
}
