// Financial Statement Parser Edge Function
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORTED_DOC_TYPES = ['ACRA_ANNUAL', 'PNL', 'BALANCE_SHEET', 'TAX_ASSESSMENT', 'OTHER'];

// Patterns for financial data extraction
const PNL_PATTERNS = {
  revenue: /REVENUE|SALES|TOTAL INCOME|TURNOVER|NET SALES/i,
  cogs: /COST OF SALES|COST OF GOODS SOLD|DIRECT COSTS/i,
  gross_profit: /GROSS PROFIT|GROSS MARGIN/i,
  operating_expenses: /OPERATING EXPENSES|ADMIN|SELLING|DISTRIBUTION/i,
  net_profit: /NET PROFIT|PROFIT AFTER TAX|NET INCOME|PAT/i,
};

const BS_PATTERNS = {
  current_assets: /CURRENT ASSETS|TOTAL CURRENT ASSETS/i,
  fixed_assets: /FIXED ASSETS|PROPERTY|PLANT|EQUIPMENT|PPE/i,
  total_assets: /TOTAL ASSETS/i,
  current_liabilities: /CURRENT LIABILITIES|TOTAL CURRENT LIABILITIES/i,
  long_term_liabilities: /LONG TERM|NON.CURRENT LIABILITIES/i,
  total_liabilities: /TOTAL LIABILITIES/i,
  shareholders_equity: /SHAREHOLDERS EQUITY|TOTAL EQUITY|CAPITAL AND RESERVES/i,
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await verifyAuth(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { action, document_type, file_data, file_name, file_path, file_size, fiscal_year, user_id } = body;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Parse document and extract data
  if (action === 'parse_document') {
    try {
      // Decode base64 to binary
      const base64Data = file_data.includes(',') ? file_data.split(',')[1] : file_data;
      const binaryString = atob(base64Data);
      
      // Extract text from PDF
      const text = extractTextFromPDF(binaryString);
      
      // Parse based on document type
      let result: any;
      
      switch (document_type) {
        case 'ACRA_ANNUAL':
          result = parseACRADocument(text, fiscal_year);
          break;
        case 'PNL':
          result = parsePNLDocument(text, fiscal_year);
          break;
        case 'BALANCE_SHEET':
          result = parseBalanceSheet(text, fiscal_year);
          break;
        case 'TAX_ASSESSMENT':
          result = parseTaxAssessment(text, fiscal_year);
          break;
        default:
          result = parseGenericDocument(text, fiscal_year);
      }
      
      return new Response(JSON.stringify({
        success: true,
        document_type,
        fiscal_year,
        file_name,
        file_path,
        extracted_text: text.substring(0, 5000),
        metrics: result.metrics,
        extracted_data: result.extracted_data,
        confidence_score: result.confidence_score,
        warnings: result.warnings,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error: any) {
      console.error('Parse error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Failed to parse document',
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Save document to database
  if (action === 'save_document') {
    try {
      const {
        document_type,
        fiscal_year,
        file_name,
        file_path,
        file_size: fSize,
        metrics,
        extracted_data,
        confidence_score,
      } = body;

      // Calculate ratios from metrics
      const ratios = calculateRatios(metrics);

      // Determine reporting period
      const reportingPeriodEnd = fiscal_year ? `${fiscal_year}-12-31` : null;

      // Insert into financial_documents
      const { data: doc, error: docError } = await supabase
        .from('financial_documents')
        .insert({
          user_id: user_id || auth.userId,
          document_type,
          fiscal_year,
          file_name,
          file_path,
          file_size: fSize,
          fiscal_year: fiscal_year,
          reporting_period_end: reportingPeriodEnd,
          extracted_data: extracted_data || {},
          revenue: metrics?.revenue,
          cost_of_goods_sold: metrics?.cogs,
          gross_profit: metrics?.gross_profit,
          operating_expenses: metrics?.operating_expenses,
          net_profit: metrics?.net_profit,
          total_assets: metrics?.total_assets,
          total_liabilities: metrics?.total_liabilities,
          shareholders_equity: metrics?.shareholders_equity,
          gross_margin: ratios?.gross_margin,
          net_margin: ratios?.net_margin,
          current_ratio: ratios?.current_ratio,
          debt_ratio: ratios?.debt_ratio,
          roa: ratios?.roa,
          roe: ratios?.roe,
          confidence_score: confidence_score || 1.0,
        })
        .select()
        .single();

      if (docError) {
        console.error('Document insert error:', docError);
        throw docError;
      }

      // If we have metrics, also create a snapshot
      if (metrics && Object.keys(metrics).length > 0) {
        await supabase
          .from('financial_metrics_snapshot')
          .insert({
            user_id: user_id || auth.userId,
            snapshot_date: reportingPeriodEnd || new Date().toISOString().split('T')[0],
            period_type: 'ANNUAL',
            fiscal_year,
            revenue: metrics.revenue,
            cost_of_goods_sold: metrics.cogs,
            gross_profit: metrics.gross_profit,
            operating_expenses: metrics.operating_expenses,
            net_profit: metrics.net_profit,
            total_assets: metrics.total_assets,
            total_liabilities: metrics.total_liabilities,
            shareholders_equity: metrics.shareholders_equity,
            gross_margin: ratios?.gross_margin,
            net_margin: ratios?.net_margin,
            roa: ratios?.roa,
            roe: ratios?.roe,
            debt_ratio: ratios?.debt_ratio,
            source_document_id: doc.id,
            confidence_score: confidence_score || 1.0,
          });
      }

      return new Response(JSON.stringify({
        success: true,
        document_id: doc.id,
        metrics_extracted: metrics ? Object.keys(metrics).length : 0,
        ratios_calculated: ratios ? Object.keys(ratios).length : 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error: any) {
      console.error('Save error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Extract text from PDF
function extractTextFromPDF(binaryString: string): string {
  let text = '';
  let inTextObject = false;
  let currentText = '';
  
  for (let i = 0; i < binaryString.length; i++) {
    const char = binaryString.charCodeAt(i);
    
    if (char === 40) { // (
      inTextObject = true;
      currentText = '';
    } else if (char === 41 && inTextObject) { // )
      inTextObject = false;
      const cleaned = currentText.replace(/[()\\]/g, '').replace(/\s+/g, ' ').trim();
      if (cleaned.length > 2) {
        text += cleaned + '\n';
      }
    } else if (inTextObject) {
      currentText += binaryString[i];
    }
  }
  
  if (text.length < 100) {
    const readablePattern = /[A-Za-z0-9\s\/\-\.\,\$\%\(\)]{5,}/g;
    const matches = binaryString.match(readablePattern);
    if (matches) {
      text = matches.join('\n');
    }
  }
  
  return text;
}

// Parse ACRA Annual Return
function parseACRADocument(text: string, fiscalYear?: string) {
  const metrics: Record<string, number> = {};
  const warnings: string[] = [];
  let confidence_score = 0.5;
  
  // Extract company info patterns
  const companyPatterns = [
    /UEN:\s*(\d+[A-Z])/i,
    /Company\s*(?:Name|Name):\s*(.+)/i,
    /Incorporation\s*Date:\s*(.+)/i,
  ];
  
  const extracted_data: Record<string, string> = {};
  
  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match) {
      extracted_data[pattern.source.replace(/\\/g, '')] = match[1].trim();
    }
  }
  
  // Extract financial figures
  // Look for revenue/turnover
  const revenuePatterns = [
    /REVENUE[\s\S]{0,100}(?:SGD|USD|\$)?\s*([\d,]+\.?\d*)/im,
    /TOTAL INCOME[\s\S]{0,100}(?:SGD|USD|\$)?\s*([\d,]+\.?\d*)/im,
    /TURNOVER[\s\S]{0,100}(?:SGD|USD|\$)?\s*([\d,]+\.?\d*)/im,
  ];
  
  for (const pattern of revenuePatterns) {
    const match = text.match(pattern);
    if (match) {
      metrics.revenue = parseAmount(match[1]);
      break;
    }
  }
  
  // Look for net profit
  const profitPatterns = [
    /NET PROFIT[\s\S]{0,100}(?:SGD|USD|\$)?\s*([\d,]+\.?\d*)/im,
    /PROFIT AFTER TAX[\s\S]{0,100}(?:SGD|USD|\$)?\s*([\d,]+\.?\d*)/im,
  ];
  
  for (const pattern of profitPatterns) {
    const match = text.match(pattern);
    if (match) {
      metrics.net_profit = parseAmount(match[1]);
      break;
    }
  }
  
  // Look for total assets
  const assetsPatterns = [
    /TOTAL ASSETS[\s\S]{0,100}(?:SGD|USD|\$)?\s*([\d,]+\.?\d*)/im,
    /ASSETS[\s\S]{0,100}(?:SGD|USD|\$)?\s*([\d,]+\.?\d*)/im,
  ];
  
  for (const pattern of assetsPatterns) {
    const match = text.match(pattern);
    if (match) {
      metrics.total_assets = parseAmount(match[1]);
      break;
    }
  }
  
  // Calculate confidence
  if (metrics.revenue) confidence_score += 0.2;
  if (metrics.net_profit) confidence_score += 0.15;
  if (metrics.total_assets) confidence_score += 0.15;
  
  if (confidence_score < 0.8) {
    warnings.push('Some financial figures could not be extracted automatically. Please verify manually.');
  }
  
  return { metrics, extracted_data, confidence_score, warnings };
}

// Parse P&L Statement
function parsePNLDocument(text: string, fiscalYear?: string) {
  const metrics: Record<string, number> = {};
  const warnings: string[] = [];
  let confidence_score = 0.6;
  
  // Extract line items
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Revenue
    if (PNL_PATTERNS.revenue.test(line)) {
      const match = line.match(/[\$\€\£]?\s*([\d,]+\.?\d*)|([\d,]+\.?\d*)\s*(?:M|K)?\s*(?:REVENUE|SALES|INCOME)/i);
      if (match) {
        metrics.revenue = parseAmount(match[1] || match[2] || '0');
      }
    }
    
    // COGS
    if (PNL_PATTERNS.cogs.test(line)) {
      const match = line.match(/[\$\€\£]?\s*([\d,]+\.?\d*)/);
      if (match) {
        metrics.cogs = parseAmount(match[1]);
      }
    }
    
    // Gross Profit
    if (PNL_PATTERNS.gross_profit.test(line)) {
      const match = line.match(/[\$\€\£]?\s*([\d,]+\.?\d*)/);
      if (match) {
        metrics.gross_profit = parseAmount(match[1]);
      }
    }
    
    // Operating Expenses
    if (PNL_PATTERNS.operating_expenses.test(line)) {
      const match = line.match(/[\$\€\£]?\s*([\d,]+\.?\d*)/);
      if (match) {
        metrics.operating_expenses = parseAmount(match[1]);
      }
    }
    
    // Net Profit
    if (PNL_PATTERNS.net_profit.test(line)) {
      const match = line.match(/[\$\€\£]?\s*([\d,]+\.?\d*)/);
      if (match) {
        metrics.net_profit = parseAmount(match[1]);
      }
    }
  }
  
  // Calculate gross profit if not found
  if (metrics.revenue && metrics.cogs && !metrics.gross_profit) {
    metrics.gross_profit = metrics.revenue - metrics.cogs;
  }
  
  // Calculate net profit if not found
  if (metrics.gross_profit && metrics.operating_expenses && !metrics.net_profit) {
    metrics.net_profit = metrics.gross_profit - metrics.operating_expenses;
  }
  
  // Confidence based on metrics found
  const metricsFound = Object.values(metrics).filter(v => v > 0).length;
  confidence_score = 0.4 + (metricsFound * 0.15);
  
  if (confidence_score < 0.7) {
    warnings.push('Please verify the extracted figures manually.');
  }
  
  return { metrics, extracted_data: {}, confidence_score, warnings };
}

// Parse Balance Sheet
function parseBalanceSheet(text: string, fiscalYear?: string) {
  const metrics: Record<string, number> = {};
  const warnings: string[] = [];
  let confidence_score = 0.6;
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Total Assets
    if (BS_PATTERNS.total_assets.test(line)) {
      const match = line.match(/[\$\€\£]?\s*([\d,]+\.?\d*)/);
      if (match) {
        metrics.total_assets = parseAmount(match[1]);
      }
    }
    
    // Current Assets
    if (BS_PATTERNS.current_assets.test(line)) {
      const match = line.match(/[\$\€\£]?\s*([\d,]+\.?\d*)/);
      if (match) {
        metrics.current_assets = parseAmount(match[1]);
      }
    }
    
    // Total Liabilities
    if (BS_PATTERNS.total_liabilities.test(line)) {
      const match = line.match(/[\$\€\£]?\s*([\d,]+\.?\d*)/);
      if (match) {
        metrics.total_liabilities = parseAmount(match[1]);
      }
    }
    
    // Shareholders Equity
    if (BS_PATTERNS.shareholders_equity.test(line)) {
      const match = line.match(/[\$\€\£]?\s*([\d,]+\.?\d*)/);
      if (match) {
        metrics.shareholders_equity = parseAmount(match[1]);
      }
    }
  }
  
  // Calculate fixed assets
  if (metrics.total_assets && metrics.current_assets) {
    metrics.fixed_assets = metrics.total_assets - metrics.current_assets;
  }
  
  // Calculate current liabilities
  if (metrics.total_liabilities) {
    metrics.current_liabilities = metrics.total_liabilities * 0.6; // Estimate
    metrics.long_term_liabilities = metrics.total_liabilities * 0.4;
  }
  
  const metricsFound = Object.values(metrics).filter(v => v > 0).length;
  confidence_score = 0.4 + (metricsFound * 0.12);
  
  return { metrics, extracted_data: {}, confidence_score, warnings };
}

// Parse Tax Assessment
function parseTaxAssessment(text: string, fiscalYear?: string) {
  const metrics: Record<string, number> = {};
  const warnings: string[] = [];
  let confidence_score = 0.7;
  
  // Extract tax assessment info
  const taxableIncomeMatch = text.match(/TAXABLE INCOME[\s\S]{0,50}(?:SGD)?\s*([\d,]+\.?\d*)/i);
  if (taxableIncomeMatch) {
    metrics.taxable_income = parseAmount(taxableIncomeMatch[1]);
  }
  
  const taxPayableMatch = text.match(/(?:TAX PAYABLE|TAX ASSESSED)[\s\S]{0,50}(?:SGD)?\s*([\d,]+\.?\d*)/i);
  if (taxPayableMatch) {
    metrics.tax_payable = parseAmount(taxPayableMatch[1]);
  }
  
  return { metrics, extracted_data: {}, confidence_score, warnings };
}

// Parse generic document
function parseGenericDocument(text: string, fiscalYear?: string) {
  return {
    metrics: {},
    extracted_data: { sample_text: text.substring(0, 1000) },
    confidence_score: 0.3,
    warnings: ['Document type not recognized. Manual data entry may be required.'],
  };
}

// Calculate financial ratios
function calculateRatios(metrics: Record<string, number>) {
  const ratios: Record<string, number> = {};
  
  if (metrics.revenue && metrics.revenue > 0) {
    if (metrics.gross_profit) {
      ratios.gross_margin = (metrics.gross_profit / metrics.revenue) * 100;
    }
    if (metrics.net_profit) {
      ratios.net_margin = (metrics.net_profit / metrics.revenue) * 100;
    }
  }
  
  if (metrics.total_assets && metrics.total_assets > 0) {
    if (metrics.net_profit) {
      ratios.roa = (metrics.net_profit / metrics.total_assets) * 100; // Return on Assets
    }
    if (metrics.total_liabilities) {
      ratios.debt_ratio = (metrics.total_liabilities / metrics.total_assets);
    }
  }
  
  if (metrics.shareholders_equity && metrics.shareholders_equity > 0) {
    if (metrics.net_profit) {
      ratios.roe = (metrics.net_profit / metrics.shareholders_equity) * 100; // Return on Equity
    }
    if (metrics.total_liabilities) {
      ratios.debt_to_equity = metrics.total_liabilities / metrics.shareholders_equity;
    }
  }
  
  if (metrics.current_assets && metrics.current_liabilities && metrics.current_liabilities > 0) {
    ratios.current_ratio = metrics.current_assets / metrics.current_liabilities;
  }
  
  return ratios;
}

// Parse amount string to number
function parseAmount(str: string): number {
  if (!str) return 0;
  
  // Remove currency symbols, commas, and spaces
  let cleanStr = str.replace(/[\$\€\£\s,]/g, '');
  
  // Handle K (thousands) and M (millions) suffixes
  if (cleanStr.match(/K$/i)) {
    return parseFloat(cleanStr.replace(/K$/i, '')) * 1000;
  }
  if (cleanStr.match(/M$/i)) {
    return parseFloat(cleanStr.replace(/M$/i, '')) * 1000000;
  }
  
  return parseFloat(cleanStr) || 0;
}
