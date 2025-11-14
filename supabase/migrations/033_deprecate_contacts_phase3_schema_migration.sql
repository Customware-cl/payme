-- Migración 033: Deprecación de tabla contacts - FASE 3 (Schema Migration)
-- ⚠️ PUNTO DE NO RETORNO: Agrega FKs y constraints NOT NULL
-- ⚠️ NO APLICAR hasta confirmar que FASE 2 funciona correctamente en producción (24-48h)

-- =====================================================
-- PRE-REQUISITOS (VALIDAR ANTES DE EJECUTAR)
-- =====================================================

DO $$
DECLARE
    v_nulls_count INTEGER;
BEGIN
    -- Verificar que NO haya registros con tenant_contact_id NULL
    SELECT
        (SELECT COUNT(*) FROM whatsapp_messages WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL) +
        (SELECT COUNT(*) FROM events WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL) +
        (SELECT COUNT(*) FROM messages WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL) +
        (SELECT COUNT(*) FROM owner_notifications WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL) +
        (SELECT COUNT(*) FROM message_queue WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL) +
        (SELECT COUNT(*) FROM conversation_states WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL) +
        (SELECT COUNT(*) FROM telegram_conversation_states WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL)
    INTO v_nulls_count;

    IF v_nulls_count > 0 THEN
        RAISE EXCEPTION 'PRE-REQUISITO FALLIDO: % registros tienen tenant_contact_id NULL. Ejecutar FASE 1 primero.', v_nulls_count;
    END IF;

    RAISE NOTICE '✓ Pre-requisitos validados: Todos los registros tienen tenant_contact_id';
END $$;

-- =====================================================
-- 1. AGREGAR FOREIGN KEYS A TENANT_CONTACTS
-- =====================================================

-- whatsapp_messages
ALTER TABLE whatsapp_messages
ADD CONSTRAINT fk_whatsapp_messages_tenant_contact
FOREIGN KEY (tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE CASCADE;

-- events
ALTER TABLE events
ADD CONSTRAINT fk_events_tenant_contact
FOREIGN KEY (tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE CASCADE;

-- messages
ALTER TABLE messages
ADD CONSTRAINT fk_messages_tenant_contact
FOREIGN KEY (tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE CASCADE;

-- owner_notifications
ALTER TABLE owner_notifications
ADD CONSTRAINT fk_owner_notifications_tenant_contact
FOREIGN KEY (tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE SET NULL;

-- message_queue
ALTER TABLE message_queue
ADD CONSTRAINT fk_message_queue_tenant_contact
FOREIGN KEY (tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE CASCADE;

-- conversation_states
ALTER TABLE conversation_states
ADD CONSTRAINT fk_conversation_states_tenant_contact
FOREIGN KEY (tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE CASCADE;

-- telegram_conversation_states
ALTER TABLE telegram_conversation_states
ADD CONSTRAINT fk_telegram_conversation_states_tenant_contact
FOREIGN KEY (tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE CASCADE;

-- =====================================================
-- 2. HACER TENANT_CONTACT_ID NOT NULL
-- =====================================================

-- whatsapp_messages
ALTER TABLE whatsapp_messages
ALTER COLUMN tenant_contact_id SET NOT NULL;

-- events
ALTER TABLE events
ALTER COLUMN tenant_contact_id SET NOT NULL;

-- messages
ALTER TABLE messages
ALTER COLUMN tenant_contact_id SET NOT NULL;

-- owner_notifications (permitir NULL para notificaciones sin contacto)
-- NO cambiar a NOT NULL

-- message_queue
ALTER TABLE message_queue
ALTER COLUMN tenant_contact_id SET NOT NULL;

-- conversation_states
ALTER TABLE conversation_states
ALTER COLUMN tenant_contact_id SET NOT NULL;

-- telegram_conversation_states
ALTER TABLE telegram_conversation_states
ALTER COLUMN tenant_contact_id SET NOT NULL;

-- =====================================================
-- 3. DEPRECAR COLUMNAS LEGACY EN AGREEMENTS
-- =====================================================

-- Validar que todas las filas tienen valores modern
DO $$
DECLARE
    v_missing_modern INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_missing_modern
    FROM agreements
    WHERE tenant_contact_id IS NULL OR lender_tenant_contact_id IS NULL;

    IF v_missing_modern > 0 THEN
        RAISE WARNING 'ADVERTENCIA: % agreements tienen columnas modern NULL. Revisar migración 022.', v_missing_modern;
        -- No fallar, solo advertir (pueden ser agreements sin lender)
    END IF;
END $$;

-- Hacer NOT NULL las columnas modern
ALTER TABLE agreements
ALTER COLUMN tenant_contact_id SET NOT NULL;

-- lender_tenant_contact_id puede ser NULL (préstamos donde el owner es el lender)
-- NO cambiar a NOT NULL

-- Drop constraints legacy (si existen)
ALTER TABLE agreements
DROP CONSTRAINT IF EXISTS agreements_contact_id_fkey;

ALTER TABLE agreements
DROP CONSTRAINT IF EXISTS agreements_lender_contact_id_fkey;

-- =====================================================
-- 4. ACTUALIZAR COMENTARIOS
-- =====================================================

COMMENT ON COLUMN whatsapp_messages.tenant_contact_id IS
'ID del tenant_contact (modern). FASE 3: NOT NULL + FK enforced.';

COMMENT ON COLUMN events.tenant_contact_id IS
'ID del tenant_contact (modern). FASE 3: NOT NULL + FK enforced.';

COMMENT ON COLUMN messages.tenant_contact_id IS
'ID del tenant_contact (modern). FASE 3: NOT NULL + FK enforced.';

COMMENT ON COLUMN message_queue.tenant_contact_id IS
'ID del tenant_contact (modern). FASE 3: NOT NULL + FK enforced.';

COMMENT ON COLUMN conversation_states.tenant_contact_id IS
'ID del tenant_contact (modern). FASE 3: NOT NULL + FK enforced.';

COMMENT ON COLUMN telegram_conversation_states.tenant_contact_id IS
'ID del tenant_contact (modern). FASE 3: NOT NULL + FK enforced.';

COMMENT ON COLUMN agreements.contact_id IS
'DEPRECATED (FASE 3): Usar tenant_contact_id. Será eliminada en FASE 4.';

COMMENT ON COLUMN agreements.lender_contact_id IS
'DEPRECATED (FASE 3): Usar lender_tenant_contact_id. Será eliminada en FASE 4.';

-- =====================================================
-- 5. VALIDAR MIGRACIÓN
-- =====================================================

DO $$
DECLARE
    v_fk_count INTEGER;
BEGIN
    -- Contar FKs creados
    SELECT COUNT(*)
    INTO v_fk_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%_tenant_contact';

    RAISE NOTICE '=== FASE 3: Schema Migration Completada ===';
    RAISE NOTICE 'Foreign Keys creados: %', v_fk_count;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ PUNTO DE NO RETORNO ALCANZADO';
    RAISE NOTICE 'Las columnas tenant_contact_id ahora tienen:';
    RAISE NOTICE '  - Foreign Keys a tenant_contacts';
    RAISE NOTICE '  - Constraint NOT NULL';
    RAISE NOTICE '';
    RAISE NOTICE 'Rollback requiere migración inversa completa.';
    RAISE NOTICE 'Sistema ahora depende 100%% de tenant_contacts.';
END $$;

-- =====================================================
-- ROLLBACK (requiere migración inversa)
-- =====================================================
-- Para hacer rollback de esta migración:
/*
-- 1. Remover NOT NULL constraints
ALTER TABLE whatsapp_messages ALTER COLUMN tenant_contact_id DROP NOT NULL;
ALTER TABLE events ALTER COLUMN tenant_contact_id DROP NOT NULL;
ALTER TABLE messages ALTER COLUMN tenant_contact_id DROP NOT NULL;
ALTER TABLE message_queue ALTER COLUMN tenant_contact_id DROP NOT NULL;
ALTER TABLE conversation_states ALTER COLUMN tenant_contact_id DROP NOT NULL;
ALTER TABLE telegram_conversation_states ALTER COLUMN tenant_contact_id DROP NOT NULL;
ALTER TABLE agreements ALTER COLUMN tenant_contact_id DROP NOT NULL;

-- 2. Remover Foreign Keys
ALTER TABLE whatsapp_messages DROP CONSTRAINT fk_whatsapp_messages_tenant_contact;
ALTER TABLE events DROP CONSTRAINT fk_events_tenant_contact;
ALTER TABLE messages DROP CONSTRAINT fk_messages_tenant_contact;
ALTER TABLE owner_notifications DROP CONSTRAINT fk_owner_notifications_tenant_contact;
ALTER TABLE message_queue DROP CONSTRAINT fk_message_queue_tenant_contact;
ALTER TABLE conversation_states DROP CONSTRAINT fk_conversation_states_tenant_contact;
ALTER TABLE telegram_conversation_states DROP CONSTRAINT fk_telegram_conversation_states_tenant_contact;

-- 3. Restaurar FKs legacy en agreements (si es necesario)
-- (requiere que columnas contact_id aún existan)
*/
