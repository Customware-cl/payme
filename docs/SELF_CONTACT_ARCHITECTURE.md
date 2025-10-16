# Self-Contact Architecture

## Problema

El sistema PayME permite registrar préstamos donde **YO presto a alguien**:

```
Acuerdo:
- tenant_id: Mi tenant
- lender_tenant_contact_id: NULL o mi usuario (legacy)
- tenant_contact_id: Juan (borrower)
- created_by: Yo

Interpretación: "Yo le presté a Juan"
```

Pero **NO** permitía registrar préstamos donde **YO soy el borrower**:

```
¿Cómo representar: "Pedro me prestó $1000"?
```

## Solución: Self-Contact

Creamos un `tenant_contact` especial que **me representa a MÍ MISMO** dentro de mi tenant.

### Patrón Self-Reference

```
┌─────────────────┐
│  contact_profiles│  ← Perfil global único por teléfono
│  - id           │
│  - phone_e164   │
│  - first_name   │
│  - last_name    │
│  - email        │
└─────────────────┘
         ▲
         │
    ┌────┴─────────────────────────────┐
    │                                  │
┌───┴────────────────┐    ┌────────────┴──────┐
│ tenant_contacts    │    │ tenant_contacts   │
│ (ContactoA en      │    │ (YO en mi tenant) │
│  mi tenant)        │    │                   │
│ - tenant_id: T1    │    │ - tenant_id: T1   │
│ - contact_profile  │    │ - contact_profile │
│ - name: "Juan"     │    │ - name: "Yo"      │
│ - metadata: {}     │    │ - metadata:       │
│                    │    │   {is_self: true} │
└────────────────────┘    └───────────────────┘
         │                         │
         │                         │
    ┌────▼─────────────────────────▼──────┐
    │ agreements                          │
    │ - tenant_contact_id ───────────────►│ Borrower
    │ - lender_tenant_contact_id ────────►│ Lender
    │ - created_by (user_id)              │
    └─────────────────────────────────────┘
```

### Identificación del Self-Contact

El `tenant_contact` que me representa tiene:

```json
{
  "metadata": {
    "is_self": true,
    "user_id": "<user_id>",
    "created_by_migration": "027"
  },
  "name": "Yo (Mi cuenta)"
}
```

### Función get_or_create_self_contact()

**Ubicación:** Migración 027

**Signatura:**
```sql
get_or_create_self_contact(p_tenant_id UUID, p_user_id UUID) RETURNS UUID
```

**Lógica:**

1. **Buscar** si ya existe `tenant_contact` con `metadata.is_self = true` para este tenant
2. Si existe → retornar ID
3. Si no existe:
   - Obtener datos del usuario (phone, first_name, last_name, email)
   - Buscar o crear `contact_profile` con el phone del usuario
   - Crear `tenant_contact` con:
     - `name = "Yo (Mi cuenta)"`
     - `metadata.is_self = true`
     - `opt_in_status = 'opted_in'`
   - Retornar ID del nuevo `tenant_contact`

**Índice para Performance:**

```sql
CREATE INDEX idx_tenant_contacts_is_self
ON tenant_contacts((metadata->>'is_self'))
WHERE (metadata->>'is_self')::boolean = true;
```

## Uso en Agreements

### Préstamo que YO hago (flow original)

```javascript
{
  tenant_id: 'mi-tenant',
  tenant_contact_id: 'juan-tenant-contact-id',  // Juan es borrower
  lender_tenant_contact_id: null,                // NULL = Yo soy lender (legacy)
  created_by: 'mi-user-id'
}
```

### Préstamo que YO recibo (nuevo flow)

```javascript
{
  tenant_id: 'mi-tenant',
  tenant_contact_id: 'self-contact-id',           // YO soy borrower
  lender_tenant_contact_id: 'pedro-tenant-contact-id', // Pedro es lender
  created_by: 'mi-user-id'
}
```

## Ventajas del Patrón

### ✅ Consistencia Arquitectural

- Todo es un `tenant_contact`
- No necesitas lógica especial (NULL checks, COALESCE)
- Queries uniformes

```sql
-- Ver préstamos donde YO soy borrower
SELECT * FROM agreements
WHERE tenant_contact_id = get_self_contact_id('mi-tenant');

-- Ver préstamos donde YO soy lender
SELECT * FROM agreements
WHERE lender_tenant_contact_id = get_self_contact_id('mi-tenant');
```

### ✅ Escalabilidad

Soporta casos futuros sin cambios:
- Préstamos entre miembros de un equipo
- Múltiples usuarios por tenant
- Transferencia de préstamos

### ✅ RLS Policies Simples

Las policies existentes funcionan sin cambios:

```sql
CREATE POLICY "Users can view agreements from their tenant" ON agreements
    FOR SELECT USING (tenant_id = get_current_tenant_id());
```

No importa si soy borrower o lender, la policy verifica `tenant_id`.

### ✅ UI/UX Transparente

El usuario no necesita saber que existe un "self contact":
- Registra préstamo recibido
- Sistema crea/usa self_contact automáticamente
- Todo funciona "mágicamente"

## Edge Function: create-received-loan

**Endpoint:** `POST /functions/v1/create-received-loan`

**Request:**
```json
{
  "token": "menu_llt_...",
  "lender": {
    "contact_id": "uuid",  // Si ya existe
    // O
    "name": "Pedro Pérez",
    "phone": "+56912345678",
    "email": "pedro@example.com"
  },
  "loan": {
    "amount": 1000,
    "currency": "CLP",
    "due_date": "2025-11-15",
    "title": "Préstamo emergencia",
    "description": "..."
  }
}
```

**Flujo:**
1. Validar token → obtener `tenant_id` y `user_id`
2. Ejecutar `get_or_create_self_contact(tenant_id, user_id)` → obtener `self_contact_id`
3. Si `lender.contact_id` existe → usar
4. Si no → crear `contact_profile` + `tenant_contact`
5. Crear `agreement`:
   - `tenant_contact_id = self_contact_id` (yo borrower)
   - `lender_tenant_contact_id = lender_contact_id`
6. Detectar si lender es usuario → enviar notificación/invitación

**Response:**
```json
{
  "success": true,
  "data": {
    "agreement_id": "uuid",
    "borrower_contact_id": "self-contact-id",
    "lender_contact_id": "lender-contact-id",
    "invitation_status": {
      "sent": true,
      "type": "in_app_notification" | "whatsapp_invitation"
    },
    "lender_is_user": true
  }
}
```

## Queries Comunes

### Obtener mi self_contact

```sql
SELECT get_self_contact_id('mi-tenant-id');
```

### Crear self_contact si no existe

```sql
SELECT get_or_create_self_contact('mi-tenant-id', 'mi-user-id');
```

### Listar préstamos recibidos

```sql
SELECT a.*,
       lender.name as lender_name
FROM agreements a
JOIN tenant_contacts lender ON a.lender_tenant_contact_id = lender.id
WHERE a.tenant_contact_id = get_self_contact_id('mi-tenant-id')
  AND a.status = 'active';
```

### Listar préstamos otorgados

```sql
SELECT a.*,
       borrower.name as borrower_name
FROM agreements a
JOIN tenant_contacts borrower ON a.tenant_contact_id = borrower.id
WHERE (
  a.lender_tenant_contact_id = get_self_contact_id('mi-tenant-id')
  OR (a.lender_tenant_contact_id IS NULL) -- Legacy: NULL = owner presta
)
AND a.status = 'active';
```

### Resumen de préstamos (ambos roles)

```sql
WITH self_contact AS (
  SELECT get_self_contact_id('mi-tenant-id') as id
)
SELECT
  COUNT(*) FILTER (WHERE a.tenant_contact_id = sc.id) as borrowed_count,
  COUNT(*) FILTER (WHERE a.lender_tenant_contact_id = sc.id) as lent_count,
  SUM(a.amount) FILTER (WHERE a.tenant_contact_id = sc.id) as total_borrowed,
  SUM(a.amount) FILTER (WHERE a.lender_tenant_contact_id = sc.id) as total_lent
FROM agreements a, self_contact sc
WHERE (a.tenant_contact_id = sc.id OR a.lender_tenant_contact_id = sc.id)
  AND a.status = 'active';
```

## Consideraciones

### 🟡 Un self_contact por tenant

Cada tenant tiene **exactamente un** self_contact. No hay múltiples self_contacts por tenant.

Si el tenant tiene varios usuarios (equipo), cada usuario tendría su propio self_contact cuando sea necesario.

### 🟡 Creación Lazy

El self_contact se crea **solo cuando se necesita** (al registrar primer préstamo recibido).

No se crean proactivamente al crear usuario/tenant.

### 🟡 Nombre del self_contact

El nombre es fijo: `"Yo (Mi cuenta)"` en español.

Podría internationalizarse si la app soporta otros idiomas.

### 🟡 No eliminar

Los self_contacts **NO deben eliminarse** porque representan al usuario mismo.

Si un usuario se elimina del tenant, su self_contact debería marcarse como inactivo pero no eliminarse (para preservar historial).

## Testing

Ver: `/supabase/functions/test-self-contact.ts` (si existe)

Casos de prueba:
1. Crear self_contact por primera vez
2. Llamar `get_or_create_self_contact()` dos veces → retorna mismo ID
3. Crear agreement con self como borrower
4. Listar préstamos recibidos
5. Verificar RLS policies con self_contact

## Referencias

- Migración: `027_add_self_contact_support.sql`
- Edge Function: `supabase/functions/create-received-loan/index.ts`
- Helper: `supabase/functions/_shared/user-detection.ts`
- Viralidad: Ver `docs/VIRAL_INVITATIONS.md`
