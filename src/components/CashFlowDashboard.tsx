import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, Calendar, RefreshCw } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface CashFlowDashboardProps {
  userId: string;
  refreshTrigger?: number;
}

interface Snapshot {
  id: string;
  snapshot_date: string;
  source_type: string;
  monthly_inflow: number;
  monthly_outflow: number;
  net_cash_flow: number;
  transaction_count: number;
}

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  category: string;
  category_detail: string;
  is_inflow: boolean;
}

export function CashFlowDashboard({ userId, refreshTrigger = 0 }: CashFlowDashboardProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCashFlow();
  }, [userId, refreshTrigger]);

  async function fetchCashFlow() {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch snapshots
      const { data: snapshotData, error: snapshotError } = await supabase
        .from('cash_flow_snapshots')
        .select('*')
        .eq('user_id', userId)
        .order('snapshot_date', { ascending: false })
        .limit(12);
      
      if (snapshotError) throw snapshotError;
      setSnapshots(snapshotData || []);
      
      // Fetch recent transactions
      if (snapshotData && snapshotData.length > 0) {
        const snapshotIds = snapshotData.map(s => s.id);
        const { data: txData, error: txError } = await supabase
          .from('cash_flow_transactions')
          .select('*')
          .in('snapshot_id', snapshotIds)
          .order('transaction_date', { ascending: false })
          .limit(20);
        
        if (txError) throw txError;
        setTransactions(txData || []);
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const latestSnapshot = snapshots[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p>Error loading cash flow: {error}</p>
        <button 
          onClick={fetchCashFlow}
          className="mt-2 text-sm text-red-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Wallet className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p className="font-medium">No cash flow data yet</p>
        <p className="text-sm mt-1">Upload your CSV template to see your cash flow here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Monthly Inflow
          </div>
          <div className="text-2xl font-semibold text-slate-900 mt-2">
            SGD {latestSnapshot?.monthly_inflow?.toLocaleString() || 0}
          </div>
        </div>
        
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <TrendingDown className="w-4 h-4 text-red-600" />
            Monthly Outflow
          </div>
          <div className="text-2xl font-semibold text-slate-900 mt-2">
            SGD {latestSnapshot?.monthly_outflow?.toLocaleString() || 0}
          </div>
        </div>
        
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Wallet className="w-4 h-4 text-blue-600" />
            Net Cash Flow
          </div>
          <div className={`text-2xl font-semibold mt-2 ${(latestSnapshot?.net_cash_flow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            SGD {latestSnapshot?.net_cash_flow?.toLocaleString() || 0}
          </div>
        </div>
        
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="w-4 h-4 text-purple-600" />
            Transactions
          </div>
          <div className="text-2xl font-semibold text-slate-900 mt-2">
            {latestSnapshot?.transaction_count || 0}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Recent Transactions</h3>
          <button 
            onClick={fetchCashFlow}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No transactions yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((tx) => (
                <tr key={tx.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-6 py-3 text-slate-500">
                    {new Date(tx.transaction_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3">
                    {tx.description}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      tx.category === 'INCOME' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {tx.category_detail || tx.category}
                    </span>
                  </td>
                  <td className={`px-6 py-3 text-right font-medium ${
                    tx.is_inflow ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {tx.is_inflow ? '+' : '-'}SGD {Math.abs(tx.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Monthly History */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold">Cash Flow History</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase border-b">
              <th className="px-6 py-3">Month</th>
              <th className="px-6 py-3">Source</th>
              <th className="px-6 py-3 text-right">Inflow</th>
              <th className="px-6 py-3 text-right">Outflow</th>
              <th className="px-6 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0">
                <td className="px-6 py-3">{s.snapshot_date}</td>
                <td className="px-6 py-3 text-slate-500">{s.source_type}</td>
                <td className="px-6 py-3 text-right text-green-600">
                  SGD {s.monthly_inflow?.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-right text-red-600">
                  SGD {s.monthly_outflow?.toLocaleString()}
                </td>
                <td className={`px-6 py-3 text-right font-medium ${
                  s.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  SGD {s.net_cash_flow?.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
