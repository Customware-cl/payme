-- Migración 034: Deprecación de tabla contacts - FASE 4 (Cleanup)
-- 🔴 IRREVERSIBLE: Elimina tabla contacts y columnas legacy
-- 🔴 NO APLICAR hasta confirmar que FASE 3 funciona correctamente en producción (otra semana)

-- =====================================================
-- PRE-REQUISITOS (VALIDAR ANTES DE EJECUTAR)
-- =====================================================

DO $$
DECLARE
    v_legacy_usage INTEGER;
BEGIN
    -- Verificar que NO hay código usando columnas legacy
    -- (esto debe validarse manualmente en los logs)

    RAISE NOTICE '=== VALIDACIÓN PRE-CLEANUP ===';
    RAISE NOTICE '';
    RAISE NOTICE 'ANTES de ejecutar esta migración, verificar:';
    RAISE NOTICE '1. ✓ FASE 3 aplicada y funcionando por >7 días';
    RAISE NOTICE '2. ✓ Logs NO muestran errores de FK tenant_contact_id';
    RAISE NOTICE '3. ✓ Código NO referencia tabla contacts';
    RAISE NOTICE '4. ✓ Código NO usa contact_id para queries';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ESTA MIGRACIÓN ES IRREVERSIBLE';
    RAISE NOTICE '⚠️  No hay rollback después de ejecutar';
    RAISE NOTICE '';

    -- Pausa de seguridad (descomentar para production)
    -- RAISE EXCEPTION 'SAFETY CHECK: Leer validaciones arriba antes de ejecutar. Comentar esta línea si estás seguro.';
END $$;

-- =====================================================
-- 1. DROP COLUMNAS CONTACT_ID (LEGACY)
-- =====================================================

-- whatsapp_messages
ALTER TABLE whatsapp_messages
DROP COLUMN IF EXISTS contact_id;

-- events
ALTER TABLE events
DROP COLUMN IF EXISTS contact_id;

-- messages
ALTER TABLE messages
DROP COLUMN IF EXISTS contact_id;

-- owner_notifications
ALTER TABLE owner_notifications
DROP COLUMN IF EXISTS contact_id;

-- message_queue
ALTER TABLE message_queue
DROP COLUMN IF EXISTS contact_id;

-- conversation_states
ALTER TABLE conversation_states
DROP COLUMN IF EXISTS contact_id;

-- telegram_conversation_states
ALTER TABLE telegram_conversation_states
DROP COLUMN IF EXISTS contact_id;

-- agreements (columnas borrower y lender legacy)
ALTER TABLE agreements
DROP COLUMN IF EXISTS contact_id;

ALTER TABLE agreements
DROP COLUMN IF EXISTS lender_contact_id;

-- =====================================================
-- 2. DROP POLICIES Y TRIGGERS DE CONTACTS
-- =====================================================

-- Drop RLS policies (de migración 002)
DROP POLICY IF EXISTS "Users can view contacts from their tenant" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their tenant" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts from their tenant" ON contacts;
DROP POLICY IF EXISTS "Admins can delete contacts" ON contacts;
DROP POLICY IF EXISTS "Service role full access contacts" ON contacts;

-- Drop trigger (de migración 001)
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;

-- =====================================================
-- 3. DROP TABLA CONTACTS (IRREVERSIBLE)
-- =====================================================

-- Último checkpoint antes de destrucción
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔴🔴🔴 ÚLTIMO CHECKPOINT 🔴🔴🔴';
    RAISE NOTICE 'A punto de eliminar tabla contacts...';
    RAISE NOTICE 'Esta operación NO tiene rollback';
    RAISE NOTICE '';

    -- Guardar snapshot de contactos para auditoría
    RAISE NOTICE 'Contactos en tabla legacy antes de eliminación:';
    RAISE NOTICE 'Total: %', (SELECT COUNT(*) FROM contacts);
END $$;

-- DROP TABLE CASCADE elimina también:
-- - Foreign keys desde contacts (contacts.tenant_contact_id → tenant_contacts)
-- - Foreign keys desde contacts (contacts.contact_profile_id → contact_profiles)
DROP TABLE IF EXISTS contacts CASCADE;

-- =====================================================
-- 4. LIMPIAR METADATA Y COMENTARIOS
-- =====================================================

-- Actualizar comentarios para reflejar arquitectura final
COMMENT ON TABLE tenant_contacts IS
'Relación many-to-many entre tenants y contact_profiles. ARQUITECTURA FINAL (contacts legacy eliminada en FASE 4).';

COMMENT ON TABLE contact_profiles IS
'Perfiles globales de contactos sin duplicados. Identidad única compartida entre tenants.';

COMMENT ON COLUMN agreements.tenant_contact_id IS
'ID del tenant_contact (borrower). Columna única después de deprecación legacy (FASE 4).';

COMMENT ON COLUMN agreements.lender_tenant_contact_id IS
'ID del tenant_contact (lender). Columna única después de deprecación legacy (FASE 4).';

-- =====================================================
-- 5. VALIDAR LIMPIEZA FINAL
-- =====================================================

DO $$
DECLARE
    v_contacts_exists BOOLEAN;
    v_legacy_columns_exist INTEGER;
BEGIN
    -- Verificar que tabla contacts NO existe
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'contacts'
    ) INTO v_contacts_exists;

    -- Contar columnas contact_id restantes (debería ser 0)
    SELECT COUNT(*)
    INTO v_legacy_columns_exist
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'contact_id'
      AND table_name NOT IN ('tenant_contacts');  -- Esta tiene contact_id válido (tenant_contact_id)

    RAISE NOTICE '=== FASE 4: Cleanup Completado ===';
    RAISE NOTICE '';

    IF v_contacts_exists THEN
        RAISE WARNING '⚠️  Tabla contacts aún existe (no se pudo eliminar)';
    ELSE
        RAISE NOTICE '✓ Tabla contacts eliminada correctamente';
    END IF;

    RAISE NOTICE '✓ Columnas contact_id legacy restantes: %', v_legacy_columns_exist;
    RAISE NOTICE '';
    RAISE NOTICE '🎉 MIGRACIÓN COMPLETA';
    RAISE NOTICE 'Sistema ahora usa exclusivamente:';
    RAISE NOTICE '  - tenant_contacts (relaciones tenant-contacto)';
    RAISE NOTICE '  - contact_profiles (identidad global)';
    RAISE NOTICE '';
    RAISE NOTICE '❌ NO HAY ROLLBACK POSIBLE';
    RAISE NOTICE 'Tabla contacts eliminada permanentemente.';
END $$;

-- =====================================================
-- ROLLBACK: IMPOSIBLE
-- =====================================================
-- Esta migración es IRREVERSIBLE.
-- Para restaurar la tabla contacts necesitarías:
-- 1. Recrear estructura completa de tabla contacts
-- 2. Recrear todos los RLS policies
-- 3. Recrear triggers
-- 4. Migrar datos de vuelta desde tenant_contacts
-- 5. Re-agregar columnas contact_id a todas las tablas
-- 6. Backfill datos legacy
-- 7. Rollback código de aplicación
--
-- Esto NO es práctico. Por eso esta fase requiere validación exhaustiva.
