-- Script para insertar templates HSM una vez aprobados por Meta Business
-- Ejecutar después de que Meta apruebe los templates (24-48h)

-- Nota: Reemplazar {TEMPLATE_ID} con los IDs reales de Meta Business
-- Los IDs se obtienen desde Meta Business Manager después de la aprobación

-- Template 1: Recordatorio 24 horas antes
INSERT INTO templates (
    tenant_id,
    name,
    category,
    language,
    header,
    body,
    footer,
    buttons_config,
    meta_template_name,
    meta_template_id,
    approval_status,
    variables_count
) VALUES (
    NULL, -- Global template (disponible para todos los tenants)
    'Recordatorio 24h - Préstamo',
    'before_24h',
    'es_CL',
    '📅 Recordatorio de Préstamo',
    'Hola {{1}}, te recordamos que mañana {{2}} vence el préstamo de "{{3}}".

¿Todo listo para la devolución?',
    'PrestaBot - Tu asistente de préstamos',
    '[
        {"type": "QUICK_REPLY", "text": "Ya lo devolví"},
        {"type": "QUICK_REPLY", "text": "Reprogramar fecha"}
    ]'::jsonb,
    'loan_reminder_24h',
    '{TEMPLATE_ID_24H}', -- Reemplazar con ID real de Meta
    'approved',
    3
);

-- Template 2: Recordatorio día de vencimiento
INSERT INTO templates (
    tenant_id,
    name,
    category,
    language,
    body,
    buttons_config,
    meta_template_name,
    meta_template_id,
    approval_status,
    variables_count
) VALUES (
    NULL,
    'Recordatorio Vencimiento - Préstamo',
    'due_date',
    'es_CL',
    '🚨 Hola {{1}}, hoy {{2}} vence el préstamo de "{{3}}".

Por favor confirma cuando hayas hecho la devolución.',
    '[
        {"type": "QUICK_REPLY", "text": "Ya devolví"},
        {"type": "QUICK_REPLY", "text": "Necesito más tiempo"}
    ]'::jsonb,
    'loan_reminder_due',
    '{TEMPLATE_ID_DUE}', -- Reemplazar con ID real
    'approved',
    3
);

-- Template 3: Recordatorio vencido
INSERT INTO templates (
    tenant_id,
    name,
    category,
    language,
    body,
    buttons_config,
    meta_template_name,
    meta_template_id,
    approval_status,
    variables_count
) VALUES (
    NULL,
    'Recordatorio Vencido - Préstamo',
    'overdue',
    'es_CL',
    '⚠️ {{1}}, el préstamo de "{{2}}" venció el {{3}}.

Por favor contacta para resolver esta situación.',
    '[
        {"type": "QUICK_REPLY", "text": "Ya devolví"},
        {"type": "QUICK_REPLY", "text": "Reprogramar"},
        {"type": "QUICK_REPLY", "text": "Contactar"}
    ]'::jsonb,
    'loan_reminder_overdue',
    '{TEMPLATE_ID_OVERDUE}', -- Reemplazar con ID real
    'approved',
    3
);

-- Template 4: Servicio mensual
INSERT INTO templates (
    tenant_id,
    name,
    category,
    language,
    body,
    buttons_config,
    meta_template_name,
    meta_template_id,
    approval_status,
    variables_count
) VALUES (
    NULL,
    'Recordatorio Servicio Mensual',
    'monthly_service',
    'es_CL',
    '💳 Hola {{1}}, es momento del cobro de "{{2}}" por ${{3}}.

¿Confirmas el pago?',
    '[
        {"type": "QUICK_REPLY", "text": "Ya pagué"},
        {"type": "QUICK_REPLY", "text": "Pagar ahora"},
        {"type": "QUICK_REPLY", "text": "Reprogramar"}
    ]'::jsonb,
    'service_reminder_monthly',
    '{TEMPLATE_ID_SERVICE}', -- Reemplazar con ID real
    'approved',
    3
);

-- Template 5: Solicitud de opt-in
INSERT INTO templates (
    tenant_id,
    name,
    category,
    language,
    body,
    buttons_config,
    meta_template_name,
    meta_template_id,
    approval_status,
    variables_count
) VALUES (
    NULL,
    'Solicitud Opt-in',
    'opt_in',
    'es_CL',
    '👋 Hola {{1}}, soy tu asistente PrestaBot.

¿Deseas recibir recordatorios por WhatsApp para tus préstamos y servicios?',
    '[
        {"type": "QUICK_REPLY", "text": "Sí, acepto"},
        {"type": "QUICK_REPLY", "text": "No, gracias"}
    ]'::jsonb,
    'opt_in_request',
    '{TEMPLATE_ID_OPTIN}', -- Reemplazar con ID real
    'approved',
    1
);

-- Verificar inserción
SELECT
    name,
    category,
    meta_template_name,
    approval_status,
    variables_count
FROM templates
WHERE approval_status = 'approved'
ORDER BY category;

-- Comentarios para ejecución:
-- 1. Esperar aprobación de Meta Business (24-48h)
-- 2. Obtener Template IDs desde Meta Business Manager
-- 3. Reemplazar {TEMPLATE_ID_*} con IDs reales
-- 4. Ejecutar este script contra la base de datos