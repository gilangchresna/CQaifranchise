import React, { useState } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Role } from "@/src/types";

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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response based on typical franchise platform queries
    setTimeout(() => {
      let response = `I've analyzed the data for the ${activeRole} scope. Let me break that down for you.`;
      let toolCalls: string[] = [];
      const lowerInput = newMsg.content.toLowerCase();

      if (
        lowerInput.includes("104") ||
        lowerInput.includes("underperforming") ||
        lowerInput.includes("drop")
      ) {
        if (activeRole === 'Franchisee') {
            response = "Outlet 104 is outside your franchisee scope. You only have access to Outlet 089.";
        } else {
            toolCalls = ["get_outlet_kpi(outlet='104')", "get_inventory_state(outlet='104')", "get_SOP(topic='stockout')"];
            response =
              "Outlet 104 is currently showing an 18% drop in lunchtime sales compared to its 30-day baseline. This correlates strongly with two factors: a critical stockout of chicken items (preventing combo sales) and a staffing shortage of 2 key kitchen members. I recommend immediately transferring stock from Outlet 102 and pausing online delivery to preserve service levels for walk-in customers.";
        }
      } else if (
        lowerInput.includes("stockout") ||
        lowerInput.includes("risk")
      ) {
        if (activeRole === 'Franchisee') {
             toolCalls = ["get_inventory_state(outlet='089')"];
             response = "Your location (Outlet 089) is currently at 90% risk of a stockout for 'Spicy Chicken Wings' within the next 4 hours based on current sales velocity. Recommend triggering an emergency local transfer.";
        } else {
             toolCalls = ["get_network_inventory_risk(region='all')"];
             response =
               "Based on current predictive models, Outlet 104 and Outlet 089 are at severe risk (>90%) of stockouts for core items before evening peak. I have drafted emergency transfer workflows for your approval.";
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
      ]);
      setIsTyping(false);
    }, 1500);
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
                  : "bg-white border border-slate-200 text-slate-700 flex flex-col gap-2",
              )}
            >
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-1">
                  {msg.toolCalls.map((tc, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded w-fit border border-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      Tool: {tc}
                    </div>
                  ))}
                </div>
              )}
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
              <div
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-4 bg-white z-10 flex flex-col gap-3">
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2">
             {activeRole === 'Franchisee' ? (
                <>
                   <button onClick={() => setInput("What's causing my sales drop?")} className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors text-left">What's causing my sales drop?</button>
                   <button onClick={() => setInput("Which items are at risk of stockout?")} className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors text-left">Which items are at risk of stockout?</button>
                </>
             ) : (
                <>
                   <button onClick={() => setInput("Why is Outlet 104 underperforming?")} className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors text-left">Why is Outlet 104 underperforming?</button>
                   <button onClick={() => setInput("Identify network-wide stockout risks")} className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors text-left">Identify network-wide stockout risks</button>
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
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
