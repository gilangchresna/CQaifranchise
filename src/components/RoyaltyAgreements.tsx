import { useState, useMemo, useEffect } from 'react';
import { supabase } from "@/src/lib/supabase";
import {
  FileText, Plus, Calendar, X, Check, AlertCircle,
  ChevronDown, Pencil, Trash2, Clock, Users, DollarSign
} from 'lucide-react';

// Types
interface RoyaltySettings {
  id: string;
  name: string;
  formula_type: string;
}

interface RoyaltyAgreement {
id: string;
franchisee_id: string;
franchisee_name: string;
franchisee_email: string;
formula_type: string;
settings_id: string | null;
effective_from: string;
effective_to: string;
is_active: boolean;
created_at: string;
}

interface Franchisee {
  id: string;
  name: string;
  email: string;
}

const FORMULA_TYPES = [
  { id: 'SIMPLE', name: 'Simple Flat', description: 'Fixed rate for all franchisees (e.g., 6%)' },
  { id: 'PERFORMANCE', name: 'Performance-Based', description: 'Variable rate based on risk score, growth, compliance' },
  { id: 'HYBRID', name: 'Hybrid', description: 'Base rate + performance bonuses' },
];

export default function RoyaltyAgreements() {
  const [agreements, setAgreements] = useState<RoyaltyAgreement[]>([]);
  const [franchisees, setFranchisees] = useState<Franchisee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    franchisee_id: '',
    formula_type: 'PERFORMANCE',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: new Date(new Date().setMonth(new Date().getMonth() + 12)).toISOString().split('T')[0],
  });

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired' | 'upcoming'>('all');

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load agreements with franchisee info
      const { data: agreementsData, error: agreementsError } = await supabase
        .from('royalty_agreements')
        .select(`
          *,
          user_profiles!franchisee_id (
            id,
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (agreementsError) throw agreementsError;

      // Transform data
      const transformedAgreements: RoyaltyAgreement[] = (agreementsData || []).map((a: any) => ({
        id: a.id,
        franchisee_id: a.franchisee_id,
        franchisee_name: a.user_profiles?.full_name || 'Unknown',
        franchisee_email: a.user_profiles?.email || '',
        formula_type: a.formula_type,
        settings_id: a.settings_id,
        effective_from: a.effective_from,
        effective_to: a.effective_to,
        is_active: a.is_active ?? true,
        created_at: a.created_at,
      }));

      setAgreements(transformedAgreements);

      // Load franchisees (users with FRANCHISEE role)
      const { data: franchiseeData, error: franchiseeError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('role', 'FRANCHISEE_OWNER')
        .order('full_name');

      if (franchiseeError) throw franchiseeError;
      setFranchisees(franchiseeData || []);

    } catch (error: any) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load data: ' + error.message });
    } finally {
      setLoading(false);
    }
  }

  // Filter agreements
  const filteredAgreements = useMemo(() => {
    const today = new Date();
    
    return agreements.filter(agreement => {
      const from = new Date(agreement.effective_from);
      const to = new Date(agreement.effective_to);
      
      // Search filter
      const matchesSearch = 
        agreement.franchisee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agreement.franchisee_email.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Status filter
      if (filterStatus === 'active') {
        return today >= from && today <= to;
      } else if (filterStatus === 'expired') {
        return today > to;
      } else if (filterStatus === 'upcoming') {
        return today < from;
      }
      
      return true;
    });
  }, [agreements, searchTerm, filterStatus]);

  // Get agreement status
  function getAgreementStatus(agreement: RoyaltyAgreement) {
    const today = new Date();
    const from = new Date(agreement.effective_from);
    const to = new Date(agreement.effective_to);

    if (today < from) return { status: 'upcoming', label: 'Upcoming', color: 'bg-blue-100 text-blue-800' };
    if (today > to) return { status: 'expired', label: 'Expired', color: 'bg-gray-100 text-gray-600' };
    return { status: 'active', label: 'Active', color: 'bg-green-100 text-green-800' };
  }

  // Get formula name
  function getFormulaName(type: string) {
    const formula = FORMULA_TYPES.find(f => f.id === type);
    return formula?.name || type;
  }

  // Open modal for new/edit
  function openModal(agreement?: RoyaltyAgreement) {
    if (agreement) {
      setEditingId(agreement.id);
      setFormData({
        franchisee_id: agreement.franchisee_id,
        formula_type: agreement.formula_type,
        effective_from: agreement.effective_from,
        effective_to: agreement.effective_to,
      });
    } else {
      setEditingId(null);
      setFormData({
        franchisee_id: '',
        formula_type: 'PERFORMANCE',
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: new Date(new Date().setMonth(new Date().getMonth() + 12)).toISOString().split('T')[0],
      });
    }
    setShowModal(true);
    setMessage(null);
  }

  // Save agreement
  async function saveAgreement() {
    if (!formData.franchisee_id) {
      setMessage({ type: 'error', text: 'Please select a franchisee' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('royalty_agreements')
          .update({
            franchisee_id: formData.franchisee_id,
            formula_type: formData.formula_type,
            effective_from: formData.effective_from,
            effective_to: formData.effective_to,
            is_active: true,
          })
          .eq('id', editingId);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Agreement updated successfully!' });
      } else {
        // Create new
        const { error } = await supabase
          .from('royalty_agreements')
          .insert({
            franchisee_id: formData.franchisee_id,
            formula_type: formData.formula_type,
            effective_from: formData.effective_from,
            effective_to: formData.effective_to,
            is_active: true,
            base_rate: 0.06, // Default 6%
          });

        if (error) throw error;
        setMessage({ type: 'success', text: 'Agreement created successfully!' });
      }

      // Reload data
      await loadData();
      
      // Close modal after short delay
      setTimeout(() => {
        setShowModal(false);
      }, 1500);

    } catch (error: any) {
      console.error('Error saving agreement:', error);
      setMessage({ type: 'error', text: 'Failed to save: ' + error.message });
    } finally {
      setSaving(false);
    }
  }

  // Delete agreement
  async function deleteAgreement(id: string) {
    if (!confirm('Are you sure you want to delete this agreement?')) return;

    try {
      const { error } = await supabase
        .from('royalty_agreements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Agreement deleted successfully!' });
      await loadData();

    } catch (error: any) {
      console.error('Error deleting agreement:', error);
      setMessage({ type: 'error', text: 'Failed to delete: ' + error.message });
    }
  }

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    return {
      total: agreements.length,
      active: agreements.filter(a => {
        const from = new Date(a.effective_from);
        const to = new Date(a.effective_to);
        return today >= from && today <= to;
      }).length,
      upcoming: agreements.filter(a => today < new Date(a.effective_from)).length,
      expired: agreements.filter(a => today > new Date(a.effective_to)).length,
    };
  }, [agreements]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Royalty Agreements</h1>
            <p className="text-gray-500">Manage royalty formula assignments to franchisees</p>
          </div>
          <button
            onClick={() => openModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Agreement
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-500">Total Agreements</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                <p className="text-sm text-gray-500">Active</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.upcoming}</p>
                <p className="text-sm text-gray-500">Upcoming</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.expired}</p>
                <p className="text-sm text-gray-500">Expired</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search franchisee name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'active', 'upcoming', 'expired'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg font-medium capitalize ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Agreements Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Franchisee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Formula Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAgreements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No agreements found</p>
                    <p className="text-sm">Create your first agreement to get started</p>
                  </td>
                </tr>
              ) : (
                filteredAgreements.map((agreement) => {
                  const statusInfo = getAgreementStatus(agreement);
                  return (
                    <tr key={agreement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="ml-4">
                            <p className="font-medium text-gray-900">{agreement.franchisee_name}</p>
                            <p className="text-sm text-gray-500">{agreement.franchisee_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-sm font-medium bg-purple-100 text-purple-800 rounded">
                          {getFormulaName(agreement.formula_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {new Date(agreement.effective_from).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          to {new Date(agreement.effective_to).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openModal(agreement)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteAgreement(agreement.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Agreement' : 'New Agreement'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Franchisee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Franchisee <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.franchisee_id}
                  onChange={(e) => setFormData({ ...formData, franchisee_id: e.target.value })}
                  disabled={!!editingId}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select franchisee...</option>
                  {franchisees.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.full_name} ({f.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Formula Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Formula Type <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {FORMULA_TYPES.map((formula) => (
                    <label
                      key={formula.id}
                      className={`flex p-3 border rounded-lg cursor-pointer transition ${
                        formData.formula_type === formula.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="formula_type"
                        value={formula.id}
                        checked={formData.formula_type === formula.id}
                        onChange={(e) => setFormData({ ...formData, formula_type: e.target.value })}
                        className="mt-1 mr-3"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{formula.name}</p>
                        <p className="text-sm text-gray-500">{formula.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.effective_from}
                    onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.effective_to}
                    onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={saveAgreement}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingId ? 'Update Agreement' : 'Create Agreement'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
