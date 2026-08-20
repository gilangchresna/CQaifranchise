import React, { useEffect, useState } from 'react';
import { DocumentUpload } from './DocumentUpload';
import { HQDocumentUpload } from './HQDocumentUpload';
import { FilingLinksEdit } from './FilingLinksEdit';
import { Trash2, X, AlertCircle, CheckCircle, Upload, Users, Globe } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { Role } from '@/src/types';

/**
 * DocumentVault Component
 * Wraps DocumentUpload with enhanced vault experience
 */
interface Document {
  id: string;
  file_name: string;
  document_type: string;
  created_at: string;
  file_path: string;
}

export function DocumentVault({ activeRole }: { activeRole?: Role }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // HQ mode for uploading regulatory docs for franchisees
  const [hqMode, setHqMode] = useState(false);
  const [selectedFranchisee, setSelectedFranchisee] = useState<{id: string; name: string; country: string} | null>(null);
  const [franchisees, setFranchisees] = useState<any[]>([]);
  const [loadingFranchisees, setLoadingFranchisees] = useState(false);

  // Get current user ID
  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await import('@/src/lib/supabase').then(m => m.supabase.auth.getSession());
      if (session?.user?.id) {
        setUserId(session.user.id);
        fetchDocuments(session.user.id);
      }
    }
    getUser();
  }, []);

  // Fetch documents
  async function fetchDocuments(uid: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, document_type, created_at, file_path')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }

  // Fetch franchisees for HQ mode
  async function fetchFranchisees() {
    setLoadingFranchisees(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, region_id')
        .eq('role', 'FRANCHISEE_OWNER')
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      
      // Map region_id to country
      const withCountry = (data || []).map((f: any) => {
        const sgRegions = [1, 114];
        const idRegions = [2, 115, 116, 117];
        let country = 'SGP';
        if (idRegions.includes(f.region_id)) country = 'IDN';
        return { ...f, country };
      });
      
      setFranchisees(withCountry);
    } catch (err) {
      console.error('Error fetching franchisees:', err);
    } finally {
      setLoadingFranchisees(false);
    }
  }

  // Toggle HQ mode
  function toggleHqMode() {
    if (!hqMode) {
      setHqMode(true);
      fetchFranchisees();
    } else {
      setHqMode(false);
      setSelectedFranchisee(null);
    }
  }

  // Delete document
  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) {
      return;
    }

    setDeleteId(doc.id);
    setDeleteError(null);
    setDeleteSuccess(null);

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('franchise-documents')
        .remove([doc.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      setDeleteSuccess(`"${doc.file_name}" deleted`);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      
      // Refresh after 2 seconds
      setTimeout(() => setDeleteSuccess(null), 2000);

    } catch (err: any) {
      setDeleteError(err.message || 'Delete failed');
    } finally {
      setDeleteId(null);
    }
  }

  // Get category color
  function getCategoryColor(type: string) {
    switch (type) {
      case 'KYC': return 'text-blue-600 bg-blue-100';
      case 'BANK_STATEMENT': return 'text-purple-600 bg-purple-100';
      case 'FINANCIAL_REPORT': return 'text-green-600 bg-green-100';
      case 'LEGAL': return 'text-orange-600 bg-orange-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  }

  // Check if user is HQ
  const isHQ = activeRole === 'HQ';
  
  // Fetch profile data for filing links
  const [profileData, setProfileData] = useState<any>(null);
  
  useEffect(() => {
    async function fetchProfile() {
      if (!userId) return;
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setProfileData(data);
    }
    fetchProfile();
  }, [userId]);

  return (
    <div className="space-y-6">
      {/* Filing Links Section - for both HQ and Franchisee */}
      {userId && profileData && (
        <FilingLinksEdit
          userId={userId}
          regionId={profileData.region_id}
          initialData={profileData}
          onSave={() => {
            // Refresh profile
            supabase.from('user_profiles').select('*').eq('id', userId).single()
              .then(({ data }) => setProfileData(data));
          }}
        />
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Document Vault</h3>
          <p className="text-sm text-slate-500 mt-1">
            Securely upload and manage your franchise documents.
            All documents are encrypted and stored securely.
          </p>
        </div>
        
        {/* HQ Toggle Button */}
        {isHQ && (
          <button
            onClick={toggleHqMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              hqMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            {hqMode ? 'Exit HQ Mode' : 'Upload for Franchisee'}
          </button>
        )}
      </div>

      {/* HQ Mode: Franchisee Selector + Upload */}
      {hqMode && isHQ && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Regulatory Documents for Franchisee
          </h4>
          
          {/* Franchisee Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Select Franchisee
            </label>
            {loadingFranchisees ? (
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                Loading franchisees...
              </div>
            ) : (
              <select
                value={selectedFranchisee?.id || ''}
                onChange={(e) => {
                  const f = franchisees.find(x => x.id === e.target.value);
                  setSelectedFranchisee(f ? { id: f.id, name: f.full_name, country: f.country || 'SGP' } : null);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
              >
                <option value="">-- Select a Franchisee --</option>
                {franchisees.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.full_name} {f.country ? `(${f.country})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* HQ Upload Component */}
          {selectedFranchisee && (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <HQDocumentUpload
                franchiseeId={selectedFranchisee.id}
                franchiseeName={selectedFranchisee.name}
                country={selectedFranchisee.country}
                onUploadComplete={() => {}}
              />
            </div>
          )}
        </div>
      )}

      {/* Document Categories */}
      {!hqMode && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-2xl font-bold text-blue-600">KYC</div>
            <div className="text-sm text-slate-500">Identity Documents</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-2xl font-bold text-green-600">Financial</div>
            <div className="text-sm text-slate-500">Reports & P&L</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-2xl font-bold text-purple-600">Bank</div>
            <div className="text-sm text-slate-500">Bank Statements</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-2xl font-bold text-orange-600">Legal</div>
            <div className="text-sm text-slate-500">Contracts</div>
          </div>
        </div>
      )}

      {/* Upload Component (Non-HQ mode only) */}
      {!hqMode && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <DocumentUpload userId={userId} />
          </div>

          {/* Document List with Delete */}
          {documents.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h4 className="font-semibold text-slate-900">Uploaded Documents ({documents.length})</h4>
              </div>
              
              {loading ? (
                <div className="p-8 text-center text-slate-500">Loading...</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <div key={doc.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(doc.document_type)}`}>
                          {doc.document_type}
                        </span>
                        <div>
                          <div className="font-medium text-slate-900">{doc.file_name}</div>
                          <div className="text-xs text-slate-500">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(doc)}
                        disabled={deleteId === doc.id}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete document"
                      >
                        {deleteId === doc.id ? (
                          <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Messages */}
      {deleteError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{deleteError}</span>
        </div>
      )}

      {deleteSuccess && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5" />
          <span>{deleteSuccess}</span>
        </div>
      )}

      {/* Info */}
      {!hqMode && (
        <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
          <strong>Supported formats:</strong> PDF, PNG, JPG (max 50MB per file)<br />
          <strong>Security:</strong> All documents are encrypted at rest and in transit.
        </div>
      )}
    </div>
  );
}
