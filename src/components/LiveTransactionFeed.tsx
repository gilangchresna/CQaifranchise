import React, { useState, useEffect, useRef } from "react";
import { useI18n } from "@/src/i18n/I18nContext";
import { supabase } from "@/src/lib/supabase";
import { cn } from "@/src/lib/utils";
import { RefreshCw, Clock, CheckCircle, XCircle, Loader2, Zap } from "lucide-react";

interface Transaction {
  id: string;
  outlet_id: string;
  outlet_name?: string;
  amount: number;
  currency: string;
  status: "completed" | "pending" | "failed";
  payment_method: string;
  created_at: string;
}

export function LiveTransactionFeed() {
  const { t } = useI18n();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const feedRef = useRef<HTMLDivElement>(null);

  const fetchTransactions = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("sales_transactions")
        .select(`
          id,
          outlet_id,
          amount,
          currency,
          status,
          payment_method,
          created_at,
          outlets:outlet_id (name)
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;

      const formattedData = (data || []).map((t: any) => ({
        ...t,
        outlet_name: t.outlets?.name || "Unknown Outlet",
      }));

      setTransactions(formattedData);
      setLastUpdate(new Date());
      setError(null);
    } catch (err: any) {
      console.error("Error fetching transactions:", err);
      setError(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    // Poll for new transactions every 10 seconds
    const interval = setInterval(() => {
      if (isLive) {
        fetchTransactions();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Scroll to top when new transactions arrive
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [transactions.length]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatAmount = (amount: number, currency: string = "SGD") => {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-50 border-green-100";
      case "pending":
        return "bg-yellow-50 border-yellow-100";
      case "failed":
        return "bg-red-50 border-red-100";
      default:
        return "bg-gray-50 border-gray-100";
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center gap-2", isLive && "text-green-600")}>
            <Zap className="h-4 w-4" />
            <span className="font-medium text-sm">{t.transactions.liveFeed}</span>
          </div>
          {isLive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {t.common.live}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {lastUpdate.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchTransactions}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isLive ? "hover:bg-slate-200" : "bg-blue-100 text-blue-600 hover:bg-blue-200"
            )}
            title={t.common.refresh}
          >
            <RefreshCw className={cn("h-4 w-4", isLive && "animate-spin")} />
          </button>
          <button
            onClick={() => setIsLive(!isLive)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              isLive
                ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            )}
          >
            {isLive ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Transaction List */}
      <div ref={feedRef} className="max-h-96 overflow-y-auto">
        {transactions.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">
            {t.common.noData}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className={cn(
                  "px-4 py-3 flex items-center justify-between transition-colors hover:bg-slate-50",
                  getStatusBg(transaction.status)
                )}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(transaction.status)}
                  <div>
                    <p className="font-medium text-sm text-slate-900">
                      {formatAmount(transaction.amount, transaction.currency)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {transaction.outlet_name} • {transaction.payment_method}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{formatTime(transaction.created_at)}</p>
                  <p className="text-xs font-medium text-slate-600 capitalize">
                    {transaction.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
        <p className="text-xs text-slate-500">
          {transactions.length} {t.transactions.recent.toLowerCase()} • Auto-refresh every 10s
        </p>
      </div>
    </div>
  );
}
