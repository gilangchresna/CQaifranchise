import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface BankStatementUploadProps {
  userId: string;
  onUploadComplete?: (result: any) => void;
}

type UploadStatus = 'idle' | 'parsing' | 'uploading' | 'success' | 'error';

export function BankStatementUpload({ userId, onUploadComplete }: BankStatementUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setStatus('parsing');
    setError(null);
    setSuccess(null);

    try {
      // Read file as base64
      const base64 = await fileToBase64(file);

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bank-statement-parse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'parse_statement',
            file_data: base64,
            file_name: file.name,
            user_id: userId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Parsing failed');
      }

      setParsedData(result);
      setShowPreview(true);
      setStatus('idle');

    } catch (err: any) {
      setError(err.message || 'Parsing failed');
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bank-statement-parse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'import_transactions',
            transactions: parsedData.transactions,
            bank_name: parsedData.bank_name,
            statement_period: parsedData.period,
            file_name: parsedData.file_name,
            user_id: userId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Import failed');
      }

      setSuccess(`Imported ${result.transactions_count} transactions from ${parsedData.bank_name}`);
      setParsedData(null);
      onUploadComplete?.(result);

    } catch (err: any) {
      setError(err.message || 'Import failed');
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  const isProcessing = status === 'parsing' || status === 'uploading';

  return (
    <div className="space-y-4">
      {/* Preview Modal */}
      {showPreview && parsedData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Preview: {parsedData.bank_name || 'Unknown Bank'}
                </h3>
                <p className="text-sm text-slate-500">
                  Period: {parsedData.period || 'Unknown period'} • {parsedData.transactions?.length || 0} transactions
                </p>
              </div>
              <button 
                onClick={() => { setShowPreview(false); setParsedData(null); }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 overflow-auto max-h-[60vh]">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-xs text-green-600 font-medium">Inflow</div>
                  <div className="text-lg font-bold text-green-700">
                    SGD {(parsedData.summary?.total_inflow || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-xs text-red-600 font-medium">Outflow</div>
                  <div className="text-lg font-bold text-red-700">
                    SGD {(parsedData.summary?.total_outflow || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-xs text-blue-600 font-medium">Net</div>
                  <div className={`text-lg font-bold ${(parsedData.summary?.net || 0) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    SGD {(parsedData.summary?.net || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="text-xs text-purple-600 font-medium">Transactions</div>
                  <div className="text-lg font-bold text-purple-700">
                    {parsedData.transactions?.length || 0}
                  </div>
                </div>
              </div>
              
              {/* Transactions Table */}
              {parsedData.transactions && parsedData.transactions.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs text-slate-500 uppercase">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedData.transactions.slice(0, 25).map((tx: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600">{tx.date}</td>
                          <td className="px-4 py-3 text-slate-900 max-w-xs truncate">
                            {tx.description}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              tx.category === 'INCOME' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {tx.category || 'OTHER'}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${
                            tx.is_inflow ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {tx.is_inflow ? '+' : '-'}SGD {(tx.amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedData.transactions.length > 25 && (
                    <div className="px-4 py-3 text-center text-sm text-slate-500 bg-slate-50 border-t">
                      ... and {parsedData.transactions.length - 25} more transactions
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No transactions detected in this statement.</p>
                  <p className="text-sm mt-1">Try a different PDF or use CSV template instead.</p>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => { setShowPreview(false); setParsedData(null); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={!parsedData.transactions?.length}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Import {parsedData.transactions?.length || 0} Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isProcessing 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer'
        }`}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
        
        <div className="flex flex-col items-center">
          {isProcessing ? (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 mb-4 animate-spin" />
              <p className="text-blue-600 font-semibold mb-1">
                {status === 'parsing' ? 'Parsing bank statement...' : 'Importing transactions...'}
              </p>
              <p className="text-xs text-slate-500">
                {status === 'parsing' 
                  ? 'Detecting format and extracting transactions'
                  : 'Adding transactions to cash flow'}
              </p>
            </>
          ) : (
            <>
              <FileText className="w-12 h-12 text-slate-400 mb-4" />
              <p className="text-slate-700 font-semibold mb-1">
                Upload Bank Statement PDF
              </p>
              <p className="text-sm text-slate-500 mb-4">
                Supports DBS, OCBC, UOB, and other Singapore bank statements
              </p>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-600">DBS</span>
                <span className="px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-600">OCBC</span>
                <span className="px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-600">UOB</span>
                <span className="px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-600">+ more</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded">
            <X className="w-4 h-4" />
          </button>
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
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
