-- Migración: Crear bucket de Storage para imágenes de préstamos
-- Fecha: 2025-10-14
-- Descripción: Permite a los usuarios subir imágenes opcionales al crear préstamos

-- Crear bucket para imágenes de préstamos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'loan-images',
  'loan-images',
  true, -- público para permitir lectura sin autenticación
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Política: Permitir lectura pública de imágenes
CREATE POLICY "Public read access for loan images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'loan-images');

-- Política: Permitir upload a usuarios autenticados o anónimos
-- (En este caso, como el formulario web no requiere autenticación,
-- permitimos uploads anónimos pero validamos en el edge function)
CREATE POLICY "Allow public uploads to loan images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'loan-images');

-- Política: Permitir actualización/eliminación solo al owner
CREATE POLICY "Allow update own loan images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'loan-images' AND owner = auth.uid())
WITH CHECK (bucket_id = 'loan-images' AND owner = auth.uid());

CREATE POLICY "Allow delete own loan images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'loan-images' AND owner = auth.uid());
