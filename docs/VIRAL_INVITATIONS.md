# Estrategia de Viralidad: Invitaciones Automáticas

## Concepto

Cuando un usuario registra un préstamo que **recibió**, el sistema detecta automáticamente si el lender (prestamista) es usuario de la app o no, y toma acción para:

1. **Si es usuario** → Notificación in-app
2. **Si NO es usuario** → Invitación por WhatsApp

Esto crea un efecto viral: cada préstamo registrado puede traer un nuevo usuario a la plataforma.

## Flujo de Viralidad

```
┌─────────────────────────────────────────────────────────┐
│  Juan registra "Pedro me prestó $1000"                  │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────▼─────────┐
        │  Pedro existe?   │
        └────────┬─────────┘
                 │
     ┌───────────┴──────────────┐
     │                          │
┌────▼──────┐          ┌────────▼────────┐
│ Es usuario│          │ No es usuario   │
└────┬──────┘          └────────┬────────┘
     │                          │
┌────▼──────────────┐  ┌────────▼─────────────────────┐
│ Escenario A o B   │  │ Escenario C                  │
│                   │  │                              │
│ Notificación      │  │ WhatsApp Invitation Template │
│ in-app            │  │ "Juan registró préstamo..."  │
│                   │  │ [Únete a PayME]              │
│ "Juan registró    │  └────────┬─────────────────────┘
│  préstamo de ti"  │           │
└────┬──────────────┘  ┌────────▼──────────┐
     │                 │ Pedro se registra │
     │                 └────────┬──────────┘
     │                          │
     └──────────┬───────────────┘
                │
        ┌───────▼────────────────────────┐
        │ Opción de confirmar/actualizar │
        │ "¿Es correcto este monto?"     │
        │ → Puede crear agreement        │
        │    en su propio tenant         │
        └────────────────────────────────┘
```

## Escenarios

### Escenario A: Lender es usuario Y es mi contacto

**Situación:**
- Pedro tiene cuenta en PayME
- Pedro está en mi lista de contactos
- Pedro me tiene (o no) en su lista

**Flujo:**
1. Juan registra préstamo: "Pedro me prestó $1000"
2. Sistema detecta que Pedro es usuario (via `checkIfContactIsAppUser()`)
3. Sistema crea evento de notificación en el tenant de Pedro:

```sql
INSERT INTO events (tenant_id, payload) VALUES (
  pedro_tenant_id,
  {
    "type": "loan_registered_by_borrower",
    "borrower_name": "Juan Pérez",
    "amount": 1000,
    "currency": "CLP",
    "message": "Juan Pérez registró un préstamo que recibió de ti"
  }
);
```

4. Pedro recibe notificación in-app
5. Pedro puede:
   - Confirmar el préstamo
   - Editar monto/fecha
   - Crear agreement espejo en su tenant

**Viralidad:** ⭐⭐⭐ Alta - Engagement del usuario existente

---

### Escenario B: Lender es usuario pero NO es mi contacto

**Situación:**
- Pedro tiene cuenta en PayME
- Pedro NO está en mi lista de contactos
- No hay relación previa

**Flujo:**
1. Juan busca/agrega "Pedro Pérez +56912345678"
2. Sistema busca `contact_profile` por teléfono → encuentra que tiene `tenant_id`
3. Sistema crea `tenant_contact` en el tenant de Juan
4. Sistema registra préstamo
5. Sistema detecta que Pedro es usuario
6. Notificación in-app a Pedro + posible WhatsApp:

```
¡Hola Pedro! 👋

Juan Pérez te agregó como contacto y registró un préstamo que recibió de ti por $1,000 CLP.

[Ver detalles] [Confirmar] [Rechazar]
```

7. Pedro puede:
   - Aceptar conexión → Se agrega mutua
   - Confirmar préstamo
   - Rechazar si no es correcto

**Viralidad:** ⭐⭐⭐⭐ Muy Alta - Conexión cross-tenant

---

### Escenario C: Lender NO es usuario

**Situación:**
- Pedro NO tiene cuenta en PayME
- Solo tenemos su teléfono

**Flujo:**
1. Juan registra préstamo: "Pedro Pérez +56912345678 me prestó $1000"
2. Sistema crea `contact_profile` + `tenant_contact`
3. Sistema detecta que Pedro NO es usuario
4. Sistema envía WhatsApp Template `loan_invitation`:

```
¡Hola Pedro! 👋

Juan Pérez registró en PayME un préstamo que recibió de ti por $1,000 CLP.

Únete para ver todos tus préstamos y gestionar cobros fácilmente.

¿Te interesa?

[Únete a PayME →]
```

5. Link de invitación incluye:
   - Pre-registro con teléfono de Pedro
   - Auto-conexión con Juan al registrarse
   - Ver préstamo inmediatamente después del registro

**Viralidad:** ⭐⭐⭐⭐⭐ Máxima - Invitación directa con valor inmediato

## Detección de Usuario

**Helper:** `checkIfContactIsAppUser(contact_profile_id)`

**Ubicación:** `supabase/functions/_shared/user-detection.ts`

**Lógica:**
```typescript
1. Obtener contact_profile → phone_e164, email
2. Buscar usuario con matching phone O email
3. Si existe:
   - Retornar { isUser: true, tenant_id, user_id, user_name }
4. Si no existe:
   - Retornar { isUser: false }
```

**Llamada en create-received-loan:**
```typescript
const userDetection = await checkIfContactIsAppUser(
  supabase,
  lender_contact_profile_id
);

if (userDetection.isUser) {
  // Escenario A o B → Notificación in-app
  await sendInAppNotification(userDetection.tenant_id, ...);
} else {
  // Escenario C → WhatsApp invitation
  await sendWhatsAppInvitation(lender.phone, ...);
}
```

## WhatsApp Template: loan_invitation

**Nombre:** `loan_invitation`

**Categoría:** UTILITY

**Idioma:** Español

**Variables:**
- `{{1}}`: lender_name - Nombre del prestamista (destinatario)
- `{{2}}`: borrower_name - Nombre del prestatario (quien registra)
- `{{3}}`: amount - Monto con formato (ej: "$1,000 CLP")

**Body:**
```
¡Hola {{1}}! 👋

{{2}} registró en PayME un préstamo que recibió de ti por {{3}}.

Únete para ver todos tus préstamos y gestionar cobros fácilmente.

¿Te interesa?
```

**Botón:**
- Tipo: URL dinámica
- Texto: "Únete a PayME"
- URL: `https://app.payme.cl/register?ref={{contact_profile_id}}`

**Implementación:**

```typescript
// En whatsapp-templates.ts
async sendLoanInvitationTemplate(
  to: string,
  lenderName: string,
  borrowerName: string,
  amount: number,
  currency: string,
  invitationUrl: string
): Promise<{ success: boolean; messageId?: string; error?: string }>
```

## Flujo de Invitación Completo

### 1. Registro de Préstamo

```typescript
POST /functions/v1/create-received-loan
{
  "lender": {
    "name": "Pedro Pérez",
    "phone": "+56912345678"
  },
  "loan": {
    "amount": 1000,
    "currency": "CLP",
    "due_date": "2025-12-01"
  }
}
```

### 2. Detección Automática

```typescript
// En create-received-loan/index.ts
const userDetection = await checkIfContactIsAppUser(
  supabase,
  lender_contact_profile_id
);

console.log('[VIRALIDAD]', {
  is_user: userDetection.isUser,
  tenant_id: userDetection.tenant_id
});
```

### 3. Envío de Invitación (Escenario C)

```typescript
if (!userDetection.isUser) {
  const whatsapp = new WhatsAppTemplates(
    tenant.whatsapp_phone_number_id,
    tenant.whatsapp_access_token
  );

  const invitationUrl = `https://app.payme.cl/register?ref=${lender_contact_profile_id}`;

  await whatsapp.sendLoanInvitationTemplate(
    lender.phone,
    lender.name,
    borrowerName,
    loan.amount,
    loan.currency,
    invitationUrl
  );
}
```

### 4. Landing Page de Invitación

**URL:** `https://app.payme.cl/register?ref=<contact_profile_id>`

**Debe:**
1. Pre-llenar teléfono del invitado
2. Mostrar: "Juan Pérez te invitó a PayME"
3. Después del registro:
   - Auto-crear conexión bidireccional
   - Mostrar préstamo registrado
   - Opción de confirmar/editar

## Métricas de Viralidad

### Métricas a Trackear

1. **Invitation Sent Rate**
   ```sql
   SELECT COUNT(*) FROM events
   WHERE payload->>'type' = 'invitation_sent'
   AND created_at > NOW() - INTERVAL '30 days';
   ```

2. **Invitation Accept Rate**
   ```sql
   SELECT
     COUNT(DISTINCT payload->>'contact_profile_id') as invitations_sent,
     COUNT(DISTINCT u.id) as users_registered
   FROM events e
   LEFT JOIN contact_profiles cp ON (e.payload->>'contact_profile_id')::uuid = cp.id
   LEFT JOIN users u ON u.phone = cp.phone_e164
   WHERE e.payload->>'type' = 'invitation_sent'
   AND e.created_at > NOW() - INTERVAL '30 days';
   ```

3. **Viral Coefficient (K-factor)**
   ```
   K = (Invitations per User) × (Conversion Rate)

   Ejemplo:
   - 100 usuarios
   - 150 invitaciones enviadas → 1.5 invitations/user
   - 30 registros → 20% conversion
   - K = 1.5 × 0.20 = 0.30

   K > 1 = Crecimiento viral sostenido
   ```

4. **Time to Registration**
   ```sql
   SELECT
     AVG(u.created_at - e.created_at) as avg_time_to_register
   FROM events e
   JOIN contact_profiles cp ON (e.payload->>'contact_profile_id')::uuid = cp.id
   JOIN users u ON u.phone = cp.phone_e164
   WHERE e.payload->>'type' = 'invitation_sent';
   ```

## Mejoras Futuras

### 🔮 Fase 2: Gamificación

- Badge "Embajador" por traer 5+ usuarios
- Crédito/descuento por invitaciones exitosas
- Leaderboard de invitadores

### 🔮 Fase 3: Confirmación de Préstamo

Cuando lender se registra:
- Mostrar préstamo para confirmar
- Opción de editar monto/fecha
- Crear agreement espejo en su tenant (bilateral)
- Notificación al borrower: "Pedro confirmó el préstamo"

### 🔮 Fase 4: Referral Program

- Link de referido personalizado
- Tracking de referidos
- Recompensas por traer usuarios activos

## Referencias

- Edge Function: `supabase/functions/create-received-loan/index.ts`
- Helper: `supabase/functions/_shared/user-detection.ts`
- Template Helper: `supabase/functions/_shared/whatsapp-templates.ts`
- Arquitectura: `docs/SELF_CONTACT_ARCHITECTURE.md`
