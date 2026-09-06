/**
 * Knowledge Base Admin Component
 * Admin panel for managing SOPs, manuals, incidents, policies
 */

import React, { useState, useEffect } from 'react';
import { Book, FileText, AlertTriangle, Shield, Plus, Search, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface KnowledgeItem {
  id: string;
  title?: string;
  category?: string;
  incident_type?: string;
  policy_type?: string;
  content: string;
  version?: number;
  is_active?: boolean;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

const EDGE_FUNCTIONS_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1';

export default function KnowledgeBaseAdmin() {
  const [activeTab, setActiveTab] = useState<'sops' | 'incidents' | 'policies' | 'embeddings'>('sops');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [stats, setStats] = useState({ sops: 0, incidents: 0, policies: 0, embeddings: 0 });

  const tabs = [
    { id: 'sops', label: 'SOPs', icon: FileText, count: stats.sops },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle, count: stats.incidents },
    { id: 'policies', label: 'Policies', icon: Shield, count: stats.policies },
    { id: 'embeddings', label: 'Embeddings', icon: Book, count: stats.embeddings },
  ];

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [activeTab, pagination.page]);

  const fetchStats = async () => {
    const fetchStat = async (type: string, key: keyof typeof stats) => {
      try {
        const token = await getToken();
        if (!token) { console.warn(`No token for ${type}`); return; }
        const res = await fetch(`${EDGE_FUNCTIONS_URL}/knowledge-list?type=${type}&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data && typeof data.pagination?.total === 'number') {
          setStats(prev => ({ ...prev, [key]: data.pagination.total }));
        }
      } catch (e) { console.error(`${type} stats error:`, e); }
    };
    fetchStat('sops', 'sops');
    fetchStat('incidents', 'incidents');
    fetchStat('policies', 'policies');
    fetchStat('embeddings', 'embeddings');
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      let url = `${EDGE_FUNCTIONS_URL}/knowledge-list?type=${activeTab}&page=${pagination.page}&limit=${pagination.limit}`;
      
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success) {
        setItems(data.items || []);
        setPagination(data.pagination || pagination);
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
    }
    setLoading(false);
  };

  const getToken = async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchItems();
  };

  const getCategoryIcon = (item: KnowledgeItem) => {
    if (item.category) return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{item.category}</span>;
    if (item.incident_type) return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">{item.incident_type}</span>;
    if (item.policy_type) return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{item.policy_type}</span>;
    return null;
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Knowledge Base Admin</h1>
            <p className="text-sm text-slate-500">Manage SOPs, policies, incidents, and AI knowledge</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchStats}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Knowledge
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setPagination(prev => ({ ...prev, page: 1 })); }}
              className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </form>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Items List */}
        {!loading && (
          <div className="space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Book className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No knowledge items found</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 text-blue-600 hover:underline"
                >
                  Add your first item
                </button>
              </div>
            ) : (
              items.map(item => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getCategoryIcon(item)}
                        <span className="text-xs text-slate-400">
                          v{item.version || 1}
                        </span>
                        {item.is_active === false && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            Inactive
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-900">
                        {item.title || item.incident_type || 'Untitled'}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                        {(item.content || item.description || '').substring(0, 300)}
                        {(item.content || item.description || '').length > 300 && '...'}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        Created: {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {/* Delete handler */}}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1">
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.total_pages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddKnowledgeModal
          type={activeTab}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchItems(); fetchStats(); }}
        />
      )}

      {/* Edit Modal */}
      {selectedItem && (
        <EditKnowledgeModal
          item={selectedItem}
          type={activeTab}
          onClose={() => setSelectedItem(null)}
          onSuccess={() => { setSelectedItem(null); fetchItems(); }}
        />
      )}
    </div>
  );
}

// Add Knowledge Modal
function AddKnowledgeModal({ type, onClose, onSuccess }: { type: string; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      await fetch(`${EDGE_FUNCTIONS_URL}/embeddings-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: `${title}\n\n${content}`,
          source_type: type === 'embeddings' ? 'sop' : type.slice(0, -1),
          metadata: { category, title }
        })
      });

      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to add knowledge');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold">Add New {type.slice(0, -1).charAt(0).toUpperCase() + type.slice(1, -1)}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., operations, hr, finance"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg h-48"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Knowledge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Knowledge Modal
function EditKnowledgeModal({ item, type, onClose, onSuccess }: { item: KnowledgeItem; type: string; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState(item.title || '');
  const [category, setCategory] = useState(item.category || item.incident_type || item.policy_type || '');
  const [content, setContent] = useState(item.content);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Implement update logic
    alert('Update feature coming soon');
    setLoading(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold">Edit Knowledge</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg h-48"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
