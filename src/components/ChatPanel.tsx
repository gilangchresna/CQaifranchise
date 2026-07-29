import React, { useState, useRef, useEffect } from "react";
import { 
  Send, Bot, User, Sparkles, X, Minimize2, Maximize2,
  RefreshCw, MessageSquare, Clock, ChevronDown, Copy, Check
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { supabase } from "@/src/lib/supabase";

const EDGE_URL = 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

const quickPrompts = [
  "What are the current alerts?",
  "Show me outlet performance",
  "Create a case for low stock",
  "Summarize today's activity",
  "Which outlets need attention?",
  "Generate daily report",
];

const sampleResponses: Record<string, string> = {
  "what are the current alerts?": `📊 **Current Alerts Summary**

**Active Alerts:** 4
- 2x Stock Risk (WKN-001, MYB-002)
- 1x Sales Drop (SAP-003)
- 1x Staff Absent (JKT-004)

**Priority:**
🔴 1 Critical (Stock)
🟠 1 High (Sales)
🟡 2 Medium (Staff)

Would you like me to create cases for any of these?`,
  
  "show me outlet performance": `📈 **Outlet Performance Overview**

| Outlet | Revenue Today | vs Avg | Status |
|--------|-------------|--------|--------|
| WKN-001 | S$2,847 | +12% | 🟢 Good |
| MYB-002 | S$1,923 | -8% | 🟡 Watch |
| SAP-003 | S$3,156 | +5% | 🟢 Good |
| JKT-004 | S$1,445 | -15% | 🔴 Alert |

**Recommendation:** Investigate MYB-002 and JKT-004 for sales drop causes.`,

  "which outlets need attention?": `⚠️ **Outlets Requiring Attention**

**🔴 Critical (Immediate Action):**
1. **WKN-001** — Stock risk 78% (3 items critical)
2. **MYB-002** — Sales dropped 32% vs yesterday

**🟠 High (Today):**
3. **SAP-003** — Staff absent, understaffed
4. **JKT-004** — Equipment maintenance overdue

**Recommendation:** Create cases for WKN-001 and MYB-002 first.`,

  "summarize today's activity": `📋 **Today's Activity Summary**

**Transactions:** 1,247 (↑ 8% from avg)
**Revenue:** S$47,823 (↑ 5% from avg)
**Active Alerts:** 4 (↑ 2 new)
**Cases Created:** 2
**Cases Resolved:** 1

**Top Insights:**
💡 Peak hours shifted to 12:00-14:00
💡 WKN-001 approaching stockout threshold
💡 Weekend sales trend improving

Would you like a detailed report?`,
};

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add welcome message
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `👋 **Hello! I'm Athena, your CyberQuote AI assistant.**

I can help you with:
- 📊 **Outlet Performance** — Sales, trends, comparisons
- ⚠️ **Alerts & Cases** — Create, manage, resolve
- 📈 **ML Insights** — Stockout risks, anomaly detection
- 📋 **Reports** — Daily summaries, custom analysis

What would you like to know?`,
        timestamp: new Date(),
        suggestions: quickPrompts.slice(0, 3),
      }]);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (message?: string) => {
    const text = message || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      // Call real Athena Chat API
      const response = await fetch(`${EDGE_URL}/athena-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          context: {
            user_id: session?.user?.id,
            role: session?.user?.user_metadata?.role || 'FRANCHISEE_OWNER',
            region_id: session?.user?.user_metadata?.region_id || null,
            outlet_id: session?.user?.user_metadata?.outlet_id || null,
            franchisee_id: session?.user?.user_metadata?.franchisee_id || null,
          },
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
        })
      });

      let responseText: string;
      let sources: string[] = [];

      if (response.ok) {
        const data = await response.json();
        responseText = data.response || 'I apologize, but I could not generate a response.';
        sources = data.sources || [];
      } else {
        // Fallback to sample responses
        const lowerMsg = text.toLowerCase();
        responseText = sampleResponses[lowerMsg];
        
        if (!responseText) {
          for (const [key, value] of Object.entries(sampleResponses)) {
            if (lowerMsg.includes(key) || key.includes(lowerMsg.split(' ')[0])) {
              responseText = value;
              break;
            }
          }
        }
        
        if (!responseText) {
          responseText = `I understand you're asking about: **"${text}"**

I'm analyzing this request...

**Quick Actions:**
1. 📊 Check outlet performance
2. ⚠️ View active alerts
3. 📋 Generate report

For detailed answers, please ensure you're logged in.`;
        }
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
        suggestions: quickPrompts.slice(0, 3),
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-linear-to-br from-violet-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-50"
      >
        <Bot className="w-7 h-7" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></span>
      </button>
    );
  }

  return (
    <div className={cn(
      "fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden transition-all",
      isMinimized ? "h-16" : "h-150"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-violet-500 to-purple-600 text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold">Athena AI</h3>
            <p className="text-xs text-white/70">Powered by Claude</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn(
                "flex gap-3",
                msg.role === "user" && "flex-row-reverse"
              )}>
                {/* Avatar */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.role === "assistant" 
                    ? "bg-linear-to-br from-violet-500 to-purple-600 text-white"
                    : "bg-slate-200 text-slate-600"
                )}>
                  {msg.role === "assistant" ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>

                {/* Content */}
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3",
                  msg.role === "assistant"
                    ? "bg-slate-100 text-slate-800"
                    : "bg-violet-600 text-white"
                )}>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content.split('\n').map((line, i) => {
                      // Handle markdown-style formatting
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
                      }
                      if (line.startsWith('|')) {
                        // Simple table handling
                        return <p key={i} className="font-mono text-xs my-1">{line}</p>;
                      }
                      if (line.startsWith('💡') || line.startsWith('📊') || line.startsWith('⚠️') || line.startsWith('📋') || line.startsWith('🔴') || line.startsWith('🟠') || line.startsWith('🟢') || line.startsWith('🟡')) {
                        return <p key={i} className="my-1">{line}</p>;
                      }
                      return <span key={i}>{line}{'\n'}</span>;
                    })}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
                    <span className="text-[10px] opacity-50">
                      {formatTime(msg.timestamp)}
                    </span>
                    <button
                      onClick={() => copyMessage(msg.id, msg.content)}
                      className="p-1 hover:bg-black/5 rounded transition-colors"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="bg-slate-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Athena is thinking...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
            <div className="px-4 pb-2">
              <p className="text-xs text-slate-400 mb-2">Quick actions:</p>
              <div className="flex flex-wrap gap-2">
                {messages[messages.length - 1].suggestions?.slice(0, 3).map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(suggestion)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs text-slate-600 transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-slate-200 shrink-0">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask Athena anything..."
                  className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  rows={1}
                />
              </div>
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0",
                  input.trim() && !isLoading
                    ? "bg-linear-to-br from-violet-500 to-purple-600 text-white hover:shadow-lg"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </>
      )}
    </div>
  );
}
