import React, { useEffect, useState } from 'react';
import { DocumentUpload } from './DocumentUpload';
import { Trash2, X, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

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

export function DocumentVault() {
  const [userId, setUserId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Document Vault</h3>
        <p className="text-sm text-slate-500 mt-1">
          Securely upload and manage your franchise documents.
          All documents are encrypted and stored securely.
        </p>
      </div>

      {/* Document Categories */}
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

      {/* Upload Component */}
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
      <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
        <strong>Supported formats:</strong> PDF, PNG, JPG (max 50MB per file)<br />
        <strong>Security:</strong> All documents are encrypted at rest and in transit.
      </div>
    </div>
  );
}
