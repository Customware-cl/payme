-- Migración: Crear bucket de Storage para comprobantes de pago
-- Fecha: 2025-12-15
-- Descripción: Permite a los usuarios subir comprobantes de pago (imágenes y PDFs)

-- Crear bucket para comprobantes de pago
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'repayment-proofs',
  'repayment-proofs',
  true, -- público para permitir lectura sin autenticación
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Política: Permitir lectura pública de comprobantes
CREATE POLICY "Public can view proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'repayment-proofs');

-- Política: Permitir upload público de comprobantes
CREATE POLICY "Public can upload proofs"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'repayment-proofs');
