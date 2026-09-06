// Bank Statement Parser Edge Function
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  is_inflow: boolean;
  category: string;
  category_detail: string;
}

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
  const { action, file_data, file_name, user_id } = body;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Parse PDF and extract transactions
  if (action === 'parse_statement') {
    try {
      // Decode base64 to binary
      const base64Data = file_data.includes(',') ? file_data.split(',')[1] : file_data;
      const binaryString = atob(base64Data);
      
      // Extract text from PDF (basic extraction)
      const text = extractTextFromPDF(binaryString);
      
      // Detect bank type
      const bankName = detectBank(text);
      
      // Parse based on bank type
      const result = parseBankStatement(text, bankName);
      
      return new Response(JSON.stringify({
        success: true,
        file_name: file_name,
        bank_name: bankName,
        period: result.period,
        summary: result.summary,
        transactions: result.transactions,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error: any) {
      console.error('Parse error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Failed to parse statement',
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Import transactions to database
  if (action === 'import_transactions') {
    try {
      const { transactions, bank_name, statement_period, file_name: fn } = body;
      
      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        throw new Error('No transactions to import');
      }

      // Calculate summary
      const totalInflow = transactions.filter((t: any) => t.is_inflow).reduce((s: number, t: any) => s + t.amount, 0);
      const totalOutflow = transactions.filter((t: any) => !t.is_inflow).reduce((s: number, t: any) => s + t.amount, 0);
      
      // Create snapshot
      const { data: snapshot, error: snapshotError } = await supabase
        .from('cash_flow_snapshots')
        .insert({
          user_id: user_id || auth.userId,
          snapshot_date: new Date().toISOString().split('T')[0],
          source_type: 'PDF',
          source_file: fn || `${bank_name} Statement`,
          monthly_inflow: totalInflow,
          monthly_outflow: totalOutflow,
          net_cash_flow: totalInflow - totalOutflow,
          transaction_count: transactions.length,
          data_quality: 'AUTO_VERIFIED',
          notes: `${bank_name || 'Bank'} - ${statement_period || ''}`,
        })
        .select()
        .single();

      if (snapshotError) {
        console.error('Snapshot error:', snapshotError);
        throw snapshotError;
      }

      // Insert transactions
      const records = transactions.map((t: any) => ({
        snapshot_id: snapshot.id,
        user_id: user_id || auth.userId,
        transaction_date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category || 'OTHER',
        category_detail: t.category_detail || 'OTHER',
        is_inflow: t.is_inflow,
      }));

      const { error: txError } = await supabase
        .from('cash_flow_transactions')
        .insert(records);

      if (txError) {
        console.error('Transaction error:', txError);
        throw txError;
      }

      return new Response(JSON.stringify({
        success: true,
        snapshot_id: snapshot.id,
        transactions_count: transactions.length,
        summary: {
          total_inflow: totalInflow,
          total_outflow: totalOutflow,
          net: totalInflow - totalOutflow,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error: any) {
      console.error('Import error:', error);
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

// Extract text from PDF (basic implementation)
function extractTextFromPDF(base64String: string): string {
  // Decode base64 to binary
  const binaryString = atob(base64String);
  
  // Try to extract readable text from PDF
  // This is a simplified extraction - real PDFs need proper parsing
  // For better results, use PDF.js in browser or pdf-parse in Node
  
  let text = '';
  let inTextObject = false;
  let currentText = '';
  
  for (let i = 0; i < binaryString.length; i++) {
    const char = binaryString.charCodeAt(i);
    
    // Look for text strings in PDF
    if (char === 40) { // (
      inTextObject = true;
      currentText = '';
    } else if (char === 41 && inTextObject) { // )
      inTextObject = false;
      // Clean up text
      const cleaned = currentText
        .replace(/[()\\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length > 2) {
        text += cleaned + '\n';
      }
    } else if (inTextObject) {
      currentText += binaryString[i];
    }
  }
  
  // If no text found, try extracting from raw binary
  if (text.length < 100) {
    // Extract any readable strings (5+ consecutive printable characters)
    const readablePattern = /[A-Za-z0-9\s\/\-\.]{5,}/g;
    const matches = binaryString.match(readablePattern);
    if (matches) {
      text = matches.join('\n');
    }
  }
  
  return text;
}

// Detect bank from statement text
function detectBank(text: string): string {
  const upperText = text.toUpperCase();
  
  if (upperText.includes('DBS') || upperText.includes('DIGITAL BANKING') || upperText.includes('DBS BANK')) {
    return 'DBS';
  }
  if (upperText.includes('OCBC') || upperText.includes('OVERSEAS-CHINESE') || upperText.includes('OCBC BANK')) {
    return 'OCBC';
  }
  if (upperText.includes('UOB') || upperText.includes('UNITED OVERSEAS') || upperText.includes('UOB BANK')) {
    return 'UOB';
  }
  if (upperText.includes('CITIBANK') || upperText.includes('CITI ')) {
    return 'CITIBANK';
  }
  if (upperText.includes('MAYBANK') || upperText.includes('MAYBANK BERHAD')) {
    return 'MAYBANK';
  }
  if (upperText.includes('SCB') || upperText.includes('STANDARD CHARTERED')) {
    return 'STANDARD_CHARTERED';
  }
  
  return 'UNKNOWN';
}

// Parse bank statement based on detected bank type
function parseBankStatement(text: string, bankType: string): any {
  const lines = text.split('\n').filter(l => l.trim().length > 5);
  const transactions: ParsedTransaction[] = [];
  
  let totalInflow = 0;
  let totalOutflow = 0;
  let period = '';

  // Keywords that indicate transaction lines
  const transactionIndicators = [
    'POS', 'SALES', 'PAYMENT', 'TRANSFER', 'GIRO', 'ATM', 'IBG', 'FAST',
    'SALARY', 'PAYROLL', 'CASH', 'DEPOSIT', 'WITHDRAWAL', 'PURCHASE', 'FEE',
    'ROYALTY', 'INVENTORY', 'RENT', 'UTILITY', 'STAFF', 'SUPPLIER'
  ];

  for (const line of lines) {
    const cleanedLine = line.trim();
    if (cleanedLine.length < 10) continue;
    
    // Skip header/footer lines
    if (isHeaderLine(cleanedLine)) continue;
    
    // Try to extract transaction
    let tx = null;
    
    switch (bankType) {
      case 'DBS':
        tx = parseDBSLine(cleanedLine);
        break;
      case 'OCBC':
        tx = parseOCBCLine(cleanedLine);
        break;
      case 'UOB':
        tx = parseUOBLine(cleanedLine);
        break;
      case 'CITIBANK':
      case 'MAYBANK':
      case 'STANDARD_CHARTERED':
        tx = parseGenericBankLine(cleanedLine);
        break;
      default:
        tx = parseGenericBankLine(cleanedLine);
    }

    if (tx && isValidTransaction(tx)) {
      transactions.push(tx);
      if (tx.is_inflow) {
        totalInflow += tx.amount;
      } else {
        totalOutflow += tx.amount;
      }
    }

    // Extract period from date headers
    if (!period) {
      const periodMatch = cleanedLine.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*[-to]+\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
      if (periodMatch) {
        period = `${periodMatch[1]} - ${periodMatch[2]}`;
      }
    }
  }

  return {
    period: period || 'Statement period',
    summary: {
      total_inflow: totalInflow,
      total_outflow: totalOutflow,
      net: totalInflow - totalOutflow,
    },
    transactions,
  };
}

// Check if line is a header/footer (not a transaction)
function isHeaderLine(line: string): boolean {
  const upper = line.toUpperCase();
  const headerIndicators = [
    'STATEMENT', 'ACCOUNT', 'NAME', 'ADDRESS', 'BRANCH', 'PAGE',
    'STATEMENT OF ACCOUNT', 'BANK', 'SUMMARY', 'TOTAL', 'BALANCE BROUGHT',
    'OPENING BALANCE', 'CLOSING BALANCE', 'AVAILABLE BALANCE',
    'CONTACT', 'HELPLINE', 'WWW.', '.COM', 'EMAIL'
  ];
  
  for (const indicator of headerIndicators) {
    if (upper.includes(indicator) && line.length < 60) {
      return true;
    }
  }
  return false;
}

// DBS Parser: "01/07/26 | DESCRIPTION | +5000.00 | 125000.00"
function parseDBSLine(line: string): ParsedTransaction | null {
  // Pattern: date | description | amount | balance
  const patterns = [
    // With pipe separator
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*\|\s*(.+?)\s*\|\s*([+-]?[\d,]+\.?\d*)\s*\|/,
    // With spaces
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([+-]?[\d,]+\.?\d*)\s+[\d,]+\.?\d*/,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const amount = parseFloat(match[3].replace(/,/g, ''));
      if (isNaN(amount) || Math.abs(amount) < 1) return null;
      
      return {
        date: normalizeDate(match[1]),
        description: match[2].trim().substring(0, 100),
        amount: Math.abs(amount),
        is_inflow: amount > 0,
        category: categorizeTransaction(match[2]),
        category_detail: match[2].trim().substring(0, 50),
      };
    }
  }
  return null;
}

// OCBC Parser: "01/07/26 DESCRIPTION 5000.00 CR"
function parseOCBCLine(line: string): ParsedTransaction | null {
  // Pattern: date | description | debit | credit | balance
  const patterns = [
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\d,]+\.?\d*)\s+(DR|CR|DEBIT|CREDIT)\s/i,
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*$/,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const debit = match[3] ? parseFloat(match[3].replace(/,/g, '')) : 0;
      const credit = match[4] ? parseFloat(match[4].replace(/,/g, '')) : 0;
      
      if (match[4] && /^(CR|CREDIT)$/i.test(match[4])) {
        return {
          date: normalizeDate(match[1]),
          description: match[2].trim().substring(0, 100),
          amount: Math.abs(credit),
          is_inflow: true,
          category: categorizeTransaction(match[2]),
          category_detail: match[2].trim().substring(0, 50),
        };
      } else if (debit > 0) {
        return {
          date: normalizeDate(match[1]),
          description: match[2].trim().substring(0, 100),
          amount: Math.abs(debit),
          is_inflow: false,
          category: categorizeTransaction(match[2]),
          category_detail: match[2].trim().substring(0, 50),
        };
      }
    }
  }
  return null;
}

// UOB Parser: similar to DBS
function parseUOBLine(line: string): ParsedTransaction | null {
  return parseDBSLine(line);
}

// Generic bank parser fallback
function parseGenericBankLine(line: string): ParsedTransaction | null {
  // Try multiple patterns
  const patterns = [
    // Date at start, amount somewhere
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([+-]?[\d,]+\.?\d*)\s*$/,
    // Date, description, amount
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+)/,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match && match[1]) {
      // Try to find amount in the description
      const amountMatch = line.match(/([+-]?[\d,]+\.?\d{2})/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (!isNaN(amount) && Math.abs(amount) >= 1) {
          return {
            date: normalizeDate(match[1]),
            description: match[2].trim().substring(0, 100),
            amount: Math.abs(amount),
            is_inflow: amount > 0,
            category: categorizeTransaction(match[2]),
            category_detail: match[2].trim().substring(0, 50),
          };
        }
      }
    }
  }
  return null;
}

// Normalize date to YYYY-MM-DD
function normalizeDate(dateStr: string): string {
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parts[2];
    
    if (year.length === 2) {
      year = parseInt(year) > 50 ? '19' + year : '20' + year;
    }
    
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
}

// Categorize transaction based on description
function categorizeTransaction(description: string): string {
  const desc = description.toUpperCase();
  
  // Income indicators
  if (/\b(POS|SALES|PURCHASE|CARD|PAYMENT|RECEIPT|SALARY|PAYROLL|DEPOSIT|TRANSFER IN|CREDIT)\b/.test(desc)) {
    return 'INCOME';
  }
  
  // Expense indicators
  if (/\b(PAYMENT|TRANSFER OUT|DEBIT|WITHDRAWAL|FEE|CHARGE|ATM|IBG|FAST|GIRO|RENT|UTILITY|INVENTORY|SUPPLIER|ROYALTY|STAFF|SALARY|INSURANCE|TAX)\b/.test(desc)) {
    return 'EXPENSE';
  }
  
  // Transfer
  if (/\b(TRANSFER|IBG|FAST|GIRO|MEW|PAYLAH|PAYNOW)\b/.test(desc)) {
    return 'TRANSFER';
  }
  
  return desc.includes('+') ? 'INCOME' : 'EXPENSE';
}

// Validate transaction
function isValidTransaction(tx: ParsedTransaction): boolean {
  if (!tx.date || tx.date === 'NaN-NaN-NaN') return false;
  if (!tx.description || tx.description.length < 3) return false;
  if (isNaN(tx.amount) || tx.amount <= 0) return false;
  if (tx.amount > 10000000) return false; // Reasonable max
  return true;
}
