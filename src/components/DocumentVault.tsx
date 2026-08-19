import React from 'react';
import { DocumentUpload } from './DocumentUpload';

/**
 * DocumentVault Component
 * Wraps DocumentUpload with enhanced vault experience
 */
export function DocumentVault() {
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
        <DocumentUpload />
      </div>

      {/* Info */}
      <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
        <strong>Supported formats:</strong> PDF, PNG, JPG (max 50MB per file)<br />
        <strong>Security:</strong> All documents are encrypted at rest and in transit.
      </div>
    </div>
  );
}
