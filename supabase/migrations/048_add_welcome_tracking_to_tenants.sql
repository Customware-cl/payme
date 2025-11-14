-- Agregar campos para tracking de mensaje de bienvenida y origen de usuarios

-- Campo para trackear si ya se envió mensaje de bienvenida
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS welcome_message_sent BOOLEAN DEFAULT FALSE NOT NULL;

-- Campo para trackear quién invitó a este usuario (nullable)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS invited_by_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

-- Campo para trackear el tipo de adquisición del usuario
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS acquisition_type TEXT CHECK (acquisition_type IN ('organic', 'invited'));

-- Índice para mejorar queries de análisis de referidos
CREATE INDEX IF NOT EXISTS idx_tenants_invited_by ON tenants(invited_by_tenant_id) WHERE invited_by_tenant_id IS NOT NULL;

-- Índice para queries de análisis de adquisición
CREATE INDEX IF NOT EXISTS idx_tenants_acquisition_type ON tenants(acquisition_type) WHERE acquisition_type IS NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN tenants.welcome_message_sent IS 'Flag que indica si ya se envió el mensaje de bienvenida a este tenant. Se marca como true después del primer envío.';
COMMENT ON COLUMN tenants.invited_by_tenant_id IS 'ID del tenant que invitó a este usuario. NULL si llegó orgánicamente.';
COMMENT ON COLUMN tenants.acquisition_type IS 'Tipo de adquisición: organic (llegó por cuenta propia) o invited (invitado por otro usuario).';
