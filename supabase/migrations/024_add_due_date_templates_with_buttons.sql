-- Migration: Agregar plantillas de recordatorio de vencimiento con botones
-- Crea dos plantillas separadas para préstamos de dinero y objetos
-- Incluye botones: Quick Reply ("Marcar como devuelto") y CTA URL ("Ver otras opciones")

-- 1. Insertar plantilla para préstamos de DINERO (con datos bancarios)
INSERT INTO templates (
  tenant_id,
  category,
  name,
  language,
  body,
  header,
  footer,
  variable_count,
  has_buttons,
  button_config,
  approval_status,
  hsm_status,
  meta_template_name,
  created_at,
  updated_at
) VALUES (
  NULL, -- Global template
  'due_date',
  'Recordatorio de vencimiento - Dinero',
  'es',
  '¡{{1}}! 👋 Hoy vence un préstamo que te hizo *{{3}}* el día *{{4}}*.

Monto: *{{2}}*
Concepto: _"{{5}}"_.

📋 *Datos de transferencia:*
```Nombre: {{6}}
RUT: {{7}}
Banco: {{8}}
Tipo: {{9}}
Cuenta: {{10}}
Email: {{11}}```

¿Todo listo para devolver? ✅',
  'Tienes un préstamo por vencer',
  NULL,
  11,
  true,
  jsonb_build_object(
    'quick_replies', jsonb_build_array(
      jsonb_build_object('text', 'Marcar como devuelto')
    ),
    'cta_url', jsonb_build_object(
      'text', 'Ver otras opciones',
      'url', '{{12}}' -- URL dinámica al detalle del préstamo
    )
  ),
  'approved',
  'APPROVED',
  'due_date_money_v1',
  now(),
  now()
)
ON CONFLICT (tenant_id, name)
WHERE tenant_id IS NULL
DO UPDATE SET
  body = EXCLUDED.body,
  header = EXCLUDED.header,
  variable_count = EXCLUDED.variable_count,
  has_buttons = EXCLUDED.has_buttons,
  button_config = EXCLUDED.button_config,
  approval_status = EXCLUDED.approval_status,
  hsm_status = EXCLUDED.hsm_status,
  meta_template_name = EXCLUDED.meta_template_name,
  updated_at = now();

-- 2. Insertar plantilla para préstamos de OBJETOS (sin datos bancarios)
INSERT INTO templates (
  tenant_id,
  category,
  name,
  language,
  body,
  header,
  footer,
  variable_count,
  has_buttons,
  button_config,
  approval_status,
  hsm_status,
  meta_template_name,
  created_at,
  updated_at
) VALUES (
  NULL, -- Global template
  'due_date',
  'Recordatorio de vencimiento - Objeto',
  'es',
  '¡{{1}}! 👋 Hoy vence la devolución de "{{2}}" que te prestó {{3}} el día {{4}} bajo el concepto "{{5}}". 📦

¿Todo listo para devolver? ✅',
  'Tienes un préstamo por vencer',
  NULL,
  5,
  true,
  jsonb_build_object(
    'quick_replies', jsonb_build_array(
      jsonb_build_object('text', 'Marcar como devuelto')
    ),
    'cta_url', jsonb_build_object(
      'text', 'Ver otras opciones',
      'url', '{{6}}' -- URL dinámica al detalle del préstamo
    )
  ),
  'approved',
  'APPROVED',
  'due_date_object_v1',
  now(),
  now()
)
ON CONFLICT (tenant_id, name)
WHERE tenant_id IS NULL
DO UPDATE SET
  body = EXCLUDED.body,
  header = EXCLUDED.header,
  variable_count = EXCLUDED.variable_count,
  has_buttons = EXCLUDED.has_buttons,
  button_config = EXCLUDED.button_config,
  approval_status = EXCLUDED.approval_status,
  hsm_status = EXCLUDED.hsm_status,
  meta_template_name = EXCLUDED.meta_template_name,
  updated_at = now();

-- 3. Comentario de documentación
COMMENT ON COLUMN templates.button_config IS 'Botones del template (JSONB):
- quick_replies: Array de botones Quick Reply
- cta_url: Botón Call-to-Action con URL dinámica
- cta_phone: Botón Call-to-Action con número de teléfono

Plantillas de recordatorio:
due_date_money_v1 (12 variables):
  {{1}} = Nombre del borrower (de su perfil)
  {{2}} = Monto formateado ($50.000)
  {{3}} = Nombre del lender (alias del contacto)
  {{4}} = Fecha de creación (14/10/25)
  {{5}} = Concepto/descripción
  {{6}} = Nombre completo del lender (de su perfil)
  {{7}} = RUT del lender
  {{8}} = Banco
  {{9}} = Tipo de cuenta
  {{10}} = Número de cuenta
  {{11}} = Email del lender
  {{12}} = URL al detalle del préstamo

due_date_object_v1 (6 variables):
  {{1}} = Nombre del borrower (de su perfil)
  {{2}} = Descripción del objeto
  {{3}} = Nombre del lender (alias del contacto)
  {{4}} = Fecha de creación (14/10/25)
  {{5}} = Concepto/descripción
  {{6}} = URL al detalle del préstamo';
