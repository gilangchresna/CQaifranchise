/**
 * Peer Benchmarking Dashboard Component
 * Compare outlet performance against peer groups
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Users, Target, Award, AlertTriangle, BarChart3 } from 'lucide-react';
import { supabase, EDGE_FUNCTIONS_URL } from "@/src/lib/supabase";

interface PeerOutlet {
  outlet_id: number;
  outlet_code: string;
  revenue: number;
  peer_avg_revenue: number;
  vs_peer_pct: number;
  rank: number;
  percentile: number;
  staff_productivity: number;
  inventory_turnover: number;
  peer_score: number;
  status: 'top' | 'above_average' | 'average' | 'underperforming';
}

interface Aggregates {
  total_outlets: number;
  avg_revenue: number;
  avg_peer_score: number;
  avg_vs_peer_pct: number;
  top_performers: number;
  underperformers: number;
}

interface PeerBenchmarkData {
  date: string;
  period: string;
  aggregates: Aggregates;
  outlets: PeerOutlet[];
  top_performers: Array<{ outlet_code: string; outlet_name?: string; revenue: number; peer_score: number; vs_peer_pct: number }>;
  underperformers: Array<{ outlet_code: string; outlet_name?: string; revenue: number; vs_peer_pct: number; gap_to_avg: number }>;
}

// EDGE_FUNCTIONS_URL is imported from supabase.ts

// Currency config per region
const REGION_CURRENCY: Record<string, { symbol: string; code: string }> = {
  Singapore: { symbol: 'S$', code: 'SGD' },
  Jakarta:   { symbol: 'Rp',  code: 'IDR' },
  Bandung:    { symbol: 'Rp',  code: 'IDR' },
  Surabaya:   { symbol: 'Rp',  code: 'IDR' },
  Bangkok:   { symbol: '฿',   code: 'THB' },
  'Kuala Lumpur': { symbol: 'RM', code: 'MYR' },
};

function formatRevenue(amount: number, region: string): string {
  const curr = REGION_CURRENCY[region] || REGION_CURRENCY['Singapore'];
  if (curr.code === 'IDR') {
    // Abbreviated: Rp 1.25jt
    const jt = amount / 1_000_000;
    return `Rp ${jt.toFixed(2)}jt`;
  }
  return `${curr.symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function PeerBenchmark() {
  const [data, setData] = useState<PeerBenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPeerData();
  }, [selectedRegion, selectedType]);

  const fetchPeerData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      const params = new URLSearchParams();
      if (selectedRegion !== 'all') params.append('region', selectedRegion);
      if (selectedType !== 'all') params.append('type', selectedType);
      
      const response = await fetch(
        `${EDGE_FUNCTIONS_URL}/peer-benchmark?${params.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch peer data');
      
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Peer benchmark error:', err);
      setError(err.message);
      // Use mock data for demo
      setData(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'top': return 'bg-green-100 text-green-800 border-green-200';
      case 'above_average': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'average': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'underperforming': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'top': return '🏆 Top Performer';
      case 'above_average': return '📈 Above Avg';
      case 'average': return '➡️ Average';
      case 'underperforming': return '⚠️ Underperforming';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Using demo data (API unavailable)</p>
      </div>
    );
  }

  const mockData = getMockData();
  const displayData = data || mockData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Peer Benchmarking</h1>
          <p className="text-gray-500 text-sm">Compare outlet performance against similar outlets</p>
        </div>
        
        {/* Filters */}
        <div className="flex gap-3">
          <select 
            className="px-3 py-2 border rounded-lg text-sm"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            <option value="all">All Regions</option>
            <option value="Singapore">Singapore (S$)</option>
            <option value="Jakarta">Jakarta (Rp)</option>
            <option value="Bandung">Bandung (Rp)</option>
            <option value="Surabaya">Surabaya (Rp)</option>
            <option value="Bangkok">Bangkok (฿)</option>
            <option value="Kuala Lumpur">Kuala Lumpur (RM)</option>
          </select>
          
          <select 
            className="px-3 py-2 border rounded-lg text-sm"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
          
          <button 
            onClick={fetchPeerData}
            className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 flex items-center gap-2"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Users className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Outlets</p>
              <p className="text-2xl font-bold">{displayData.aggregates.total_outlets}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Target className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Revenue</p>
              <p className="text-2xl font-bold">{formatRevenue(displayData.aggregates.avg_revenue, selectedRegion)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Peer Score</p>
              <p className="text-2xl font-bold">{displayData.aggregates.avg_peer_score}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${displayData.aggregates.avg_vs_peer_pct >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {displayData.aggregates.avg_vs_peer_pct >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">vs Peer Avg</p>
              <p className={`text-2xl font-bold ${displayData.aggregates.avg_vs_peer_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {displayData.aggregates.avg_vs_peer_pct >= 0 ? '+' : ''}{displayData.aggregates.avg_vs_peer_pct.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top vs Underperformers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-6 h-6 text-green-600" />
            <h2 className="text-lg font-semibold text-green-800">Top Performers</h2>
          </div>
          
          {displayData.top_performers.length > 0 ? (
            <div className="space-y-3">
              {displayData.top_performers.map((outlet, idx) => (
                <div key={idx} className="bg-white/70 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{outlet.outlet_name || outlet.outlet_code}</span>
                    <span className="text-green-600 font-bold">+{Number(outlet.vs_peer_pct).toFixed(1)}%</span>
                  </div>
                  <p className="text-sm text-gray-600">Revenue: {formatRevenue(outlet.revenue, selectedRegion)} | Score: {outlet.peer_score}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-700">No top performers this period</p>
          )}
        </div>

        {/* Underperformers */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-lg font-semibold text-red-800">Needs Attention</h2>
          </div>
          
          {displayData.underperformers.length > 0 ? (
            <div className="space-y-3">
              {displayData.underperformers.map((outlet, idx) => (
                <div key={idx} className="bg-white/70 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{outlet.outlet_name || outlet.outlet_code}</span>
                    <span className="text-red-600 font-bold">{Number(outlet.vs_peer_pct).toFixed(1)}%</span>
                  </div>
                  <p className="text-sm text-gray-600">Gap: {formatRevenue(Math.abs(outlet.gap_to_avg), selectedRegion)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-700">All outlets performing well!</p>
          )}
        </div>
      </div>

      {/* Outlet Comparison Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Outlet Comparison</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outlet</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">vs Peer Avg</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outlet Name</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Productivity</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayData.outlets
                .sort((a, b) => (b.peer_score || 0) - (a.peer_score || 0))
                .map((outlet) => (
                <tr key={outlet.outlet_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mr-3 ${
                        outlet.status === 'top' ? 'bg-green-500' :
                        outlet.status === 'underperforming' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`}>
                        {outlet.rank || '?'}
                      </div>
                      <div>
                        <div className="font-medium">{outlet.outlet_code}</div>
                        <div className="text-xs text-gray-400">{outlet.outlet_name || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {formatRevenue(outlet.revenue || 0, selectedRegion)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={outlet.vs_peer_pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {outlet.vs_peer_pct >= 0 ? '+' : ''}{Number(outlet.vs_peer_pct).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    #{outlet.rank || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {outlet.outlet_name || outlet.outlet_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    ${outlet.staff_productivity?.toFixed(0) || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(outlet.status)}`}>
                      {getStatusLabel(outlet.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Mock data for demo
function getMockData(): PeerBenchmarkData {
  return {
    date: new Date().toISOString().split('T')[0],
    period: 'daily',
    aggregates: {
      total_outlets: 8,
      avg_revenue: 2332.69,
      avg_peer_score: 73.4,
      avg_vs_peer_pct: 0.5,
      top_performers: 2,
      underperformers: 3,
    },
    outlets: [
      { outlet_id: 7, outlet_code: 'BKK-007', revenue: 3420, peer_avg_revenue: 2890, vs_peer_pct: 18.3, rank: 1, percentile: 95, staff_productivity: 285, inventory_turnover: 3.8, peer_score: 92.1, status: 'top' },
      { outlet_id: 3, outlet_code: 'SAP-003', revenue: 3156, peer_avg_revenue: 2890, vs_peer_pct: 9.2, rank: 2, percentile: 88, staff_productivity: 210.4, inventory_turnover: 3.5, peer_score: 88.7, status: 'top' },
      { outlet_id: 1, outlet_code: 'WKN-001', revenue: 2847.5, peer_avg_revenue: 2342, vs_peer_pct: 21.6, rank: 1, percentile: 85.5, staff_productivity: 355.94, inventory_turnover: 4.2, peer_score: 82.3, status: 'above_average' },
      { outlet_id: 6, outlet_code: 'SBY-006', revenue: 2156, peer_avg_revenue: 1900, vs_peer_pct: 13.5, rank: 1, percentile: 88, staff_productivity: 308, inventory_turnover: 4, peer_score: 79.5, status: 'above_average' },
      { outlet_id: 8, outlet_code: 'KUL-008', revenue: 2280, peer_avg_revenue: 2342, vs_peer_pct: -2.6, rank: 3, percentile: 55, staff_productivity: 253.33, inventory_turnover: 3.3, peer_score: 62.4, status: 'average' },
      { outlet_id: 2, outlet_code: 'MYB-002', revenue: 1923, peer_avg_revenue: 2342, vs_peer_pct: -17.9, rank: 4, percentile: 42, staff_productivity: 384.6, inventory_turnover: 3.8, peer_score: 68.5, status: 'underperforming' },
      { outlet_id: 4, outlet_code: 'JKT-004', revenue: 1445, peer_avg_revenue: 1680, vs_peer_pct: -14.0, rank: 2, percentile: 35, staff_productivity: 240.83, inventory_turnover: 3, peer_score: 58.2, status: 'underperforming' },
      { outlet_id: 5, outlet_code: 'BDG-005', revenue: 1234, peer_avg_revenue: 1680, vs_peer_pct: -26.5, rank: 4, percentile: 22, staff_productivity: 308.5, inventory_turnover: 4.5, peer_score: 55.8, status: 'underperforming' },
    ],
    top_performers: [
      { outlet_code: 'BKK-007', outlet_name: 'Mookata Woodlands', revenue: 3420, peer_score: 92.1, vs_peer_pct: 18.3 },
      { outlet_code: 'SAP-003', outlet_name: 'SAP Singapore Premium', revenue: 3156, peer_score: 88.7, vs_peer_pct: 9.2 },
    ],
    underperformers: [
      { outlet_code: 'MYB-002', outlet_name: 'MYB Singapore Standard', revenue: 1923, vs_peer_pct: -17.9, gap_to_avg: 419 },
      { outlet_code: 'JKT-004', outlet_name: 'JKT-004 Jakarta Mall', revenue: 1445, vs_peer_pct: -14.0, gap_to_avg: 235 },
      { outlet_code: 'BDG-005', outlet_name: 'BDG-005 Bandung Central', revenue: 1234, vs_peer_pct: -26.5, gap_to_avg: 446 },
    ],
  };
}

export default PeerBenchmark;
