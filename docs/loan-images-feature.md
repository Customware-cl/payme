# Feature: Imágenes Opcionales en Préstamos

## Descripción General

Esta funcionalidad permite a los usuarios adjuntar opcionalmente una imagen al momento de crear un préstamo. La imagen se almacena en Supabase Storage y se muestra en la vista de detalle del préstamo.

## Componentes Implementados

### 1. Almacenamiento (Supabase Storage)

**Bucket**: `loan-images`
- **Visibilidad**: Público (lectura)
- **Límite de tamaño**: 5 MB por archivo
- **Tipos permitidos**: image/jpeg, image/jpg, image/png, image/webp
- **Organización**: Carpetas por `agreement_id`

**Políticas RLS**:
- Lectura pública habilitada para todos los objetos
- Escritura permitida para usuarios autenticados

**Migración**: `supabase/migrations/026_loan_images_bucket.sql`

### 2. Base de Datos

**Tabla afectada**: `agreements`
- **Campo utilizado**: `metadata` (JSONB existente)
- **Nueva clave**: `image_url` dentro del objeto metadata
- **Ejemplo**:
  ```json
  {
    "image_url": "https://qgjxkszfdoolaxmsupil.supabase.co/storage/v1/object/public/loan-images/123/123_1234567890.jpg"
  }
  ```

No se requirió modificación de esquema, se reutilizó el campo `metadata` existente.

### 3. Interfaz de Usuario - Formulario de Préstamo

**Archivos modificados**:
- `public/loan-form/index.html`
- `public/loan-form/styles.css`
- `public/loan-form/app.js`

**Funcionalidad**:

1. **Sección de carga de imagen** (pantalla de confirmación):
   - Botón "Seleccionar imagen" que abre selector de archivos
   - Vista previa de la imagen seleccionada
   - Botón para remover imagen antes de enviar
   - Validación de tipo y tamaño de archivo

2. **Validaciones**:
   - Tipos permitidos: JPEG, JPG, PNG, WEBP
   - Tamaño máximo: 5 MB
   - Mensajes de error claros al usuario

3. **Flujo de creación**:
   ```
   1. Usuario llena formulario de préstamo
   2. Usuario selecciona imagen (opcional)
   3. Usuario ve preview de la imagen
   4. Usuario confirma creación
   5. Sistema crea préstamo (POST)
   6. Sistema sube imagen a Storage
   7. Sistema actualiza metadata del préstamo (PATCH)
   8. Redirige a lista de préstamos
   ```

4. **Funciones JavaScript clave**:
   - `validateImageFile(file)`: Valida tipo y tamaño
   - `showImagePreview(file)`: Muestra preview usando FileReader API
   - `removeImage()`: Limpia selección de imagen
   - `uploadImageToStorage(file, agreementId)`: Sube a Storage via REST API
   - `createLoan()`: Modificada para incluir proceso de imagen

### 4. Backend - Edge Function

**Archivo modificado**: `supabase/functions/loan-web-form/index.ts`

**Nuevos endpoints**:

1. **PATCH** para actualizar imagen:
   ```typescript
   PATCH /loan-web-form
   Body: {
     token: string,
     agreement_id: string,
     image_url: string
   }
   ```

   - Valida token
   - Obtiene metadata actual del agreement
   - Preserva metadata existente
   - Agrega/actualiza `image_url`
   - Retorna success/error

2. **CORS actualizado**:
   - Agregado método PATCH a headers permitidos

### 5. Vista de Detalle del Préstamo

**Archivos modificados**:
- `public/menu/loan-detail.html`
- `public/menu/loan-detail.js`
- `public/menu/styles.css`

**Funcionalidad**:

1. **Sección de imagen**:
   - Título: "📷 Imagen del préstamo"
   - Contenedor responsive para la imagen
   - Se muestra solo si existe `loan.metadata.image_url`
   - Clase `hidden` cuando no hay imagen

2. **Renderizado**:
   ```javascript
   if (loan.metadata && loan.metadata.image_url) {
       loanImage.src = loan.metadata.image_url;
       imageSection.classList.remove('hidden');
   } else {
       imageSection.classList.add('hidden');
   }
   ```

3. **Estilos**:
   - Imagen responsive: `max-height: 400px`
   - `object-fit: contain` para mantener aspecto
   - Bordes redondeados y sombra sutil
   - Fondo con gradiente para mejor presentación

## Seguridad

### Validaciones Implementadas

1. **Client-side** (app.js):
   - Tipo de archivo MIME
   - Tamaño máximo 5MB
   - Mensajes de error al usuario

2. **Storage Bucket**:
   - Tipos MIME permitidos configurados en bucket
   - Límite de tamaño 5MB a nivel de bucket
   - Lectura pública, escritura autenticada

3. **Edge Function**:
   - Validación de token antes de PATCH
   - Verificación de tenant_id para evitar modificar préstamos de otros tenants
   - Preservación de metadata existente (no sobrescribir)

### Consideraciones

- Las imágenes son **públicas** una vez subidas (bucket público)
- El nombre del archivo incluye timestamp para evitar colisiones
- Los archivos se organizan en carpetas por `agreement_id`
- No hay validación de contenido de imagen (solo MIME type)

## Rutas y URLs

### Storage
```
https://qgjxkszfdoolaxmsupil.supabase.co/storage/v1/object/public/loan-images/{agreement_id}/{agreement_id}_{timestamp}.{ext}
```

### API Endpoints
```
POST /loan-web-form (existente - crear préstamo)
PATCH /loan-web-form (nuevo - actualizar metadata con imagen)
```

## Testing

### Casos de Prueba Recomendados

1. **Crear préstamo SIN imagen**:
   - El préstamo debe crearse normalmente
   - No debe aparecer sección de imagen en detalle

2. **Crear préstamo CON imagen**:
   - Seleccionar imagen válida
   - Ver preview correcto
   - Confirmar creación
   - Verificar que imagen aparece en detalle

3. **Validaciones de imagen**:
   - Intentar subir archivo > 5MB (debe rechazar)
   - Intentar subir archivo no permitido (.pdf, .txt) (debe rechazar)
   - Subir imagen JPEG, PNG, WEBP (debe aceptar)

4. **Remover imagen antes de crear**:
   - Seleccionar imagen
   - Remover imagen
   - Crear préstamo
   - No debe haber imagen en detalle

5. **Múltiples préstamos**:
   - Crear varios préstamos con imágenes
   - Verificar que cada uno muestra su propia imagen

## Archivos Modificados

```
supabase/migrations/026_loan_images_bucket.sql      [NUEVO]
public/loan-form/index.html                         [MODIFICADO]
public/loan-form/styles.css                         [MODIFICADO]
public/loan-form/app.js                             [MODIFICADO]
supabase/functions/loan-web-form/index.ts           [MODIFICADO]
public/menu/loan-detail.html                        [MODIFICADO]
public/menu/loan-detail.js                          [MODIFICADO]
public/menu/styles.css                              [MODIFICADO]
CHANGELOG.md                                        [MODIFICADO]
```

## Posibles Mejoras Futuras

1. **Compresión de imágenes**: Comprimir automáticamente antes de subir
2. **Múltiples imágenes**: Permitir subir varias imágenes por préstamo
3. **Galería**: Vista de galería cuando hay múltiples imágenes
4. **Zoom**: Permitir hacer zoom o ver imagen en modal
5. **Edición**: Permitir cambiar/eliminar imagen después de crear préstamo
6. **Validación de contenido**: Verificar que realmente sea una imagen válida
7. **Thumbnails**: Generar miniaturas para carga más rápida en listas
8. **Caducidad**: Política de eliminación de imágenes de préstamos antiguos

## Notas de Implementación

- La funcionalidad es completamente **opcional**: los préstamos funcionan con o sin imagen
- Se utiliza un enfoque de **dos pasos** para garantizar que el préstamo se cree incluso si la imagen falla
- Si la imagen falla al subir, el préstamo ya está creado y el usuario es redirigido normalmente
- El error de imagen se muestra pero no bloquea el flujo
- Se preserva toda la metadata existente al agregar la URL de imagen
