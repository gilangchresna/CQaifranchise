// src/components/HQDocumentUpload.tsx
import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, Trash2, FileText, X } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface HQDocumentUploadProps {
  franchiseeId: string;
  franchiseeName: string;
  country: string;
  onUploadComplete?: () => void;
}

interface UploadedDoc {
  id: string;
  document_type: string;
  file_name: string;
  uploaded_at: string;
}

const DOC_TYPES = {
  SGP: [
    { value: 'SGP_ACRA_ANNUAL', label: 'ACRA Annual Return', description: 'Annual return filed with ACRA via BizFile+' },
    { value: 'SGP_ACRA_XBRL', label: 'ACRA XBRL Financials', description: 'XBRL formatted financial statements' },
  ],
  IDN: [
    { value: 'IDN_AHU_ANNUAL', label: 'AHU Annual Report', description: 'Annual report filed with Ministry of Law' },
    { value: 'IDN_LKPM_Q1', label: 'LKPM Q1', description: 'Quarterly investment report - Q1' },
    { value: 'IDN_LKPM_Q2', label: 'LKPM Q2', description: 'Quarterly investment report - Q2' },
    { value: 'IDN_LKPM_Q3', label: 'LKPM Q3', description: 'Quarterly investment report - Q3' },
    { value: 'IDN_LKPM_Q4', label: 'LKPM Q4', description: 'Quarterly investment report - Q4' },
    { value: 'IDN_DJP_SPT', label: 'DJP SPT Tahunan', description: 'Annual tax return filed with DJP' },
  ],
};

export function HQDocumentUpload({ franchiseeId, franchiseeName, country, onUploadComplete }: HQDocumentUploadProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const docTypes = DOC_TYPES[country as keyof typeof DOC_TYPES] || [];

  // Get current user ID
  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    }
    getUser();
  }, []);

  useEffect(() => {
    fetchUploadedDocs();
  }, [franchiseeId, country]);

  async function fetchUploadedDocs() {
    const { data, error } = await supabase
      .from('regulatory_documents')
      .select('id, document_type, file_name, uploaded_at')
      .eq('entity_id', franchiseeId)
      .eq('country', country)
      .order('uploaded_at', { ascending: false });

    if (!error && data) {
      setUploadedDocs(data);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedType || !userId) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Upload to storage
      const filePath = `${franchiseeId}/${country}/${selectedType}/${file.name}`;
      const { error: storageError } = await supabase.storage
        .from('franchise-documents')
        .upload(filePath, file, { upsert: true });

      if (storageError) throw storageError;

      // Save to database
      const { error: dbError } = await supabase
        .from('regulatory_documents')
        .insert({
          entity_id: franchiseeId,
          uploaded_by_id: userId,
          country,
          document_type: selectedType,
          file_path: filePath,
          file_name: file.name,
          uploaded_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;

      setSuccess(`${file.name} uploaded successfully`);
      setSelectedType('');
      fetchUploadedDocs();
      onUploadComplete?.();

    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: UploadedDoc) {
    if (!confirm(`Delete ${doc.file_name}?`)) return;

    try {
      // Delete from storage
      const filePath = `${franchiseeId}/${country}/${doc.document_type}/${doc.file_name}`;
      await supabase.storage
        .from('franchise-documents')
        .remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from('regulatory_documents')
        .delete()
        .eq('id', doc.id);

      if (!error) {
        setUploadedDocs(prev => prev.filter(d => d.id !== doc.id));
        setSuccess('Document deleted');
      }
    } catch (err) {
      setError('Delete failed');
    }
  }

  // Check if doc type already uploaded
  function isUploaded(docType: string) {
    return uploadedDocs.some(d => d.document_type === docType);
  }

  // Get doc label
  function getDocLabel(docType: string) {
    const found = docTypes.find(d => d.value === docType);
    return found ? found.label : docType;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          Upload Regulatory Documents
        </h3>
        <p className="text-sm text-slate-500">
          For: <span className="font-medium">{franchiseeName}</span> ({country === 'SGP' ? '🇸🇬 Singapore' : '🇮🇩 Indonesia'})
        </p>
      </div>

      {/* Already Uploaded */}
      {uploadedDocs.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Uploaded Documents ({uploadedDocs.length}/{docTypes.length})
          </h4>
          <div className="space-y-2">
            {uploadedDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-white rounded p-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">{getDocLabel(doc.document_type)}</span>
                  <span className="text-xs text-slate-500">({doc.file_name})</span>
                </div>
                <button
                  onClick={() => handleDelete(doc)}
                  className="p-1 text-red-500 hover:bg-red-100 rounded"
                  title="Delete document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document Checklist */}
      <div className="border border-slate-200 rounded-lg p-4">
        <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Required Documents Checklist
        </h4>
        
        <div className="space-y-2">
          {docTypes.map(docType => (
            <div
              key={docType.value}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                isUploaded(docType.value)
                  ? 'bg-green-50 border-green-200'
                  : selectedType === docType.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => !isUploaded(docType.value) && setSelectedType(docType.value)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{docType.label}</div>
                  <div className="text-sm text-slate-500">{docType.description}</div>
                </div>
                {isUploaded(docType.value) ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="w-5 h-5 border-2 border-slate-300 rounded-full" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Area */}
      {selectedType && (
        <div className="mt-4">
          <label className="flex flex-col items-center justify-center gap-2 w-full p-8 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-colors">
            <Upload className="w-8 h-8 text-blue-600" />
            <span className="font-medium text-blue-600">
              {uploading ? 'Uploading...' : `Click to upload ${getDocLabel(selectedType)}`}
            </span>
            <span className="text-sm text-slate-500">PDF, PNG, JPG (max 50MB)</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {/* Progress Summary */}
      <div className="bg-slate-50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-slate-700">Completion Progress</span>
          <span className="text-sm font-bold text-slate-900">
            {uploadedDocs.length} / {docTypes.length}
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${(uploadedDocs.length / docTypes.length) * 100}%` }}
          />
        </div>
        {uploadedDocs.length === docTypes.length && (
          <p className="text-sm text-green-600 mt-2 font-medium flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            All required documents uploaded!
          </p>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
