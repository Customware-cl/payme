# Migración a tenant_contacts - Cambios pendientes

## Estado de la migración

### ✅ Completado
1. **Base de datos** - Migración 022 aplicada exitosamente
   - Todos los `contacts` tienen `contact_profile_id`
   - Todos los contactos migrados a `tenant_contacts`
   - Agreements actualizados con `tenant_contact_id` y `lender_tenant_contact_id`

2. **Archivos refactorizados**
   - `conversation-manager.ts` ✅
   - `flow-handlers.ts` ✅
   - `wa_webhook/index.ts` ✅ (Archivo principal del webhook - ~2000 líneas)
   - `whatsapp-window-manager.ts` ✅ (Gestor de ventana de 24h WhatsApp)

### ⚠️ Pendientes (CRÍTICO)

#### ✅ wa_webhook/index.ts - COMPLETADO

**Cambios realizados:**
- ✅ Línea 167-235: Refactorizado patrón de obtención/creación de contacto usando tenant_contacts
- ✅ Línea 360-373: Actualizado comando "estado" para usar tenant_contacts con joins
- ✅ Línea 447, 1192, 1840: Corregido acceso a phone_e164 usando contact_profiles join
- ✅ Línea 705-709: Actualizado búsqueda de contacto seleccionado a tenant_contacts
- ✅ Línea 1037-1048: Actualizado botón "check_status" para usar nuevas columnas
- ✅ Línea 1267-1295: Actualizado opt_in/opt_out para usar tenant_contacts
- ✅ Línea 1305: Actualizado loan_returned para usar tenant_contact_id
- ✅ Línea 1368, 1406: Actualizado confirmación de préstamo para usar tenant_contact_id
- ✅ Línea 1386, 1393: Actualizado notificación a lender usando lender_tenant_contact_id
- ✅ Línea 1538-1563: Actualizado rechazo de préstamo con joins correctos
- ✅ Línea 1606-1732: Refactorizado procesamiento de contactos compartidos con patrón de dos pasos

**Patrón implementado:**
```typescript
// 1. Buscar tenant_contact con join a contact_profiles
let { data: tenantContact } = await supabase
  .from('tenant_contacts')
  .select('*, contact_profiles(phone_e164, telegram_id)')
  .eq('tenant_id', tenant.id)
  .eq('contact_profiles.phone_e164', formattedPhone)
  .maybeSingle();

// 2. Si no existe, crear contact_profile primero
let { data: contactProfile } = await supabase
  .from('contact_profiles')
  .select('*')
  .eq('phone_e164', formattedPhone)
  .maybeSingle();

// 3. Luego crear tenant_contact
const { data: newTenantContact } = await supabase
  .from('tenant_contacts')
  .insert({
    tenant_id: tenant.id,
    contact_profile_id: contactProfile.id,
    name: contactName,
    // ...
  })
  .select('*, contact_profiles(phone_e164, telegram_id)')
  .single();
```

#### ✅ whatsapp-window-manager.ts - COMPLETADO

**Cambios realizados:**
- ✅ Línea 55: Actualizado getWindowStatus() para usar tenant_contact_id en whatsapp_messages
- ✅ Línea 250-263: Actualizado sendTemplateMessage() para usar tenant_contacts con join a contact_profiles
- ✅ Línea 304: Actualizado insert en whatsapp_messages para usar tenant_contact_id
- ✅ Línea 344-357: Actualizado sendFreeFormMessage() para usar tenant_contacts con join
- ✅ Línea 386: Actualizado insert en whatsapp_messages para usar tenant_contact_id
- ✅ Línea 517: Actualizado getWindowStats() para usar tenant_contacts

**Patrón de acceso a phone:**
```typescript
// Query con join
const { data: contact } = await supabase
  .from('tenant_contacts')
  .select('*, contact_profiles(phone_e164)')
  .eq('id', contactId)
  .single();

// Acceso al teléfono
contact.contact_profiles.phone_e164
```

#### Otros archivos pendientes:
- `flow-data-provider.ts` - Cargar datos desde tenant_contacts
- `menu-data/index.ts` - Ya fue actualizado parcialmente
- `generate-menu-token/index.ts` - Validar con tenant_contacts
- `loan-web-form/index.ts` - Crear agreements con tenant_contact_id

## Próximos pasos

1. ✅ Actualizar wa_webhook/index.ts (CRÍTICO - archivo principal) - COMPLETADO
2. ✅ Actualizar whatsapp-window-manager.ts - COMPLETADO
3. Actualizar flow-data-provider.ts (próximo archivo prioritario)
4. Actualizar archivos _shared restantes
5. Actualizar edge functions de menú
6. Testing completo
7. Deploy progresivo

## Notas importantes

- La tabla `contacts` debe mantenerse por ahora como backup
- Todos los nuevos registros deben ir a `tenant_contacts`
- El contactId que se pasa en flujos conversacionales ahora es `tenant_contact.id`
- Las consultas de agreements deben usar las nuevas columnas:
  - `tenant_contact_id` (borrower)
  - `lender_tenant_contact_id` (lender)
