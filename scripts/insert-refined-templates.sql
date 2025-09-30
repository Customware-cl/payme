-- Script para insertar las 7 plantillas HSM refinadas
-- Con copys exactos según especificaciones del usuario

-- Limpiar plantillas existentes (solo las del sistema)
DELETE FROM templates WHERE tenant_id IS NULL;

-- A) Consentimiento
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
    variable_count
) VALUES (
    NULL, -- Global template
    'Solicitud de Consentimiento',
    'opt_in',
    'es',
    'Hola {{1}}, {{2}} quiere enviarte recordatorios por WhatsApp sobre {{3}}. ¿Aceptas?',
    '[{"type": "QUICK_REPLY", "text": "Aceptar"}]'::jsonb,
    'recordatorio_optin_v1',
    NULL, -- Se llenará con ID real de Meta Business cuando sea aprobado
    'pending', -- Cambiar a 'approved' cuando Meta apruebe
    3
);

-- B) Préstamos - 24 horas antes
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
    variable_count
) VALUES (
    NULL,
    'Recordatorio 24h Préstamo',
    'before_24h',
    'es',
    'Recordatorio: mañana {{1}} debes devolver {{2}} a {{3}}.',
    '[
        {"type": "QUICK_REPLY", "text": "Confirmaré al devolver"},
        {"type": "QUICK_REPLY", "text": "Reprogramar"}
    ]'::jsonb,
    'devolucion_24h_v1',
    NULL,
    'pending',
    3
);

-- B) Préstamos - Día D
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
    variable_count
) VALUES (
    NULL,
    'Recordatorio Día Vencimiento',
    'due_date',
    'es',
    'Hoy {{1}} vence la devolución de {{2}}. ¿Listo?',
    '[
        {"type": "QUICK_REPLY", "text": "Ya lo devolví"},
        {"type": "QUICK_REPLY", "text": "Reprogramar"}
    ]'::jsonb,
    'devolucion_hoy_v1',
    NULL,
    'pending',
    2
);

-- B) Préstamos - Vencido
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
    variable_count
) VALUES (
    NULL,
    'Recordatorio Préstamo Vencido',
    'overdue',
    'es',
    'La devolución de {{1}} venció el {{2}}. ¿Qué deseas hacer?',
    '[
        {"type": "QUICK_REPLY", "text": "Reprogramar"},
        {"type": "QUICK_REPLY", "text": "Ya lo devolví"}
    ]'::jsonb,
    'devolucion_vencida_v1',
    NULL,
    'pending',
    2
);

-- C) Servicios mensuales - Previo (72h antes)
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
    variable_count
) VALUES (
    NULL,
    'Aviso Previo Cobro Mensual',
    'monthly_service_preview',
    'es',
    '{{1}}: tu servicio de {{2}} se cobrará el {{3}}.',
    '[
        {"type": "QUICK_REPLY", "text": "Pagar ahora"},
        {"type": "QUICK_REPLY", "text": "Pagado efectivo"},
        {"type": "QUICK_REPLY", "text": "Reagendar"}
    ]'::jsonb,
    'cobro_mensual_previo_v1',
    NULL,
    'pending',
    3
);

-- C) Servicios mensuales - Día D
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
    variable_count
) VALUES (
    NULL,
    'Cobro Mensual Día D',
    'monthly_service',
    'es',
    'Hoy {{1}} corresponde el cobro de {{2}}.',
    '[
        {"type": "QUICK_REPLY", "text": "Pagar ahora"},
        {"type": "QUICK_REPLY", "text": "Pagado efectivo"},
        {"type": "QUICK_REPLY", "text": "Reagendar"}
    ]'::jsonb,
    'cobro_mensual_diaD_v1',
    NULL,
    'pending',
    2
);

-- C) Servicios mensuales - Vencido
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
    variable_count
) VALUES (
    NULL,
    'Cobro Mensual Vencido',
    'monthly_service_overdue',
    'es',
    'El cobro de {{1}} quedó pendiente desde {{2}}. ¿Cómo deseas proceder?',
    '[
        {"type": "QUICK_REPLY", "text": "Pagar ahora"},
        {"type": "QUICK_REPLY", "text": "Reagendar"}
    ]'::jsonb,
    'cobro_mensual_vencido_v1',
    NULL,
    'pending',
    2
);

-- Verificar inserción
SELECT
    'Plantillas insertadas:' as info,
    COUNT(*) as total,
    COUNT(CASE WHEN category LIKE '%monthly%' THEN 1 END) as servicios,
    COUNT(CASE WHEN category IN ('before_24h', 'due_date', 'overdue') THEN 1 END) as prestamos,
    COUNT(CASE WHEN category = 'opt_in' THEN 1 END) as opt_in
FROM templates
WHERE tenant_id IS NULL;

-- Mostrar plantillas creadas
SELECT
    name,
    category,
    meta_template_name,
    variable_count,
    LENGTH(body) as body_length
FROM templates
WHERE tenant_id IS NULL
ORDER BY category, name;

-- Ejemplos de variables para cada plantilla (para documentación)
WITH template_examples AS (
    SELECT
        meta_template_name,
        CASE meta_template_name
            WHEN 'recordatorio_optin_v1' THEN 'Variables: {{1}}=María, {{2}}=Ferretería Los Robles, {{3}}=préstamos y devoluciones'
            WHEN 'devolucion_24h_v1' THEN 'Variables: {{1}}=18/09 10:00, {{2}}=Taladro Bosch, {{3}}=Juan'
            WHEN 'devolucion_hoy_v1' THEN 'Variables: {{1}}=10:00, {{2}}=Taladro Bosch'
            WHEN 'devolucion_vencida_v1' THEN 'Variables: {{1}}=Taladro Bosch, {{2}}=19/09'
            WHEN 'cobro_mensual_previo_v1' THEN 'Variables: {{1}}=Jardines Verdes, {{2}}=septiembre, {{3}}=01/09'
            WHEN 'cobro_mensual_diaD_v1' THEN 'Variables: {{1}}=10:00, {{2}}=Jardinería septiembre'
            WHEN 'cobro_mensual_vencido_v1' THEN 'Variables: {{1}}=Jardinería septiembre, {{2}}=01/09'
            ELSE 'Sin ejemplo'
        END as ejemplo_variables
    FROM templates
    WHERE tenant_id IS NULL
)
SELECT
    'Ejemplos de uso:' as info,
    meta_template_name,
    ejemplo_variables
FROM template_examples
ORDER BY meta_template_name;

-- Comentario final
SELECT 'Templates refinados insertados correctamente - Listos para aprobación en Meta Business' as status;