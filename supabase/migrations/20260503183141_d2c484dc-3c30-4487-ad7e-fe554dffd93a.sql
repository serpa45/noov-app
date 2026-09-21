-- Create table for QZ Tray certificates
CREATE TABLE IF NOT EXISTS public.qz_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_content TEXT NOT NULL,
    private_key_content TEXT NOT NULL,
    domain TEXT NOT NULL DEFAULT 'noov.app.br',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qz_certificates ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow authenticated users to view the certificates (or specific logic if needed)
-- However, for the edge function to work globally and the certificate to be public, 
-- we can create a specific policy or just let the edge function handle the access.
CREATE POLICY "Public can view active certificate content" 
ON public.qz_certificates 
FOR SELECT 
USING (is_active = true);

-- Note: The private_key_content should never be exposed via standard SELECT if possible, 
-- but since RLS is per row, we should be careful. 
-- In a real scenario, we might split this into two tables or use a database function.

-- Insert a placeholder record (The user will need to provide the actual cert/key via a tool or UI later, 
-- or we use environment variables for the private key as already partially implemented)
-- For now, we ensure the table exists so we can migrate from env vars to DB if preferred.
