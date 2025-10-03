# Solución: Persistencia y Cumplimiento de Flujos Conversacionales

## Problema Identificado

Cuando el bot experimenta lag o demora en responder, el usuario puede escribir el mismo mensaje múltiples veces. Esto causaba que:

1. **Primera vez**: El mensaje se procesa correctamente y el flujo avanza al siguiente paso
2. **Segunda vez**: El mensaje duplicado se procesa en el nuevo paso, generando un error de validación

### Ejemplo del Problema

```
Usuario: "Catita Linda ♡"  (respuesta a "¿A quién se lo vas a prestar?")
Bot: [procesando... por lag del servidor]
Usuario: "Catita Linda ♡"  (el usuario lo escribe de nuevo pensando que no llegó)
Bot: "¿Qué le vas a prestar a Catita Linda ♡?"
Bot: "Hubo un problema procesando tu respuesta."  ← ERROR
```

El segundo "Catita Linda ♡" se interpreta como respuesta a "¿Qué le vas a prestar?" en lugar de ser ignorado como duplicado.

## Solución Implementada

### 1. Detección de Mensajes Duplicados

**Ubicación**: `conversation-manager.ts:498-516`

Se implementó un sistema de detección de mensajes duplicados que:

- **Guarda el último mensaje procesado** en el contexto del flujo
- **Registra el timestamp** del último mensaje
- **Compara mensajes entrantes** con el último procesado
- **Ignora duplicados** si llegan dentro de 5 segundos

```typescript
// ===== DETECCIÓN DE MENSAJES DUPLICADOS =====
const lastMessage = state.context?.last_message;
const lastMessageTime = state.context?.last_message_time;
const currentTime = Date.now();

if (lastMessage === input.trim() && lastMessageTime) {
  const timeDiff = (currentTime - lastMessageTime) / 1000;
  if (timeDiff < 5) {
    console.log(`[DUPLICATE] Ignoring duplicate message within ${timeDiff.toFixed(1)}s:`, input);
    return {
      success: true,
      message: null, // No responder a mensajes duplicados
      nextStep: state.current_step,
      completed: false,
      context: state.context
    };
  }
}
```

### 2. Validación Estricta en `awaiting_item`

**Ubicación**: `conversation-manager.ts:54-58`

Antes, la validación de `awaiting_item` aceptaba cualquier entrada (`() => true`). Ahora solo acepta los valores válidos de botones:

```typescript
awaiting_item: (context, input) => {
  // Solo aceptar valores válidos de loan_type (money, object, other)
  const validTypes = ['money', 'object', 'other'];
  return validTypes.includes(input.toLowerCase().trim());
}
```

### 3. Actualización del Contexto con Tracking de Mensajes

**Ubicación**: `conversation-manager.ts:546-551`

Cada vez que se procesa un mensaje exitosamente, se actualiza el contexto con el mensaje y timestamp:

```typescript
let updatedContext = {
  ...state.context,
  ...handlerResult,
  last_message: input.trim(),
  last_message_time: Date.now()
};
```

### 4. Manejo en Webhook para Mensajes Duplicados

**Ubicación**: `wa_webhook/index.ts:404-408`

El webhook detecta cuando `result.message === null` (indicador de duplicado) y retorna sin enviar respuesta:

```typescript
if (result.message === null) {
  console.log('[DUPLICATE] Skipping response for duplicate message');
  return { success: true, skipped: true, reason: 'duplicate_message' };
}
```

## Comportamiento Esperado Ahora

### Escenario 1: Mensaje Duplicado por Lag

```
Usuario: "Catita Linda ♡"  (1ra vez - timestamp: 14:34:00)
Bot: [procesando...]
Usuario: "Catita Linda ♡"  (2da vez - timestamp: 14:34:02, diff: 2s)
Bot: [detecta duplicado, NO responde]
Bot: "¿Qué le vas a prestar a Catita Linda ♡?" (respuesta de la 1ra vez)
```

### Escenario 2: Usuario Escribe Texto Inválido en Paso de Botones

```
Bot: "¿Qué le vas a prestar a Juan?"
Usuario: "algo"  (respuesta inválida)
Bot: "Por favor selecciona una opción usando los botones:
     💰 Dinero
     📦 Un objeto
     ✏️ Otra cosa"
[El flujo permanece en awaiting_item hasta recibir respuesta válida]
```

### Escenario 3: Mensaje Duplicado Después de 5 Segundos

```
Usuario: "Catita Linda ♡"  (1ra vez - timestamp: 14:34:00)
Bot: "¿Qué le vas a prestar a Catita Linda ♡?"
Usuario: "Dinero"
Bot: "¿Cuánto dinero le vas a prestar?"
Usuario: "Catita Linda ♡"  (2da vez - timestamp: 14:34:08, diff: 8s)
Bot: "Por favor ingresa un monto válido (solo números)..."
[Se procesa como mensaje nuevo porque pasaron más de 5 segundos]
```

## Ventajas de la Solución

✅ **Previene errores por lag**: Los mensajes duplicados no rompen el flujo
✅ **Persistencia del flujo**: El flujo permanece en el mismo paso hasta recibir respuesta válida
✅ **Mejor UX**: El usuario no ve errores confusos cuando el bot está lento
✅ **Validación robusta**: Solo acepta respuestas válidas en cada paso
✅ **Sin cambios en BD**: La solución usa el campo `context` existente

## Archivos Modificados

1. **`conversation-manager.ts`**
   - Líneas 498-516: Detección de mensajes duplicados
   - Líneas 54-58: Validación estricta de `awaiting_item`
   - Líneas 546-551: Actualización de contexto con tracking
   - Línea 742: Mensaje de validación mejorado

2. **`wa_webhook/index.ts`**
   - Líneas 404-408: Manejo de mensajes duplicados en webhook

## Configuración

### Ventana de Deduplicación

La ventana de 5 segundos se puede ajustar modificando la constante en `conversation-manager.ts:506`:

```typescript
if (timeDiff < 5) {  // ← Cambiar este valor (en segundos)
```

Valores recomendados:
- **3 segundos**: Para redes rápidas
- **5 segundos**: Balance entre UX y precisión (actual)
- **10 segundos**: Para conexiones muy lentas

## Logs para Debugging

Los logs clave para monitorear el sistema:

```typescript
[DUPLICATE] Ignoring duplicate message within Xs: <mensaje>
[DUPLICATE] Skipping response for duplicate message
```

Estos logs aparecen cuando se detecta y maneja un mensaje duplicado correctamente.

## Testing

Para probar la solución:

1. **Escenario de lag**: Escribir el mismo mensaje 2-3 veces rápidamente en WhatsApp
2. **Escenario de validación**: Escribir texto libre cuando se esperan botones
3. **Escenario de timeout**: Esperar más de 5 segundos entre mensajes idénticos

## Limitaciones Conocidas

- La deduplicación solo funciona para mensajes de **texto idénticos**
- No detecta variaciones mínimas (ej: "Juan" vs "juan ")
- La ventana de 5 segundos es fija por usuario/flujo

## Próximos Pasos Opcionales

1. **Normalización de texto**: Ignorar mayúsculas/minúsculas y espacios en deduplicación
2. **Deduplicación por hash**: Usar MD5/SHA para comparar mensajes
3. **Ventana adaptativa**: Ajustar la ventana según latencia del servidor
