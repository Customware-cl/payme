-- Configuración de Row Level Security (RLS)
-- Esta migración habilita RLS y crea todas las políticas necesarias para multi-tenancy

-- FUNCIONES AUXILIARES PARA RLS

-- Función para obtener el tenant_id del usuario actual
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Función para verificar si el usuario es owner/admin del tenant
CREATE OR REPLACE FUNCTION is_tenant_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
$$;

-- Función para verificar si el usuario pertenece a un tenant específico
CREATE OR REPLACE FUNCTION user_belongs_to_tenant(target_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
    AND tenant_id = target_tenant_id
  );
$$;

-- HABILITAR RLS EN TODAS LAS TABLAS

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PARA TENANTS

-- Los usuarios solo pueden ver/editar su propio tenant
CREATE POLICY "Users can view their own tenant" ON tenants
    FOR SELECT USING (user_belongs_to_tenant(id));

CREATE POLICY "Owners can update their tenant" ON tenants
    FOR UPDATE USING (user_belongs_to_tenant(id) AND is_tenant_admin());

-- POLÍTICAS PARA USERS

-- Los usuarios pueden ver otros usuarios de su mismo tenant
CREATE POLICY "Users can view users from their tenant" ON users
    FOR SELECT USING (tenant_id = get_current_tenant_id());

-- Solo admins pueden invitar nuevos usuarios
CREATE POLICY "Admins can insert new users" ON users
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id()
        AND is_tenant_admin()
    );

-- Solo admins pueden actualizar usuarios
CREATE POLICY "Admins can update users" ON users
    FOR UPDATE USING (
        tenant_id = get_current_tenant_id()
        AND is_tenant_admin()
    );

-- Solo admins pueden eliminar usuarios (excepto a ellos mismos)
CREATE POLICY "Admins can delete users" ON users
    FOR DELETE USING (
        tenant_id = get_current_tenant_id()
        AND is_tenant_admin()
        AND auth_user_id != auth.uid()
    );

-- POLÍTICAS PARA CONTACTS

-- Los usuarios pueden ver contactos de su tenant
CREATE POLICY "Users can view contacts from their tenant" ON contacts
    FOR SELECT USING (tenant_id = get_current_tenant_id());

-- Los usuarios pueden crear contactos en su tenant
CREATE POLICY "Users can insert contacts in their tenant" ON contacts
    FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- Los usuarios pueden actualizar contactos de su tenant
CREATE POLICY "Users can update contacts from their tenant" ON contacts
    FOR UPDATE USING (tenant_id = get_current_tenant_id());

-- Solo admins pueden eliminar contactos
CREATE POLICY "Admins can delete contacts" ON contacts
    FOR DELETE USING (
        tenant_id = get_current_tenant_id()
        AND is_tenant_admin()
    );

-- POLÍTICAS PARA AGREEMENTS

-- Los usuarios pueden ver acuerdos de su tenant
CREATE POLICY "Users can view agreements from their tenant" ON agreements
    FOR SELECT USING (tenant_id = get_current_tenant_id());

-- Los usuarios pueden crear acuerdos en su tenant
CREATE POLICY "Users can insert agreements in their tenant" ON agreements
    FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- Los usuarios pueden actualizar acuerdos de su tenant
CREATE POLICY "Users can update agreements from their tenant" ON agreements
    FOR UPDATE USING (tenant_id = get_current_tenant_id());

-- Solo admins pueden eliminar acuerdos
CREATE POLICY "Admins can delete agreements" ON agreements
    FOR DELETE USING (
        tenant_id = get_current_tenant_id()
        AND is_tenant_admin()
    );

-- POLÍTICAS PARA TEMPLATES

-- Las templates pueden ser globales (tenant_id = NULL) o del tenant
CREATE POLICY "Users can view global and tenant templates" ON templates
    FOR SELECT USING (
        tenant_id IS NULL
        OR tenant_id = get_current_tenant_id()
    );

-- Solo admins pueden crear templates custom para su tenant
CREATE POLICY "Admins can insert tenant templates" ON templates
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id()
        AND is_tenant_admin()
    );

-- Solo admins pueden actualizar templates de su tenant
CREATE POLICY "Admins can update tenant templates" ON templates
    FOR UPDATE USING (
        tenant_id = get_current_tenant_id()
        AND is_tenant_admin()
    );

-- Solo admins pueden eliminar templates de su tenant
CREATE POLICY "Admins can delete tenant templates" ON templates
    FOR DELETE USING (
        tenant_id = get_current_tenant_id()
        AND is_tenant_admin()
    );

-- POLÍTICAS PARA REMINDERS

-- Los usuarios pueden ver recordatorios a través de agreements de su tenant
CREATE POLICY "Users can view reminders from their tenant" ON reminders
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM agreements
            WHERE agreements.id = reminders.agreement_id
            AND agreements.tenant_id = get_current_tenant_id()
        )
    );

-- Los usuarios pueden crear recordatorios para agreements de su tenant
CREATE POLICY "Users can insert reminders for their agreements" ON reminders
    FOR INSERT WITH CHECK (
        EXISTS(
            SELECT 1 FROM agreements
            WHERE agreements.id = reminders.agreement_id
            AND agreements.tenant_id = get_current_tenant_id()
        )
    );

-- Los usuarios pueden actualizar recordatorios de su tenant
CREATE POLICY "Users can update reminders from their tenant" ON reminders
    FOR UPDATE USING (
        EXISTS(
            SELECT 1 FROM agreements
            WHERE agreements.id = reminders.agreement_id
            AND agreements.tenant_id = get_current_tenant_id()
        )
    );

-- Solo admins pueden eliminar recordatorios
CREATE POLICY "Admins can delete reminders" ON reminders
    FOR DELETE USING (
        EXISTS(
            SELECT 1 FROM agreements
            WHERE agreements.id = reminders.agreement_id
            AND agreements.tenant_id = get_current_tenant_id()
        ) AND is_tenant_admin()
    );

-- POLÍTICAS PARA REMINDER_INSTANCES

-- Los usuarios pueden ver instancias através de reminders/agreements de su tenant
CREATE POLICY "Users can view reminder instances from their tenant" ON reminder_instances
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM reminders
            JOIN agreements ON agreements.id = reminders.agreement_id
            WHERE reminders.id = reminder_instances.reminder_id
            AND agreements.tenant_id = get_current_tenant_id()
        )
    );

-- Solo el sistema (service_role) puede insertar/actualizar reminder_instances
-- Las políticas para service_role se manejan por separado

-- POLÍTICAS PARA EVENTS

-- Los usuarios pueden ver eventos de su tenant
CREATE POLICY "Users can view events from their tenant" ON events
    FOR SELECT USING (tenant_id = get_current_tenant_id());

-- Los eventos se insertan principalmente por Edge Functions (service_role)
-- Política básica para users autenticados
CREATE POLICY "System can insert events" ON events
    FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- POLÍTICAS PARA WHATSAPP_MESSAGES

-- Los usuarios pueden ver mensajes de su tenant
CREATE POLICY "Users can view whatsapp messages from their tenant" ON whatsapp_messages
    FOR SELECT USING (tenant_id = get_current_tenant_id());

-- Los mensajes se manejan principalmente por Edge Functions
-- Política básica para users autenticados
CREATE POLICY "System can insert whatsapp messages" ON whatsapp_messages
    FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "System can update whatsapp messages" ON whatsapp_messages
    FOR UPDATE USING (tenant_id = get_current_tenant_id());

-- POLÍTICAS ESPECIALES PARA SERVICE_ROLE (Edge Functions)

-- Las Edge Functions necesitan acceso completo para funcionar correctamente
-- Estas políticas se aplican cuando auth.uid() IS NULL (service_role)

-- Service role puede leer todo para el scheduler y webhooks
CREATE POLICY "Service role full access tenants" ON tenants
    FOR ALL USING (auth.uid() IS NULL);

CREATE POLICY "Service role full access users" ON users
    FOR ALL USING (auth.uid() IS NULL);

CREATE POLICY "Service role full access contacts" ON contacts
    FOR ALL USING (auth.uid() IS NULL);

CREATE POLICY "Service role full access agreements" ON agreements
    FOR ALL USING (auth.uid() IS NULL);

CREATE POLICY "Service role full access templates" ON templates
    FOR ALL USING (auth.uid() IS NULL);

CREATE POLICY "Service role full access reminders" ON reminders
    FOR ALL USING (auth.uid() IS NULL);

CREATE POLICY "Service role full access reminder_instances" ON reminder_instances
    FOR ALL USING (auth.uid() IS NULL);

CREATE POLICY "Service role full access events" ON events
    FOR ALL USING (auth.uid() IS NULL);

CREATE POLICY "Service role full access whatsapp_messages" ON whatsapp_messages
    FOR ALL USING (auth.uid() IS NULL);

-- FUNCIÓN PARA CREAR PRIMER USUARIO OWNER DE UN TENANT

CREATE OR REPLACE FUNCTION create_tenant_with_owner(
    tenant_name TEXT,
    owner_email TEXT,
    owner_first_name TEXT DEFAULT NULL,
    owner_last_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_tenant_id UUID;
    current_user_id UUID;
BEGIN
    -- Verificar que hay un usuario autenticado
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    -- Crear el tenant
    INSERT INTO tenants (name)
    VALUES (tenant_name)
    RETURNING id INTO new_tenant_id;

    -- Crear el usuario owner
    INSERT INTO users (
        tenant_id,
        auth_user_id,
        email,
        role,
        first_name,
        last_name
    )
    VALUES (
        new_tenant_id,
        current_user_id,
        owner_email,
        'owner',
        owner_first_name,
        owner_last_name
    );

    RETURN new_tenant_id;
END;
$$;

-- TRIGGER PARA AUTO-ASIGNAR TENANT EN USERS CUANDO SE REGISTRA
-- (Se puede usar en el frontend para onboarding)

-- GRANTS NECESARIOS PARA LAS FUNCIONES

-- Permitir a usuarios autenticados ejecutar las funciones auxiliares
GRANT EXECUTE ON FUNCTION get_current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_tenant_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION user_belongs_to_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_tenant_with_owner(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Comentarios de documentación
COMMENT ON FUNCTION get_current_tenant_id() IS 'Retorna el tenant_id del usuario autenticado actual';
COMMENT ON FUNCTION is_tenant_admin() IS 'Verifica si el usuario actual es admin/owner de su tenant';
COMMENT ON FUNCTION user_belongs_to_tenant(UUID) IS 'Verifica si el usuario actual pertenece al tenant especificado';
COMMENT ON FUNCTION create_tenant_with_owner(TEXT, TEXT, TEXT, TEXT) IS 'Crea un nuevo tenant con el usuario actual como owner';