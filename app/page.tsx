"use client";

import { ChangeEvent, KeyboardEvent, useRef, useState } from "react";

type ChatMessage = {
  id: number;
  prompt: string;
  reply: string;
  createdAt: string;
};

type UploadedFile = {
  name: string;
  mimeType: string;
  size: number;
  analysis: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function cleanAnswer(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceBaseRef = useRef("");
  const voiceTranscriptRef = useRef("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lastFile, setLastFile] = useState<UploadedFile | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = Boolean(message.trim() || file) && !loading;

  function resetFileInput() {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function startNewChat() {
    setMessage("");
    setReply("");
    setError("");
    setLastFile(null);
    setListening(false);
    recognitionRef.current?.stop();
    resetFileInput();
  }

  async function togglePreviousChats() {
    const nextState = !showHistory;
    setShowHistory(nextState);

    if (!nextState || chatHistory.length) return;

    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      setChatHistory(data.messages || []);
    } catch {
      setError("Could not load previous chats.");
    }
  }

  function openPreviousChat(item: ChatMessage) {
    setReply(item.reply);
    setMessage("");
    setError("");
    setLastFile(null);
    resetFileInput();
    setShowHistory(false);
  }

  async function askLuna() {
    if (!canSubmit) return;

    const currentMessage = message.trim();
    setLoading(true);
    setError("");
    setReply("");

    try {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("prompt", currentMessage || "Summarize this file.");

        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Upload failed.");
        }

        setReply(uploadData.upload.analysis);
        setLastFile({
          name: uploadData.upload.name,
          mimeType: uploadData.upload.mimeType,
          size: uploadData.upload.size,
          analysis: uploadData.upload.analysis,
        });
      } else {
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: currentMessage,
          }),
        });
        const chatData = await chatRes.json();

        if (!chatRes.ok) {
          throw new Error(chatData.reply || "Chat failed.");
        }

        setReply(chatData.reply);
        setLastFile(null);
      }

      setMessage("");
      resetFileInput();
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

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void askLuna();
    }
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setError("Speech transcription is not supported in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    voiceBaseRef.current = message.trim();
    voiceTranscriptRef.current = "";

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;

        if (event.results[index].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript.trim()) {
        voiceTranscriptRef.current = finalTranscript.trim();
      }

      const liveTranscript = (interimTranscript || voiceTranscriptRef.current).trim();
      const base = voiceBaseRef.current;
      setMessage(base && liveTranscript ? `${base} ${liveTranscript}` : base || liveTranscript);
    };

    recognition.onerror = () => {
      setError("Could not transcribe your voice. Check microphone permission.");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setError("");
    setListening(true);
    recognition.start();
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f7fb] text-[#101116]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(138,180,255,0.62),transparent_34%),radial-gradient(circle_at_80%_8%,rgba(255,172,217,0.55),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eef1f7_46%,#e8edf6_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-28 bg-white/30 backdrop-blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6">
        <header className="relative flex items-center justify-center">
          <nav className="flex w-full max-w-3xl items-center justify-between rounded-full border border-white/70 bg-white/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_50px_rgba(80,96,130,0.16)] backdrop-blur-3xl">
            <div className="flex min-w-0 items-center gap-3">
            <div className="jim-nightshade-regular flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/55 text-3xl text-[#22242d] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_30px_rgba(90,105,130,0.18)] backdrop-blur-2xl">
              L
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-normal">Luna</h1>
              <p className="truncate text-xs text-[#687083]">Private offline AI</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={startNewChat}
              className="h-10 rounded-full border border-white/70 bg-white/55 px-4 text-sm font-semibold text-[#20232c] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl transition hover:bg-white/75"
            >
              New Chat
            </button>
            <button
              type="button"
              onClick={togglePreviousChats}
              className="h-10 rounded-full border border-white/70 bg-white/55 px-4 text-sm font-semibold text-[#20232c] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl transition hover:bg-white/75"
            >
              Previous Chat
            </button>
          </div>
          </nav>

          {showHistory ? (
            <div className="absolute right-0 top-20 z-20 w-full max-w-md rounded-[28px] border border-white/70 bg-white/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_24px_70px_rgba(64,76,106,0.22)] backdrop-blur-3xl sm:right-2">
              <div className="mb-2 flex items-center justify-between px-2">
                <h2 className="text-sm font-semibold text-[#252936]">Previous chats</h2>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="h-8 w-8 rounded-full bg-white/55 text-sm font-semibold text-[#687083] transition hover:bg-white"
                  aria-label="Close previous chats"
                >
                  x
                </button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {chatHistory.length ? (
                  chatHistory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openPreviousChat(item)}
                      className="w-full rounded-2xl border border-white/70 bg-white/45 px-4 py-3 text-left transition hover:bg-white/75"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-semibold text-[#252936]">{item.prompt}</p>
                        <span className="shrink-0 text-[11px] text-[#7d8494]">{shortDate(item.createdAt)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#687083]">{cleanAnswer(item.reply)}</p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-white/70 bg-white/45 px-4 py-3 text-sm text-[#687083]">
                    No previous chats yet.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </header>

        <section className="flex flex-1 flex-col items-center justify-center pb-8 pt-8">
          <div className="w-full max-w-3xl text-center">
            <p className="jim-nightshade-regular text-5xl text-[#232631] sm:text-6xl">Meet Luna</p>
          </div>

          <div className="mt-6 w-full max-w-3xl rounded-[30px] border border-white/70 bg-white/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_28px_80px_rgba(62,72,102,0.20)] backdrop-blur-3xl">
            {file ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold text-[#262936]">{file.name}</p>
                  <p className="text-xs text-[#757d8f]">
                    {file.type || "unknown type"} · {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetFileInput}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef1f7] text-sm font-semibold text-[#656d7f] transition hover:bg-white"
                  aria-label="Remove file"
                >
                  x
                </button>
              </div>
            ) : null}

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Luna..."
              className="min-h-20 w-full resize-none rounded-[24px] border border-transparent bg-white/10 px-5 py-4 text-base leading-7 text-[#171923] outline-none placeholder:text-[#8a91a1] focus:border-white/80"
            />

            <div className="flex flex-col gap-3 border-t border-white/65 px-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
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
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-white/80 bg-white/55 px-4 text-sm font-semibold text-[#252936] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:bg-white/75"
                >
                  <span className="text-lg leading-none">+</span>
                  Attach
                </button>
                <button
                  type="button"
                  onClick={toggleListening}
                  aria-label={listening ? "Stop voice input" : "Start voice input"}
                  title={listening ? "Stop voice input" : "Start voice input"}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/80 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition ${
                    listening
                      ? "bg-[#11131a] text-white"
                      : "bg-white/55 text-[#252936] hover:bg-white/75"
                  }`}
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  >
                    {listening ? (
                      <rect x="8" y="8" width="8" height="8" rx="1.5" />
                    ) : (
                      <>
                        <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <path d="M12 19v3" />
                      </>
                    )}
                  </svg>
                </button>
                <span className="text-xs text-[#82899a]">optional, used for one reply</span>
              </div>

              <button
                type="button"
                onClick={askLuna}
                disabled={!canSubmit}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#11131a] px-6 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,19,28,0.22)] transition hover:bg-[#252936] disabled:cursor-not-allowed disabled:bg-[#c9cfdb] disabled:text-white/80"
              >
                {loading ? "Thinking..." : "Send"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 w-full max-w-3xl rounded-3xl border border-red-200/80 bg-red-50/80 px-5 py-4 text-sm text-red-700 shadow-[0_18px_40px_rgba(180,40,40,0.12)] backdrop-blur-2xl">
              {error}
            </div>
          ) : null}

          {reply ? (
            <section className="mt-6 w-full max-w-3xl rounded-[30px] border border-white/70 bg-white/50 p-6 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_70px_rgba(62,72,102,0.16)] backdrop-blur-3xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#222532]">Luna</h3>
                  {lastFile ? (
                    <p className="mt-1 text-xs text-[#778092]">
                      answered from {lastFile.name} · {formatBytes(lastFile.size)}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full bg-white/55 px-3 py-1 text-xs font-medium text-[#747c8e]">
                  local
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[15px] leading-8 text-[#2b2f3c]">{cleanAnswer(reply)}</p>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
