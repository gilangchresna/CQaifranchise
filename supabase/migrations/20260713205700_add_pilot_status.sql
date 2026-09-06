-- Add PILOT status to outlet_status enum
ALTER TYPE outlet_status ADD VALUE IF NOT EXISTS 'PILOT';
ALTER TYPE outlet_status ADD VALUE IF NOT EXISTS 'INACTIVE';
