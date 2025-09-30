-- Migración 009: Fix UUID generation en conversation_states
-- Corregir uso de uuid_generate_v4() por gen_random_uuid()

-- =====================================================
-- FIX UUID FUNCTION
-- =====================================================

-- Cambiar default de la columna id en conversation_states
ALTER TABLE conversation_states
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verificar y habilitar la extensión uuid-ossp si no está habilitada
-- (solo por si acaso, pero gen_random_uuid() es nativo de PostgreSQL 13+)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Comentario
COMMENT ON TABLE conversation_states IS 'Estados de conversación con UUID corregido para Supabase';

-- Fin de migración