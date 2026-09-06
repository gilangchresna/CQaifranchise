import React from 'react';
import { Download, FileSpreadsheet, Info } from 'lucide-react';

interface CashFlowTemplateDownloadProps {
  className?: string;
}

export function CashFlowTemplateDownload({ className = '' }: CashFlowTemplateDownloadProps) {
  const handleDownload = () => {
    // Download CSV template
    const link = document.createElement('a');
    link.href = '/templates/cash_flow_template.csv';
    link.download = 'cash_flow_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleDownload}
        className={`flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors ${className}`}
      >
        <FileSpreadsheet className="w-4 h-4" />
        Download CSV Template
      </button>
      
      <div className="flex items-start gap-2 text-xs text-slate-500 bg-blue-50 p-3 rounded-lg">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Template Format:</strong>
          <br />
          Date (DD/MM/YYYY), Description, Amount (positive=income, negative=expense), Category, Category Detail
        </div>
      </div>
    </div>
  );
}
