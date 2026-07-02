"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

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

export default function Home() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePrompt, setFilePrompt] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState("");

  const modelName = useMemo(() => "llama3.2", []);

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
    loadHistory().catch(() => setError("Could not load local history."));
  }, []);

  async function sendMessage() {
    if (!message.trim()) return;

    setChatLoading(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.reply || "Failed to chat.");
      }

      setReply(data.reply);
      setMessage("");
      await loadHistory();
    } catch (err) {
      console.error(err);
      setError("Chat failed. Make sure Ollama is running on localhost:11434.");
    } finally {
      setChatLoading(false);
    }
  }

  async function analyzeFile() {
    if (!file) return;

    setUploadLoading(true);
    setError("");
    setAnalysis("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prompt", filePrompt);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze upload.");
      }

      setAnalysis(data.upload.analysis);
      setFile(null);
      setFilePrompt("");
      await loadHistory();
    } catch (err) {
      console.error(err);
      setError("Upload analysis failed. Check Ollama and the file type.");
    } finally {
      setUploadLoading(false);
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] || null);
  }

  return (
    <main className="min-h-screen bg-[#080b10] text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-cyan-300">
              Local workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white md:text-5xl">
              Offline AI Desk
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-slate-400">Model</p>
              <p className="mt-1 font-medium text-white">{modelName}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-slate-400">Database</p>
              <p className="mt-1 font-medium text-white">SQLite</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-slate-400">Mode</p>
              <p className="mt-1 font-medium text-white">Offline</p>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-lg border border-white/10 bg-[#10151f] p-5 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Analyze files</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Documents, images, text, CSV, JSON, and PDFs stay on this laptop.
                </p>
              </div>
              <span className="rounded-md bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                Stored locally
              </span>
            </div>

            <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-600 bg-black/20 px-4 py-6 text-center transition hover:border-cyan-300 hover:bg-cyan-300/5">
              <input
                className="sr-only"
                type="file"
                onChange={chooseFile}
                accept="image/*,.pdf,.txt,.md,.csv,.json,.xml,.html,.log"
              />
              <span className="text-base font-medium text-white">
                {file ? file.name : "Choose a file"}
              </span>
              <span className="mt-2 text-sm text-slate-400">
                {file ? `${file.type || "unknown type"} · ${formatBytes(file.size)}` : "Drop-in simple local analysis"}
              </span>
            </label>

            <textarea
              value={filePrompt}
              onChange={(event) => setFilePrompt(event.target.value)}
              placeholder="Optional focus, for example: summarize risks, extract action items, or describe this image."
              className="mt-4 h-24 w-full resize-none rounded-md border border-white/10 bg-[#080b10] p-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
            />

            <button
              onClick={analyzeFile}
              disabled={!file || uploadLoading}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {uploadLoading ? "Analyzing..." : "Analyze upload"}
            </button>

            <div className="mt-5 min-h-40 rounded-md border border-white/10 bg-black/20 p-4">
              <h3 className="text-sm font-semibold text-slate-200">Latest analysis</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {analysis || "Upload a file and the offline model will summarize it here."}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#10151f] p-5 shadow-2xl shadow-black/30">
            <h2 className="text-xl font-semibold text-white">Ask Ollama</h2>
            <p className="mt-1 text-sm text-slate-400">
              Chat directly with your local model and keep the session in SQLite.
            </p>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask anything..."
              className="mt-5 h-44 w-full resize-none rounded-md border border-white/10 bg-[#080b10] p-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
            />
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={sendMessage}
                disabled={chatLoading || !message.trim()}
                className="inline-flex h-11 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {chatLoading ? "Thinking..." : "Send"}
              </button>
              <span className="text-xs text-slate-500">No cloud calls from this app.</span>
            </div>

            <div className="mt-5 min-h-48 rounded-md border border-white/10 bg-black/20 p-4">
              <h3 className="text-sm font-semibold text-slate-200">AI response</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {reply || "Your next local reply will appear here."}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-[#0d121b] p-5">
            <h2 className="text-lg font-semibold text-white">Recent uploads</h2>
            <div className="mt-4 space-y-3">
              {uploads.length ? (
                uploads.map((item) => (
                  <article key={item.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-white">{item.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.mimeType} · {formatBytes(item.size)} · {shortDate(item.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                      {item.analysis}
                    </p>
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">
                  No uploads yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0d121b] p-5">
            <h2 className="text-lg font-semibold text-white">Chat history</h2>
            <div className="mt-4 space-y-3">
              {chatHistory.length ? (
                chatHistory.map((item) => (
                  <article key={item.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 font-medium text-white">{item.prompt}</h3>
                      <span className="shrink-0 text-xs text-slate-500">{shortDate(item.createdAt)}</span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                      {item.reply}
                    </p>
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">
                  No chats yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
