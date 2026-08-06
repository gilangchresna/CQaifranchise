import React, { useState } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Role } from "@/src/types";
import { supabase } from "@/src/lib/supabase";

const EDGE_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
}

export function AICopilot({ activeRole }: { activeRole: Role }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I am your Operational AI Assistant. I can help you analyze outlet performance, suggest staffing optimizations, or investigate stockout risks. What would you like to look into today?",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const roleMap: Record<Role, string> = {
        HQ: "HQ_ADMIN",
        Regional: "REGIONAL_MANAGER",
        Franchisee: "FRANCHISEE_OWNER",
      };

      const response = await fetch(`${EDGE_URL}/athena-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMsg.content,
          context: {
            role: roleMap[activeRole] || "FRANCHISEE_OWNER",
            region_id: session?.user?.user_metadata?.region_id || null,
            outlet_id: session?.user?.user_metadata?.outlet_id || null,
          },
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      const responseText = data.response || "Maaf, saya tidak dapat memproses pertanyaan Anda saat ini.";

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseText,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("AI Copilot error:", err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Terjadi kesalahan koneksi. Silakan coba lagi.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
      <div className="border-b border-slate-200 px-6 py-4 bg-white flex items-center gap-3 z-10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
          <Bot className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900 tracking-wide flex items-center gap-2">
          Assistant
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 z-10 relative">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "flex-row-reverse" : "",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                msg.role === "user"
                  ? "bg-slate-100 text-slate-700 border-slate-200"
                  : "bg-blue-50 text-blue-600 border-blue-100",
              )}
            >
              {msg.role === "user" ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </div>
            <div
              className={cn(
                "rounded-xl px-4 py-3 max-w-[85%] text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-slate-100 border border-slate-200 text-slate-900"
                  : "bg-white border border-slate-200 text-slate-700",
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-blue-50 text-blue-600 border-blue-100">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-xl bg-white border border-slate-200 px-4 py-4 flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              <span className="text-xs text-slate-500">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-4 bg-white z-10 flex flex-col gap-3">
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2">
            {activeRole === "Franchisee" ? (
              <>
                <button
                  onClick={() => setInput("What's causing my sales drop?")}
                  className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors text-left"
                >
                  What's causing my sales drop?
                </button>
                <button
                  onClick={() => setInput("Which items are at risk of stockout?")}
                  className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors text-left"
                >
                  Which items are at risk of stockout?
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setInput("Why is Outlet 104 underperforming?")}
                  className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors text-left"
                >
                  Why is Outlet 104 underperforming?
                </button>
                <button
                  onClick={() => setInput("Identify network-wide stockout risks")}
                  className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors text-left"
                >
                  Identify network-wide stockout risks
                </button>
              </>
            )}
          </div>
        )}
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about anomalies, stockouts..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-4 pr-12 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all shadow-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 transition-all"
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
