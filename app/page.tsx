"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: number;
  prompt: string;
  reply: string;
  createdAt: string;
};

type Upload = {
  id: number;
  name: string;
  mimeType: string;
  size: number;
  analysis: string;
  createdAt: string;
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function cleanAnswer(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory() {
    const [chatRes, uploadRes] = await Promise.all([
      fetch("/api/chat"),
      fetch("/api/uploads"),
    ]);
    const chatData = await chatRes.json();
    const uploadData = await uploadRes.json();
    setChatHistory(chatData.messages || []);
    setUploads(uploadData.uploads || []);
  }

  useEffect(() => {
    let active = true;

    async function loadInitialHistory() {
      try {
        const [chatRes, uploadRes] = await Promise.all([
          fetch("/api/chat"),
          fetch("/api/uploads"),
        ]);
        const chatData = await chatRes.json();
        const uploadData = await uploadRes.json();

        if (active) {
          setChatHistory(chatData.messages || []);
          setUploads(uploadData.uploads || []);
        }
      } catch {
        if (active) {
          setError("Could not load local history.");
        }
      }
    }

    void loadInitialHistory();

    return () => {
      active = false;
    };
  }, []);

  async function askWorkspace() {
    if (!message.trim() && !file) return;

    setLoading(true);
    setError("");
    setReply("");

    try {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("prompt", message || "Summarize this file.");

        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Upload failed.");
        }

        setReply(uploadData.upload.analysis);
      } else {
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
          }),
        });
        const chatData = await chatRes.json();

        if (!chatRes.ok) {
          throw new Error(chatData.reply || "Chat failed.");
        }

        setReply(chatData.reply);
      }

      setMessage("");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await loadHistory();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] || null);
  }

  const canSubmit = Boolean(message.trim() || file) && !loading;

  return (
    <main className="min-h-screen overflow-hidden bg-[#050509] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,#30313d_0,#111119_34%,#050509_72%)] opacity-80" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5">
        <header className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="jim-nightshade-regular flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/8 text-xl">
              AI
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide">Offline AI</h1>
              <p className="text-xs text-zinc-500">Ollama + SQLite + local files</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-zinc-300 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            offline
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center pb-8 pt-10">
          <div className="w-full max-w-3xl text-center">
            <p className="text-sm font-medium text-zinc-400">Your private laptop AI workspace</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal text-white sm:text-6xl">
              Ask your files anything.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-zinc-400">
              Upload a resume, PDF, notes, CSV, JSON, or image and ask in plain English. Everything stays local.
            </p>
          </div>

          <div className="mt-8 w-full max-w-3xl rounded-lg border border-white/12 bg-[#121218]/95 p-3 shadow-2xl shadow-black/40">
            {file ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-violet-400/25 bg-violet-400/10 px-3 py-2">
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-medium text-violet-100">{file.name}</p>
                  <p className="text-xs text-violet-200/70">
                    {file.type || "unknown type"} · {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-violet-100 transition hover:bg-white/10"
                  aria-label="Remove file"
                >
                  x
                </button>
              </div>
            ) : null}

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  void askWorkspace();
                }
              }}
              placeholder="Ask about your resume, summarize this PDF, find action items..."
              className="min-h-32 w-full resize-none rounded-md border border-transparent bg-transparent px-3 py-3 text-base leading-7 text-white outline-none placeholder:text-zinc-500 focus:border-white/10"
            />

            <div className="flex flex-col gap-3 border-t border-white/10 px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  onChange={chooseFile}
                  accept="image/*,.pdf,.txt,.md,.csv,.json,.xml,.html,.log"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.1]"
                >
                  <span className="text-lg leading-none">+</span>
                  Attach
                </button>
                <span className="text-xs text-zinc-500">PDF, text, data, images</span>
              </div>

              <button
                type="button"
                onClick={askWorkspace}
                disabled={!canSubmit}
                className="inline-flex h-10 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {loading ? "Working..." : file ? "Ask file" : "Ask"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 w-full max-w-3xl rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          {reply ? (
            <section className="mt-6 w-full max-w-3xl rounded-lg border border-white/10 bg-white/[0.05] p-5 text-left">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Answer</h3>
                <span className="text-xs text-zinc-500">saved locally</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-200">{cleanAnswer(reply)}</p>
            </section>
          ) : null}
        </section>

        <section className="grid gap-4 pb-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h3 className="text-sm font-semibold text-zinc-100">Files</h3>
            <div className="mt-3 space-y-2">
              {uploads.length ? (
                uploads.slice(0, 4).map((item) => (
                  <article key={item.id} className="rounded-md border border-white/8 bg-black/20 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{item.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatBytes(item.size)} · {shortDate(item.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">{cleanAnswer(item.analysis)}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-white/8 bg-black/20 px-3 py-3 text-sm text-zinc-500">
                  No files yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h3 className="text-sm font-semibold text-zinc-100">Recent answers</h3>
            <div className="mt-3 space-y-2">
              {chatHistory.length ? (
                chatHistory.slice(0, 4).map((item) => (
                  <article key={item.id} className="rounded-md border border-white/8 bg-black/20 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-1 text-sm font-medium text-white">{item.prompt}</p>
                      <span className="shrink-0 text-xs text-zinc-500">{shortDate(item.createdAt)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">{cleanAnswer(item.reply)}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-white/8 bg-black/20 px-3 py-3 text-sm text-zinc-500">
                  Your questions will appear here.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
