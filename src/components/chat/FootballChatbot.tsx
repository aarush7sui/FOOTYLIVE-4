'use client';

import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  X,
  Trash2,
  ShieldCheck,
  Zap,
  Sparkles,
  AlertCircle,
  Loader2,
  Trophy,
  Globe,
  ExternalLink,
} from 'lucide-react';

export interface GroundingSource {
  title: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  sources?: GroundingSource[];
  searchQueries?: string[];
}

export interface FootballChatbotHandle {
  ask: (prompt: string) => void;
}

interface FootballChatbotProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeMatchLabel?: string;
  activeMatchContext?: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-footybot',
  role: 'model',
  text: "Welcome to FOOTYBot! I'm your football-only AI analyst connected to live ESPN match telemetry and real-time Google Search. Ask me for today's live scores, upcoming fixtures, standings, transfer news, World Cup 2026 stats, tactics, or rules.",
  timestamp: 'Live Ready',
};

const QUICK_PROMPTS = [
  'What football matches are live or upcoming today?',
  'Check the latest Premier League standings and title race',
  'Latest major European football transfer & injury news',
  'Who won the 2026 FIFA World Cup final and key stats?',
];

function formatMessageText(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();
    const isBullet = /^[-*•]\s+/.test(trimmed);
    const cleanLine = isBullet ? trimmed.replace(/^[-*•]\s+/, '') : line;

    const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g).map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-bold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });

    if (isBullet) {
      return (
        <div key={lineIdx} className="flex items-start gap-2 pl-1 my-0.5">
          <span className="text-[#00ff88] mt-1 text-[10px]">●</span>
          <span>{parts}</span>
        </div>
      );
    }

    if (trimmed === '') {
      return <div key={lineIdx} className="h-2" />;
    }

    return (
      <p key={lineIdx} className="leading-relaxed">
        {parts}
      </p>
    );
  });
}

export const FootballChatbot = forwardRef<FootballChatbotHandle, FootballChatbotProps>(
  function FootballChatbot({ isOpen, onOpenChange, activeMatchLabel, activeMatchContext }, ref) {
    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'hydrogen' | 'lite'>('hydrogen');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const threadEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const msgCounterRef = useRef(0);

    useEffect(() => {
      if (isOpen) {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => inputRef.current?.focus(), 180);
      }
    }, [messages, isOpen, isSending]);

    const sendMessage = async (textOverride?: string) => {
      const trimmed = (textOverride ?? input).trim();
      if (!trimmed || isSending) return;

      setError(null);
      const nowLabel = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      msgCounterRef.current += 1;
      const userMsg: ChatMessage = {
        id: `user-${msgCounterRef.current}`,
        role: 'user',
        text: trimmed,
        timestamp: nowLabel,
      };

      setMessages((prev) => [...prev, userMsg]);
      if (!textOverride) setInput('');
      setIsSending(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            mode,
            activeMatchContext,
            history: messages
              .filter((m) => m.id !== WELCOME_MESSAGE.id)
              .map((m) => ({ role: m.role, text: m.text })),
          }),
        });

        const data = await response.json();

        if (!response.ok || !data?.reply) {
          throw new Error(
            data?.error || `Request failed with status ${response.status}`
          );
        }

        msgCounterRef.current += 1;
        const botMsg: ChatMessage = {
          id: `model-${msgCounterRef.current}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          sources: Array.isArray(data.sources) ? data.sources : undefined,
          searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : undefined,
        };

        setMessages((prev) => [...prev, botMsg]);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to connect to FOOTYBot. Please try again.';
        setError(message);
      } finally {
        setIsSending(false);
      }
    };

    useImperativeHandle(ref, () => ({
      ask: (prompt: string) => {
        onOpenChange(true);
        void sendMessage(prompt);
      },
    }));

    const handleClear = () => {
      setMessages([WELCOME_MESSAGE]);
      setError(null);
    };

    return (
      <>
        {/* Floating Launcher Button */}
        <div className="fixed bottom-20 right-6 z-40 pointer-events-auto">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onOpenChange(!isOpen)}
            className="flex items-center gap-2 rounded-full border border-[#00ff88]/60 bg-[#00ff88] px-4 py-2.5 text-xs font-black text-black shadow-[0_0_24px_rgba(0,255,136,0.4)] hover:bg-[#19ff96] transition-all font-mono"
            title="Ask FOOTYBot (Live Telemetry + Internet Search)"
          >
            <MessageSquare className="h-4 w-4" />
            <span>{isOpen ? 'CLOSE FOOTYBOT' : 'ASK FOOTYBOT AI'}</span>
          </motion.button>
        </div>

        {/* Chat Drawer */}
        <AnimatePresence>
          {isOpen && (
            <motion.aside
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed bottom-32 right-4 sm:right-6 z-50 flex h-[560px] max-h-[78vh] w-[calc(100vw-2rem)] sm:w-[430px] flex-col overflow-hidden rounded-2xl border border-[#283148] bg-[#10131d] shadow-[0_24px_60px_rgba(0,0,0,0.75)]"
              aria-label="FOOTYBot Football-Only AI Chatbot"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#1f2538] bg-[#141824] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88]">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-sm font-black tracking-wide text-white">
                        FOOTY<span className="text-[#00ff88]">BOT</span>
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded bg-[#00ff88]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#00ff88] border border-[#00ff88]/30">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Football Only
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-[#0055FF]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#7ab1ff] border border-[#0055FF]/40">
                        <Globe className="h-2.5 w-2.5" />
                        Live + Web Search
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8b94a5] mt-0.5">
                      {activeMatchLabel
                        ? `Watching: ${activeMatchLabel}`
                        : 'Live ESPN telemetry + Google Search'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleClear}
                    className="rounded-lg p-1.5 text-[#8b94a5] hover:bg-[#1d2334] hover:text-white transition-colors"
                    title="Clear conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="rounded-lg p-1.5 text-[#8b94a5] hover:bg-[#1d2334] hover:text-white transition-colors"
                    title="Close chat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Model Mode Selector Bar */}
              <div className="flex items-center justify-between gap-2 border-b border-[#1b2030] bg-[#0d1018] px-3 py-2 text-[11px]">
                <span className="text-[#8b94a5] font-medium">Mode:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMode('hydrogen')}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors ${
                      mode === 'hydrogen'
                        ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40'
                        : 'text-[#8b94a5] hover:text-white hover:bg-[#171c2b]'
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Live Analyst</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('lite')}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors ${
                      mode === 'lite'
                        ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40'
                        : 'text-[#8b94a5] hover:text-white hover:bg-[#171c2b]'
                    }`}
                  >
                    <Zap className="h-3 w-3" />
                    <span>Quick Search</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Message Thread */}
              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 custom-scrollbar">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs ${
                          isUser
                            ? 'bg-[#00ff88] text-black font-semibold rounded-br-sm'
                            : 'bg-[#171c2b] text-[#e2e7f0] border border-[#242c42] rounded-bl-sm'
                        }`}
                      >
                        {isUser ? (
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        ) : (
                          <div className="space-y-1.5">
                            {formatMessageText(msg.text)}

                            {/* Grounded Internet Sources */}
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-[#252e45] space-y-1.5">
                                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#00ff88]">
                                  <Globe className="h-3 w-3" />
                                  <span>Verified Web Sources</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {msg.sources.map((src, idx) => (
                                    <a
                                      key={`${src.url}-${idx}`}
                                      href={src.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-md border border-[#2d3855] bg-[#101420] px-2 py-0.5 text-[10px] font-medium text-[#9fb2d4] hover:border-[#00ff88]/50 hover:text-[#00ff88] transition-colors max-w-[180px]"
                                    >
                                      <span className="truncate">{src.title}</span>
                                      <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="mt-1 px-1 text-[10px] text-[#647188]">
                        {isUser ? 'You' : 'FOOTYBot'} • {msg.timestamp}
                      </span>
                    </div>
                  );
                })}

                {messages.length === 1 && !isSending && (
                  <div className="pt-1 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#647188]">
                      Ask live matchday or web-search questions
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeMatchLabel && (
                        <button
                          type="button"
                          onClick={() =>
                            void sendMessage(
                              `Give me live telemetry insights, recent form, and team news for ${activeMatchLabel}.`
                            )
                          }
                          className="rounded-lg border border-[#00ff88]/50 bg-[#00ff88]/10 px-2.5 py-1.5 text-left text-[11px] font-semibold text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
                        >
                          Live breakdown: {activeMatchLabel}
                        </button>
                      )}
                      {QUICK_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void sendMessage(prompt)}
                          className="rounded-lg border border-[#252d42] bg-[#141825] px-2.5 py-1.5 text-left text-[11px] text-[#c0c7d5] hover:border-[#00ff88]/50 hover:text-[#00ff88] transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isSending && (
                  <div className="flex items-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-[#242c42] bg-[#171c2b] px-3.5 py-2.5 text-xs text-[#8b94a5]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00ff88]" />
                      <span>Checking live scores &amp; searching the web...</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-[#ff3355]/40 bg-[#ff3355]/10 px-3 py-2 text-xs text-[#ff8da1]">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#ff3355]" />
                    <span>{error}</span>
                  </div>
                )}

                <div ref={threadEndRef} />
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
                className="border-t border-[#1f2538] bg-[#131724] p-3"
              >
                <div className="flex items-center gap-2 rounded-xl border border-[#283148] bg-[#0d1018] px-3 py-1.5 focus-within:border-[#00ff88]">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask live scores, transfers, tactics..."
                    disabled={isSending}
                    className="flex-1 bg-transparent text-xs text-white placeholder-[#647188] outline-none disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isSending}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00ff88] text-black transition-all hover:bg-[#19ff96] disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Send message"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            </motion.aside>
          )}
        </AnimatePresence>
      </>
    );
  }
);
