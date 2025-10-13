-- Migration: Agregar datos bancarios a recordatorio de día de vencimiento
-- Actualiza la plantilla "due_date" para incluir información bancaria del prestamista

-- Actualizar plantilla existente de due_date con 8 variables
UPDATE templates
SET
  body = '⚡ {{1}}, hoy vence la devolución de {{2}}!

💳 Datos para transferencia:
👤 {{3}}
🆔 RUT: {{4}}
🏦 Banco: {{5}}
📋 Tipo: {{6}}
💰 Cuenta: {{7}}
📧 Email: {{8}}

¿Todo listo para devolver?',
  variable_count = 8,
  updated_at = now()
WHERE category = 'due_date'
  AND tenant_id IS NULL;

-- Comentario para documentación
COMMENT ON COLUMN templates.body IS 'Cuerpo del mensaje con variables:
due_date:
  {{1}} = Nombre del contacto (borrower)
  {{2}} = Item/monto prestado
  {{3}} = Nombre completo del prestamista
  {{4}} = RUT del prestamista
  {{5}} = Banco del prestamista
  {{6}} = Tipo de cuenta
  {{7}} = Número de cuenta
  {{8}} = Email del prestamista';
