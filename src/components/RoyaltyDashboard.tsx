import { useState, useEffect } from 'react';
import { useSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, 
  CheckCircle, Clock, Users, BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

interface RoyaltyCalculation {
  id: string;
  franchisee_id: string;
  period_month: string;
  gross_revenue: number;
  effective_rate: number;
  royalty_amount: number;
  flat_royalty_amount: number;
  savings_vs_flat: number;
  risk_score: number;
  risk_band: string;
  status: string;
  breakdown_summary: string;
}

interface PortfolioSummary {
  total_franchisees: number;
  total_royalty_expected: number;
  total_paid: number;
  total_overdue: number;
  collection_rate: number;
  by_status: Record<string, { count: number; amount: number }>;
  by_rate_band: Record<string, { count: number; amount: number }>;
}

export default function RoyaltyDashboard() {
  const { supabase, user } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [calculations, setCalculations] = useState<RoyaltyCalculation[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  async function fetchData() {
    setLoading(true);
    
    // Fetch calculations for the selected period
    const periodStart = `${selectedPeriod}-01`;
    const periodEnd = `${selectedPeriod}-${new Date(
      parseInt(selectedPeriod.split('-')[0]),
      parseInt(selectedPeriod.split('-')[1]),
      0
    ).getDate()}`;

    const { data: calcs } = await supabase
      .from('royalty_calculations')
      .select('*, users(full_name, email)')
      .gte('period_month', periodStart)
      .lte('period_month', periodEnd)
      .order('royalty_amount', { ascending: false });

    setCalculations(calcs || []);

    // Fetch portfolio summary
    const { data: summaryData } = await supabase
      .from('royalty_calculations')
      .select(`
        status,
        royalty_amount,
        effective_rate,
        franchisee_id
      `)
      .gte('period_month', periodStart)
      .lte('period_month', periodEnd);

    if (summaryData) {
      const summary = calculateSummary(summaryData);
      setSummary(summary);
    }

    setLoading(false);
  }

  function calculateSummary(data: any[]): PortfolioSummary {
    const summary: PortfolioSummary = {
      total_franchisees: new Set(data.map(d => d.franchisee_id)).size,
      total_royalty_expected: data.reduce((sum, d) => sum + (d.royalty_amount || 0), 0),
      total_paid: data.filter(d => d.status === 'PAID').reduce((sum, d) => sum + (d.royalty_amount || 0), 0),
      total_overdue: data.filter(d => d.status === 'OVERDUE').reduce((sum, d) => sum + (d.royalty_amount || 0), 0),
      collection_rate: 0,
      by_status: {},
      by_rate_band: {},
    };

    summary.collection_rate = summary.total_royalty_expected > 0
      ? Math.round((summary.total_paid / summary.total_royalty_expected) * 100)
      : 0;

    // Group by status
    data.forEach(d => {
      if (!summary.by_status[d.status]) {
        summary.by_status[d.status] = { count: 0, amount: 0 };
      }
      summary.by_status[d.status].count++;
      summary.by_status[d.status].amount += d.royalty_amount || 0;
    });

    // Group by rate band
    data.forEach(d => {
      const band = getRateBand(d.effective_rate);
      if (!summary.by_rate_band[band]) {
        summary.by_rate_band[band] = { count: 0, amount: 0 };
      }
      summary.by_rate_band[band].count++;
      summary.by_rate_band[band].amount += d.royalty_amount || 0;
    });

    return summary;
  }

  function getRateBand(rate: number): string {
    if (rate <= 0.042) return 'Excellent (≤4.2%)';
    if (rate <= 0.051) return 'Good (4.3-5.1%)';
    if (rate <= 0.060) return 'Average (5.2-6.0%)';
    if (rate <= 0.078) return 'Below Avg (6.1-7.8%)';
    if (rate <= 0.100) return 'Struggling (7.9-10%)';
    return 'Watchlist (>10%)';
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function getRiskBadgeColor(band: string): string {
    switch (band?.toLowerCase()) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'average': return 'bg-yellow-100 text-yellow-800';
      case 'below average': return 'bg-orange-100 text-orange-800';
      case 'struggling': return 'bg-red-100 text-red-800';
      case 'watchlist': return 'bg-red-200 text-red-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Royalty Dashboard</h1>
          <p className="text-gray-500">Performance-based royalty management</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const date = new Date();
              date.setMonth(date.getMonth() - i);
              const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
              return <option key={value} value={value}>{label}</option>;
            })}
          </select>
          <Button onClick={fetchData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Royalty</p>
                <p className="text-2xl font-bold">{formatCurrency(summary?.total_royalty_expected || 0)}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{summary?.total_franchisees || 0} franchisees</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-gray-500">Collection Rate</p>
                <p className="text-2xl font-bold">{summary?.collection_rate || 0}%</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${summary?.collection_rate || 0}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-gray-500">Collected</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary?.total_paid || 0)}
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-gray-500">Overdue</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary?.total_overdue || 0)}
                </p>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {summary?.by_status['OVERDUE']?.count || 0} overdue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rate Band Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Royalty Rate Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(summary?.by_rate_band || {}).map(([band, data]) => (
                <div key={band} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{band}</span>
                      <span className="text-gray-500">{data.count} outlets</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          band.includes('Excellent') || band.includes('Good') ? 'bg-green-500' :
                          band.includes('Average') ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${(data.count / (summary?.total_franchisees || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="ml-4 text-sm font-medium w-24 text-right">
                    {formatCurrency(data.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {calculations
                .filter(c => c.effective_rate < 0.06)
                .slice(0, 5)
                .map((calc, i) => (
                  <div key={calc.id} className="flex items-center justify-between p-2 rounded-lg bg-green-50">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-green-600">#{i + 1}</span>
                      <div>
                        <p className="font-medium">{(calc as any).users?.full_name || 'Franchisee'}</p>
                        <p className="text-sm text-gray-500">
                          Score: {calc.risk_score} • Rate: {(calc.effective_rate * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        -{formatCurrency(calc.savings_vs_flat)}
                      </p>
                      <p className="text-xs text-gray-500">vs flat 6%</p>
                    </div>
                  </div>
                ))}
              {calculations.filter(c => c.effective_rate < 0.06).length === 0 && (
                <p className="text-gray-500 text-center py-4">No top performers this period</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Calculations Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Royalty Calculations - {selectedPeriod}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Franchisee</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Revenue</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Score</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Eff. Rate</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Royalty</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">vs Flat</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {calculations.map((calc) => (
                  <tr key={calc.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium">{(calc as any).users?.full_name || calc.franchisee_id}</p>
                      <p className="text-sm text-gray-500">{(calc as any).users?.email}</p>
                    </td>
                    <td className="py-3 px-4 text-right">{formatCurrency(calc.gross_revenue)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`px-2 py-1 rounded text-sm ${getRiskBadgeColor(calc.risk_band || '')}`}>
                        {calc.risk_score || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {(calc.effective_rate * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      {formatCurrency(calc.royalty_amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`flex items-center justify-end gap-1 ${
                        calc.savings_vs_flat > 0 ? 'text-green-600' : 
                        calc.savings_vs_flat < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {calc.savings_vs_flat > 0 ? (
                          <ArrowDownRight className="h-4 w-4" />
                        ) : calc.savings_vs_flat < 0 ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : null}
                        {calc.savings_vs_flat > 0 ? '-' : ''}{formatCurrency(Math.abs(calc.savings_vs_flat))}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={
                        calc.status === 'PAID' ? 'success' :
                        calc.status === 'OVERDUE' ? 'danger' :
                        calc.status === 'INVOICED' ? 'warning' : 'default'
                      }>
                        {calc.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {calculations.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No royalty calculations for this period</p>
                <p className="text-sm">Run the royalty calculator to generate calculations</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
