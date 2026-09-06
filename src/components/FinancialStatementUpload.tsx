import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Building, TrendingUp, Scale, Receipt, HelpCircle } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface FinancialStatementUploadProps {
  userId: string;
  onUploadComplete?: (doc: any) => void;
}

type DocumentType = 'ACRA_ANNUAL' | 'PNL' | 'BALANCE_SHEET' | 'TAX_ASSESSMENT' | 'OTHER';

interface DocumentTypeInfo {
  id: DocumentType;
  label: string;
  description: string;
  icon: React.ReactNode;
  acceptedFormats: string[];
  helpText: string;
}

const DOCUMENT_TYPES: DocumentTypeInfo[] = [
  {
    id: 'ACRA_ANNUAL',
    label: 'ACRA Annual Return',
    description: 'BizFile annual filing from ACRA (Singapore)',
    icon: <Building className="w-5 h-5" />,
    acceptedFormats: ['.pdf'],
    helpText: 'Upload your ACRA BizFile annual return. System will extract company info and revenue.'
  },
  {
    id: 'PNL',
    label: 'Profit & Loss Statement',
    description: 'Income statement showing revenue and expenses',
    icon: <TrendingUp className="w-5 h-5" />,
    acceptedFormats: ['.pdf', '.xlsx', '.csv'],
    helpText: 'Upload your P&L statement. System will extract revenue, costs, and profit margins.'
  },
  {
    id: 'BALANCE_SHEET',
    label: 'Balance Sheet',
    description: 'Snapshot of assets and liabilities',
    icon: <Scale className="w-5 h-5" />,
    acceptedFormats: ['.pdf', '.xlsx', '.csv'],
    helpText: 'Upload your balance sheet. System will extract assets, liabilities, and equity.'
  },
  {
    id: 'TAX_ASSESSMENT',
    label: 'IRAS Tax Assessment',
    description: 'Notice of Assessment from IRAS',
    icon: <Receipt className="w-5 h-5" />,
    acceptedFormats: ['.pdf'],
    helpText: 'Upload your IRAS Notice of Assessment. System will extract taxable income and tax paid.'
  }
];

export function FinancialStatementUpload({ userId, onUploadComplete }: FinancialStatementUploadProps) {
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [fiscalYear, setFiscalYear] = useState<string>(new Date().getFullYear().toString());
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const docType = DOCUMENT_TYPES.find(t => 
        t.acceptedFormats.some(fmt => droppedFile.name.toLowerCase().endsWith(fmt))
      );
      if (docType) {
        setSelectedType(docType.id);
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Unsupported file format. Please upload PDF, XLSX, or CSV.');
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedType || !userId) {
      setError('Please select a document type and file');
      return;
    }

    setStatus('uploading');
    setError(null);

    try {
      // Read file as base64
      const base64 = await fileToBase64(file);

      // Upload to storage
      const filePath = `financial-docs/${userId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('franchise-documents')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error('Failed to upload file');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('franchise-documents')
        .getPublicUrl(filePath);

      // Parse document
      setStatus('parsing');
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/financial-statement-parse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'parse_document',
            document_type: selectedType,
            file_data: base64,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            fiscal_year: fiscalYear,
            user_id: userId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to parse document');
      }

      setParsedData(result);
      setShowPreview(true);
      setStatus('idle');

    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setStatus('error');
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;

    setStatus('uploading');
    setShowPreview(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/financial-statement-parse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'save_document',
            ...parsedData,
            user_id: userId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save document');
      }

      setSuccess(`Document uploaded and ${result.metrics_extracted || 0} financial metrics extracted`);
      onUploadComplete?.(result);
      
      // Reset form
      setFile(null);
      setSelectedType(null);
      setParsedData(null);

    } catch (err: any) {
      setError(err.message || 'Save failed');
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  const selectedDocType = DOCUMENT_TYPES.find(t => t.id === selectedType);

  return (
    <div className="space-y-6">
      {/* Document Type Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Document Type
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          {DOCUMENT_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selectedType === type.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  selectedType === type.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {type.icon}
                </div>
                <div>
                  <div className={`font-medium ${
                    selectedType === type.id ? 'text-blue-900' : 'text-slate-900'
                  }`}>
                    {type.label}
                  </div>
                  <div className="text-sm text-slate-500">{type.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Fiscal Year */}
      {selectedType && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Fiscal Year
          </label>
          <input
            type="text"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            placeholder="e.g., 2025"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Enter the fiscal year this document covers (e.g., "FY2025")
          </p>
        </div>
      )}

      {/* Upload Zone */}
      {selectedType && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            file ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-blue-400'
          }`}
        >
          <input
            type="file"
            accept={selectedDocType?.acceptedFormats.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            id="financial-file-input"
          />
          
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-green-600" />
              <div className="text-left">
                <div className="font-medium text-slate-900">{file.name}</div>
                <div className="text-sm text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button
                onClick={() => setFile(null)}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          ) : (
            <label htmlFor="financial-file-input" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <p className="text-slate-600 font-medium">
                Click or drag file to upload
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Accepted: {selectedDocType?.acceptedFormats.join(', ')}
              </p>
            </label>
          )}
        </div>
      )}

      {/* Help Text */}
      {selectedType && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm">
          <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5" />
          <p className="text-blue-700">{selectedDocType?.helpText}</p>
        </div>
      )}

      {/* Upload Button */}
      {file && selectedType && (
        <button
          onClick={handleUpload}
          disabled={status === 'uploading' || status === 'parsing'}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {status === 'uploading' ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Uploading...
            </>
          ) : status === 'parsing' ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Parsing document...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Upload & Extract
            </>
          )}
        </button>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && parsedData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-green-50 to-white">
              <div>
                <h3 className="text-lg font-semibold">Extracted Data Preview</h3>
                <p className="text-sm text-slate-500">
                  {selectedDocType?.label} • FY{fiscalYear}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  parsedData.confidence_score >= 0.8 ? 'bg-green-100 text-green-700' :
                  parsedData.confidence_score >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {Math.round((parsedData.confidence_score || 0) * 100)}% confidence
                </span>
                <button onClick={() => { setShowPreview(false); setParsedData(null); }} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-auto max-h-[60vh]">
              {/* Extracted Metrics */}
              {parsedData.metrics && (
                <div className="mb-6">
                  <h4 className="font-medium text-slate-700 mb-3">Extracted Financial Metrics</h4>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {Object.entries(parsedData.metrics).slice(0, 9).map(([key, value]) => (
                      <div key={key} className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 capitalize">{formatMetricName(key)}</div>
                        <div className="text-lg font-semibold text-slate-900">
                          {formatMetricValue(key, value as number)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {parsedData.warnings && parsedData.warnings.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-slate-700 mb-2">Please Verify</h4>
                  <ul className="space-y-1">
                    {parsedData.warnings.map((warning: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-yellow-700">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Raw Text Preview */}
              {parsedData.extracted_text && (
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">Extracted Text Preview</h4>
                  <pre className="bg-slate-100 rounded-lg p-4 text-xs overflow-auto max-h-48">
                    {parsedData.extracted_text.substring(0, 2000)}...
                  </pre>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => { setShowPreview(false); setParsedData(null); setFile(null); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess(null)} className="p-1 hover:bg-green-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatMetricName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

function formatMetricValue(key: string, value: number): string {
  if (value === null || value === undefined) return '-';
  
  const absValue = Math.abs(value);
  
  if (key.includes('ratio') || key.includes('margin') || key.includes('rate')) {
    return `${value.toFixed(2)}x`;
  }
  if (key.includes('percentage') || key.includes('margin') || key.includes('rate')) {
    return `${value.toFixed(1)}%`;
  }
  
  if (absValue >= 1000000) {
    return `SGD ${(value / 1000000).toFixed(2)}M`;
  }
  if (absValue >= 1000) {
    return `SGD ${(value / 1000).toFixed(1)}K`;
  }
  
  return `SGD ${value.toLocaleString()}`;
}
