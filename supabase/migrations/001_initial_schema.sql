-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Habilitar RLS por defecto
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Tipos personalizados
CREATE TYPE agreement_type AS ENUM ('loan', 'service');
CREATE TYPE agreement_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE reminder_type AS ENUM ('before_24h', 'due_date', 'overdue');
CREATE TYPE reminder_recipients AS ENUM ('owner', 'contact', 'both');
CREATE TYPE opt_in_status AS ENUM ('pending', 'opted_in', 'opted_out');
CREATE TYPE instance_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled');
CREATE TYPE event_type AS ENUM ('opt_in_sent', 'opt_in_received', 'reminder_sent', 'confirmed_returned', 'confirmed_paid', 'rescheduled', 'button_clicked');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read', 'failed');

-- 1. TENANTS (Empresas/PyMEs)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    whatsapp_phone_number_id VARCHAR(50), -- Phone Number ID de WhatsApp Business
    whatsapp_access_token TEXT, -- Token de acceso temporal (se rota)
    whatsapp_business_account_id VARCHAR(50),
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Mexico_City',
    webhook_verify_token VARCHAR(255),

    -- Configuración
    settings JSONB DEFAULT '{}',

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_timezone CHECK (timezone ~ '^[A-Za-z_/]+$')
);

-- 2. USERS (Usuarios del sistema)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    auth_user_id UUID, -- ID del usuario en auth.users de Supabase
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member

    -- Datos personales
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(tenant_id, email),
    CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member'))
);

-- 3. CONTACTS (Clientes/Terceros)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Datos básicos
    phone_e164 VARCHAR(20) NOT NULL, -- Formato E.164: +521234567890
    name VARCHAR(255) NOT NULL,

    -- WhatsApp
    whatsapp_id VARCHAR(50), -- ID de WhatsApp del contacto
    opt_in_status opt_in_status NOT NULL DEFAULT 'pending',
    opt_in_date TIMESTAMPTZ,
    opt_out_date TIMESTAMPTZ,

    -- Configuración personal
    timezone VARCHAR(50), -- Si es diferente al tenant
    preferred_language VARCHAR(5) DEFAULT 'es',

    -- Metadatos
    metadata JSONB DEFAULT '{}',

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(tenant_id, phone_e164),
    CONSTRAINT valid_phone CHECK (phone_e164 ~ '^\+[1-9]\d{1,14}$'),
    CONSTRAINT valid_timezone_contact CHECK (timezone IS NULL OR timezone ~ '^[A-Za-z_/]+$')
);

-- 4. AGREEMENTS (Acuerdos de préstamo/servicio)
CREATE TABLE agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),

    -- Datos del acuerdo
    type agreement_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    item_description TEXT, -- Para préstamos: qué se prestó
    amount DECIMAL(10,2), -- Para servicios: monto a cobrar
    currency VARCHAR(3) DEFAULT 'MXN',

    -- Fechas
    start_date DATE NOT NULL,
    due_date DATE, -- Para préstamos de fecha única

    -- Recurrencia (para servicios)
    recurrence_rule VARCHAR(100), -- RRULE format: FREQ=MONTHLY;INTERVAL=1
    next_due_date DATE, -- Próxima fecha de vencimiento calculada

    -- Estado
    status agreement_status NOT NULL DEFAULT 'active',

    -- Configuración de recordatorios
    reminder_config JSONB DEFAULT '{"before_24h": true, "due_date": true, "overdue": true}',

    -- Metadatos
    metadata JSONB DEFAULT '{}',

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT valid_amount CHECK (amount IS NULL OR amount >= 0),
    CONSTRAINT loan_has_due_date CHECK (type != 'loan' OR due_date IS NOT NULL),
    CONSTRAINT service_has_recurrence CHECK (type != 'service' OR recurrence_rule IS NOT NULL)
);

-- 5. TEMPLATES (Plantillas de mensajes)
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = template global del sistema

    -- Identificación
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'utility', 'marketing', etc.
    language VARCHAR(5) NOT NULL DEFAULT 'es',

    -- Contenido del template
    header TEXT,
    body TEXT NOT NULL,
    footer TEXT,

    -- Configuración de botones
    buttons_config JSONB, -- Configuración de botones interactivos

    -- Meta Business
    meta_template_name VARCHAR(255), -- Nombre en Meta Business Manager
    meta_template_id VARCHAR(50), -- ID asignado por Meta
    approval_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected

    -- Variables que acepta el template
    variables JSONB DEFAULT '[]', -- ["contact_name", "item", "due_date"]

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(tenant_id, name),
    CONSTRAINT valid_approval_status CHECK (approval_status IN ('pending', 'approved', 'rejected'))
);

-- 6. REMINDERS (Configuración de recordatorios)
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,

    -- Configuración del recordatorio
    reminder_type reminder_type NOT NULL,
    days_offset INTEGER NOT NULL DEFAULT 0, -- Días antes/después de due_date (negativo = antes)
    time_of_day TIME NOT NULL DEFAULT '09:00:00', -- Hora del día para enviar

    -- Destinatarios
    recipients reminder_recipients NOT NULL DEFAULT 'contact',

    -- Template a usar
    template_id UUID NOT NULL REFERENCES templates(id),

    -- Estado
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_days_offset CHECK (
        (reminder_type = 'before_24h' AND days_offset = -1) OR
        (reminder_type = 'due_date' AND days_offset = 0) OR
        (reminder_type = 'overdue' AND days_offset > 0)
    )
);

-- 7. REMINDER_INSTANCES (Instancias específicas de recordatorios)
CREATE TABLE reminder_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,

    -- Programación
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,

    -- Estado y reintentos
    status instance_status NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,

    -- WhatsApp
    whatsapp_message_id VARCHAR(255), -- ID del mensaje en WhatsApp

    -- Variables renderizadas para este envío
    rendered_variables JSONB DEFAULT '{}',

    -- Error info
    error_message TEXT,
    error_code VARCHAR(50),

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. EVENTS (Registro de eventos/interacciones)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    agreement_id UUID REFERENCES agreements(id) ON DELETE SET NULL,
    reminder_instance_id UUID REFERENCES reminder_instances(id) ON DELETE SET NULL,

    -- Evento
    event_type event_type NOT NULL,

    -- Payload del evento
    payload JSONB DEFAULT '{}',

    -- Metadatos
    whatsapp_message_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET,

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. WHATSAPP_MESSAGES (Historial de mensajes)
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    reminder_instance_id UUID REFERENCES reminder_instances(id) ON DELETE SET NULL,

    -- WhatsApp IDs
    wa_message_id VARCHAR(255) UNIQUE, -- ID único de WhatsApp
    wa_conversation_id VARCHAR(255),

    -- Dirección y contenido
    direction message_direction NOT NULL,
    message_type VARCHAR(50) NOT NULL, -- text, interactive, template, etc.
    content JSONB NOT NULL, -- Contenido completo del mensaje

    -- Template usado (solo para outbound)
    template_id UUID REFERENCES templates(id),
    template_variables JSONB,

    -- Estados (solo para outbound)
    status message_status,

    -- Timestamps de WhatsApp
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,

    -- Errores
    error_code VARCHAR(50),
    error_message TEXT,

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ÍNDICES PARA PERFORMANCE

-- Tenants
CREATE INDEX idx_tenants_whatsapp_phone_id ON tenants(whatsapp_phone_number_id);

-- Users
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_users_email ON users(email);

-- Contacts
CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX idx_contacts_phone ON contacts(phone_e164);
CREATE INDEX idx_contacts_tenant_phone ON contacts(tenant_id, phone_e164);
CREATE INDEX idx_contacts_opt_in_status ON contacts(opt_in_status);

-- Agreements
CREATE INDEX idx_agreements_tenant_id ON agreements(tenant_id);
CREATE INDEX idx_agreements_contact_id ON agreements(contact_id);
CREATE INDEX idx_agreements_status ON agreements(status);
CREATE INDEX idx_agreements_due_date ON agreements(due_date);
CREATE INDEX idx_agreements_next_due_date ON agreements(next_due_date);
CREATE INDEX idx_agreements_type ON agreements(type);

-- Templates
CREATE INDEX idx_templates_tenant_id ON templates(tenant_id);
CREATE INDEX idx_templates_name ON templates(name);
CREATE INDEX idx_templates_approval_status ON templates(approval_status);

-- Reminders
CREATE INDEX idx_reminders_agreement_id ON reminders(agreement_id);
CREATE INDEX idx_reminders_template_id ON reminders(template_id);
CREATE INDEX idx_reminders_is_active ON reminders(is_active);

-- Reminder Instances (CRÍTICO PARA SCHEDULER)
CREATE INDEX idx_reminder_instances_scheduled_for ON reminder_instances(scheduled_for);
CREATE INDEX idx_reminder_instances_status ON reminder_instances(status);
CREATE INDEX idx_reminder_instances_status_scheduled ON reminder_instances(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_reminder_instances_next_retry ON reminder_instances(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_reminder_instances_reminder_id ON reminder_instances(reminder_id);

-- Events
CREATE INDEX idx_events_tenant_id ON events(tenant_id);
CREATE INDEX idx_events_contact_id ON events(contact_id);
CREATE INDEX idx_events_agreement_id ON events(agreement_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at);

-- WhatsApp Messages
CREATE INDEX idx_whatsapp_messages_tenant_id ON whatsapp_messages(tenant_id);
CREATE INDEX idx_whatsapp_messages_contact_id ON whatsapp_messages(contact_id);
CREATE INDEX idx_whatsapp_messages_wa_message_id ON whatsapp_messages(wa_message_id);
CREATE INDEX idx_whatsapp_messages_direction ON whatsapp_messages(direction);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_created_at ON whatsapp_messages(created_at);

-- TRIGGERS PARA AUDITORÍA

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agreements_updated_at BEFORE UPDATE ON agreements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON reminders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reminder_instances_updated_at BEFORE UPDATE ON reminder_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_messages_updated_at BEFORE UPDATE ON whatsapp_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();