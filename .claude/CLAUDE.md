1. Usa mcp supabase cada vez que requieras modificar la base de datos
2. cada cambio, déjalo registrado en un changelog
3. cuando despliegues una edge function, asegurate de leer la documentación de docs/EDGE_FUNCTIONS_DEPLOYMENT.md
4. **CRÍTICO - Schema Awareness**: Cada vez que modifiques las tablas `agreements`, `tenant_contacts` o `contact_profiles` (agregar/eliminar columnas, cambiar tipos, modificar enums), DEBES actualizar inmediatamente `supabase/functions/_shared/schema-provider.ts` para reflejar los cambios. El AI Agent depende de este archivo para generar SQL correcto. Schema desactualizado = queries incorrectos.
