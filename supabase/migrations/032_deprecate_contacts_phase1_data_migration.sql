-- Migración 032: Deprecación de tabla contacts - FASE 1 (Data Migration)
-- Agrega columnas tenant_contact_id a tablas legacy y backfill datos
-- ROLLBACK SAFE: Código legacy sigue funcionando, columnas nuevas son nullable

-- =====================================================
-- 1. AGREGAR COLUMNAS TENANT_CONTACT_ID
-- =====================================================

-- whatsapp_messages (871 referencias)
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS tenant_contact_id UUID;

-- events (211 referencias)
ALTER TABLE events ADD COLUMN IF NOT EXISTS tenant_contact_id UUID;

-- messages (12 referencias)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tenant_contact_id UUID;

-- owner_notifications (11 referencias)
ALTER TABLE owner_notifications ADD COLUMN IF NOT EXISTS tenant_contact_id UUID;

-- message_queue (4 referencias)
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS tenant_contact_id UUID;

-- conversation_states (0 referencias según query, pero migrar por completitud)
ALTER TABLE conversation_states ADD COLUMN IF NOT EXISTS tenant_contact_id UUID;

-- telegram_conversation_states (0 referencias según query, pero migrar por completitud)
ALTER TABLE telegram_conversation_states ADD COLUMN IF NOT EXISTS tenant_contact_id UUID;

-- =====================================================
-- 2. BACKFILL DATOS USANDO MAPEO EXISTENTE
-- =====================================================
-- Usamos contacts.tenant_contact_id (creado en migration 022)

-- whatsapp_messages
UPDATE whatsapp_messages wm
SET tenant_contact_id = c.tenant_contact_id
FROM contacts c
WHERE wm.contact_id = c.id
  AND wm.tenant_contact_id IS NULL;

-- events
UPDATE events e
SET tenant_contact_id = c.tenant_contact_id
FROM contacts c
WHERE e.contact_id = c.id
  AND e.tenant_contact_id IS NULL;

-- messages
UPDATE messages m
SET tenant_contact_id = c.tenant_contact_id
FROM contacts c
WHERE m.contact_id = c.id
  AND m.tenant_contact_id IS NULL;

-- owner_notifications
UPDATE owner_notifications o
SET tenant_contact_id = c.tenant_contact_id
FROM contacts c
WHERE o.contact_id = c.id
  AND o.tenant_contact_id IS NULL;

-- message_queue
UPDATE message_queue mq
SET tenant_contact_id = c.tenant_contact_id
FROM contacts c
WHERE mq.contact_id = c.id
  AND mq.tenant_contact_id IS NULL;

-- conversation_states
UPDATE conversation_states cs
SET tenant_contact_id = c.tenant_contact_id
FROM contacts c
WHERE cs.contact_id = c.id
  AND cs.tenant_contact_id IS NULL;

-- telegram_conversation_states
UPDATE telegram_conversation_states tcs
SET tenant_contact_id = c.tenant_contact_id
FROM contacts c
WHERE tcs.contact_id = c.id
  AND tcs.tenant_contact_id IS NULL;

-- =====================================================
-- 3. CREAR ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant_contact_id
ON whatsapp_messages(tenant_contact_id)
WHERE tenant_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_tenant_contact_id
ON events(tenant_contact_id)
WHERE tenant_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_tenant_contact_id
ON messages(tenant_contact_id)
WHERE tenant_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_owner_notifications_tenant_contact_id
ON owner_notifications(tenant_contact_id)
WHERE tenant_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_queue_tenant_contact_id
ON message_queue(tenant_contact_id)
WHERE tenant_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_states_tenant_contact_id
ON conversation_states(tenant_contact_id)
WHERE tenant_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_conversation_states_tenant_contact_id
ON telegram_conversation_states(tenant_contact_id)
WHERE tenant_contact_id IS NOT NULL;

-- =====================================================
-- 4. VALIDAR INTEGRIDAD DE MIGRACIÓN
-- =====================================================

DO $$
DECLARE
    v_whatsapp_messages_null INTEGER;
    v_events_null INTEGER;
    v_messages_null INTEGER;
    v_owner_notifications_null INTEGER;
    v_message_queue_null INTEGER;
    v_conversation_states_null INTEGER;
    v_telegram_conversation_states_null INTEGER;
    v_total_records INTEGER;
    v_migrated_records INTEGER;
BEGIN
    -- Contar registros con tenant_contact_id NULL (fallaron migración)
    SELECT COUNT(*) INTO v_whatsapp_messages_null
    FROM whatsapp_messages WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL;

    SELECT COUNT(*) INTO v_events_null
    FROM events WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL;

    SELECT COUNT(*) INTO v_messages_null
    FROM messages WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL;

    SELECT COUNT(*) INTO v_owner_notifications_null
    FROM owner_notifications WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL;

    SELECT COUNT(*) INTO v_message_queue_null
    FROM message_queue WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL;

    SELECT COUNT(*) INTO v_conversation_states_null
    FROM conversation_states WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL;

    SELECT COUNT(*) INTO v_telegram_conversation_states_null
    FROM telegram_conversation_states WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL;

    -- Contar totales migrados exitosamente
    SELECT
        (SELECT COUNT(*) FROM whatsapp_messages WHERE tenant_contact_id IS NOT NULL) +
        (SELECT COUNT(*) FROM events WHERE tenant_contact_id IS NOT NULL) +
        (SELECT COUNT(*) FROM messages WHERE tenant_contact_id IS NOT NULL) +
        (SELECT COUNT(*) FROM owner_notifications WHERE tenant_contact_id IS NOT NULL) +
        (SELECT COUNT(*) FROM message_queue WHERE tenant_contact_id IS NOT NULL) +
        (SELECT COUNT(*) FROM conversation_states WHERE tenant_contact_id IS NOT NULL) +
        (SELECT COUNT(*) FROM telegram_conversation_states WHERE tenant_contact_id IS NOT NULL)
    INTO v_migrated_records;

    -- Reportar resultados
    RAISE NOTICE '=== FASE 1: Data Migration Completada ===';
    RAISE NOTICE 'Registros migrados exitosamente: %', v_migrated_records;
    RAISE NOTICE '';
    RAISE NOTICE 'Registros pendientes de migración (contact_id sin mapping):';
    RAISE NOTICE '  whatsapp_messages: %', v_whatsapp_messages_null;
    RAISE NOTICE '  events: %', v_events_null;
    RAISE NOTICE '  messages: %', v_messages_null;
    RAISE NOTICE '  owner_notifications: %', v_owner_notifications_null;
    RAISE NOTICE '  message_queue: %', v_message_queue_null;
    RAISE NOTICE '  conversation_states: %', v_conversation_states_null;
    RAISE NOTICE '  telegram_conversation_states: %', v_telegram_conversation_states_null;

    -- Advertir si hay registros sin migrar
    IF (v_whatsapp_messages_null + v_events_null + v_messages_null +
        v_owner_notifications_null + v_message_queue_null +
        v_conversation_states_null + v_telegram_conversation_states_null) > 0 THEN
        RAISE WARNING 'Algunos registros no pudieron migrarse. Verificar integridad de contacts.tenant_contact_id';
    ELSE
        RAISE NOTICE '✓ Todos los registros con contact_id fueron migrados exitosamente';
    END IF;
END $$;

-- =====================================================
-- 5. COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON COLUMN whatsapp_messages.tenant_contact_id IS
'ID del tenant_contact (modern). Reemplaza contact_id (legacy). FASE 1 de migración: nullable, FASE 3: NOT NULL.';

COMMENT ON COLUMN events.tenant_contact_id IS
'ID del tenant_contact (modern). Reemplaza contact_id (legacy). FASE 1 de migración: nullable, FASE 3: NOT NULL.';

COMMENT ON COLUMN messages.tenant_contact_id IS
'ID del tenant_contact (modern). Reemplaza contact_id (legacy). FASE 1 de migración: nullable, FASE 3: NOT NULL.';

COMMENT ON COLUMN owner_notifications.tenant_contact_id IS
'ID del tenant_contact (modern). Reemplaza contact_id (legacy). FASE 1 de migración: nullable, FASE 3: NOT NULL.';

COMMENT ON COLUMN message_queue.tenant_contact_id IS
'ID del tenant_contact (modern). Reemplaza contact_id (legacy). FASE 1 de migración: nullable, FASE 3: NOT NULL.';

COMMENT ON COLUMN conversation_states.tenant_contact_id IS
'ID del tenant_contact (modern). Reemplaza contact_id (legacy). FASE 1 de migración: nullable, FASE 3: NOT NULL.';

COMMENT ON COLUMN telegram_conversation_states.tenant_contact_id IS
'ID del tenant_contact (modern). Reemplaza contact_id (legacy). FASE 1 de migración: nullable, FASE 3: NOT NULL.';

-- =====================================================
-- ROLLBACK (si es necesario)
-- =====================================================
-- Para hacer rollback de esta migración:
/*
DROP INDEX IF EXISTS idx_whatsapp_messages_tenant_contact_id;
DROP INDEX IF EXISTS idx_events_tenant_contact_id;
DROP INDEX IF EXISTS idx_messages_tenant_contact_id;
DROP INDEX IF EXISTS idx_owner_notifications_tenant_contact_id;
DROP INDEX IF EXISTS idx_message_queue_tenant_contact_id;
DROP INDEX IF EXISTS idx_conversation_states_tenant_contact_id;
DROP INDEX IF EXISTS idx_telegram_conversation_states_tenant_contact_id;

ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS tenant_contact_id;
ALTER TABLE events DROP COLUMN IF EXISTS tenant_contact_id;
ALTER TABLE messages DROP COLUMN IF EXISTS tenant_contact_id;
ALTER TABLE owner_notifications DROP COLUMN IF EXISTS tenant_contact_id;
ALTER TABLE message_queue DROP COLUMN IF EXISTS tenant_contact_id;
ALTER TABLE conversation_states DROP COLUMN IF EXISTS tenant_contact_id;
ALTER TABLE telegram_conversation_states DROP COLUMN IF EXISTS tenant_contact_id;
*/
