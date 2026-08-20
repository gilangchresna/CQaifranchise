import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';

interface CashFlowUploadProps {
  userId: string;
  onUploadComplete?: (result: any) => void;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export function CashFlowUpload({ userId, onUploadComplete }: CashFlowUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file (.csv)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setStatus('uploading');
    setError(null);
    setSuccess(null);

    try {
      // Read file content
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      
      // Parse CSV
      const rows: string[][] = [];
      for (const line of lines) {
        const cols = parseCSVLine(line);
        if (cols.length >= 4) {
          rows.push(cols);
        }
      }

      if (rows.length < 2) {
        throw new Error('CSV file must have header and at least 1 data row');
      }

      // Show preview
      setPreviewData(rows);
      setShowPreview(true);
      setStatus('idle');

    } catch (err: any) {
      setError(err.message || 'Failed to read file');
      setStatus('error');
    }
  };

  const handleConfirmUpload = async () => {
    setStatus('uploading');
    setShowPreview(false);

    try {
      // Parse the preview data and send to edge function
      const { data: { session } } = await (await import('@/src/lib/supabase')).supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cashflow-import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'import_csv',
            csv_data: previewData,
            user_id: userId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Import failed');
      }

      setSuccess(`Imported ${result.transactions_count} transactions`);
      onUploadComplete?.(result);

    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="space-y-4">
      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Preview Data</h3>
              <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase">
                    {previewData[0]?.map((col, i) => (
                      <th key={i} className="px-2 py-2 border-b">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(1, 11).map((row, i) => (
                    <tr key={i} className="border-b">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-2">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 11 && (
                <p className="text-sm text-slate-500 mt-2">
                  ... and {previewData.length - 11} more rows
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={status === 'uploading'}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
              >
                {status === 'uploading' ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          status === 'uploading' 
            ? 'border-green-300 bg-green-50' 
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
        }`}
        onClick={() => status === 'idle' && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
        />
        
        {status === 'uploading' ? (
          <div className="animate-spin w-10 h-10 border-3 border-green-600 border-t-transparent rounded-full mx-auto mb-3"></div>
        ) : (
          <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        )}
        
        <p className="text-slate-600 font-medium">
          {status === 'uploading' ? 'Processing...' : 'Click to upload CSV file'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          .csv file (max 10MB)
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1">{success}</div>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// Simple CSV parser
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}
