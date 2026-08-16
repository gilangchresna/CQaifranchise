import React, { useState, useRef, useEffect } from 'react';
import { Upload, File, Download, AlertCircle } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface Document {
  id: string;
  application_id: string | null;
  document_type: string;
  title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  created_at: string;
}

interface DocumentUploadProps {
  applicationId?: string;
  onUploadComplete?: (doc: Document) => void;
  readOnly?: boolean;
  userId?: string;
}

const DOC_TYPES = [
  { value: 'KYC_ID', label: 'KYC / Identity Document' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement (3-6 months)' },
  { value: 'FRANCHISEE_CONTRACT', label: 'Franchise Agreement' },
  { value: 'FINANCIAL_REPORT', label: 'Financial Report / P&L' },
  { value: 'OTHER', label: 'Other Document' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DocumentUpload({ applicationId, onUploadComplete, readOnly = false, userId }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedType, setSelectedType] = useState('KYC_ID');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing documents
  useEffect(() => {
    fetchDocuments();
  }, [applicationId, userId]);

  async function fetchDocuments() {
    if (!userId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (applicationId) {
        query = query.eq('application_id', applicationId);
      }

      const { data, error } = await query;
      if (!error && data) {
        setDocuments(data);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);

    try {
      const base64Data = await fileToBase64(file);

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lender-bridge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'upload_document',
            document_type: selectedType,
            title: file.name.replace(/\.[^/.]+$/, ''),
            file_data: base64Data,
            file_name: file.name,
            file_mime_type: file.type,
            application_id: applicationId || undefined,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Refresh documents list
      await fetchDocuments();
      onUploadComplete?.(result.document);
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: Document) {
    try {
      const { data, error } = await supabase.storage
        .from('franchise-documents')
        .download(doc.storage_path);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Download failed: ' + err.message);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Loading documents...</div>;
  }

  if (readOnly && documents.length === 0) {
    return <p className="text-sm text-slate-500">No documents attached.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {!readOnly && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleUpload(file);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = ''; // Reset for same file
            }}
          />
          
          <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-600 mb-3">
            Drag & drop or{' '}
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()} 
              className="text-blue-600 hover:underline font-medium"
            >
              browse files
            </button>
          </p>
          <p className="text-xs text-slate-400 mb-3">PDF, PNG, JPG — max 50MB</p>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="border border-slate-200 rounded px-3 py-1.5 text-sm bg-white"
          >
            {DOC_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          
          {uploading && (
            <div className="mt-3">
              <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-blue-600 mt-1">Uploading...</p>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">
            Uploaded Documents ({documents.length})
          </h4>
          {documents.map(doc => (
            <div 
              key={doc.id} 
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-slate-200 rounded flex items-center justify-center flex-shrink-0">
                  <File className="w-5 h-5 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{doc.title}</p>
                  <p className="text-xs text-slate-500">
                    {DOC_TYPES.find(t => t.value === doc.document_type)?.label || doc.document_type} • {formatSize(doc.file_size_bytes)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDownload(doc)}
                className="p-2 hover:bg-slate-200 rounded transition-colors flex-shrink-0"
                title="Download"
              >
                <Download className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
