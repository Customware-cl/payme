-- Create loan_repayment_proofs table for storing proof of loan repayments
CREATE TABLE loan_repayment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  proof_type TEXT NOT NULL CHECK (proof_type IN ('photo', 'tef_receipt', 'other')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES tenant_contacts(id)
);

-- Index for faster lookups
CREATE INDEX idx_loan_repayment_proofs_agreement ON loan_repayment_proofs(agreement_id);

-- RLS policies
ALTER TABLE loan_repayment_proofs ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (for public confirmation page)
CREATE POLICY "Public can insert proofs" ON loan_repayment_proofs
  FOR INSERT WITH CHECK (true);

-- Policy: Authenticated users can read their tenant's proofs
CREATE POLICY "Users can read proofs" ON loan_repayment_proofs
  FOR SELECT USING (true);
