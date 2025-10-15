-- Migration: Setup Scheduler Cron Job
-- Configura pg_cron para ejecutar el scheduler automáticamente todos los días a las 09:00 AM
--
-- IMPORTANTE: Esta migración requiere configuración manual adicional:
-- 1. Generar token de autenticación: openssl rand -base64 32
-- 2. Guardar token en Vault (ver abajo)
-- 3. Configurar variable de entorno SCHEDULER_AUTH_TOKEN en Edge Functions

-- 1. Habilitar extensiones requeridas
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Guardar token de autenticación en Vault
-- NOTA: Reemplazar 'YOUR_GENERATED_TOKEN' con un token real generado
-- Para generar: openssl rand -base64 32
--
-- DESCOMENTA y ejecuta esto MANUALMENTE después de generar el token:
-- SELECT vault.create_secret('YOUR_GENERATED_TOKEN', 'scheduler_auth_token');

-- 3. Crear cron job para ejecutar scheduler diariamente
-- NOTA: Esta sección requiere configuración MANUAL porque necesita:
-- - Token de autenticación guardado en Vault
-- - URL del proyecto configurada
--
-- INSTRUCCIONES:
-- 1. Primero genera y guarda el token en Vault (ver paso 2 arriba)
-- 2. Luego ejecuta el siguiente comando reemplazando YOUR_PROJECT_URL:
--
-- SELECT cron.schedule(
--   'daily-reminder-scheduler',
--   '0 9 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'YOUR_PROJECT_URL/functions/v1/scheduler_dispatch',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'scheduler_auth_token')
--     ),
--     body := jsonb_build_object('dry_run', false),
--     timeout_milliseconds := 300000
--   ) as request_id;
--   $$
-- );

-- La migración continúa sin crear el cron job automáticamente
-- para evitar errores de configuración

-- 4. Comentarios de documentación
COMMENT ON EXTENSION pg_cron IS 'Scheduler de tareas programadas para ejecutar el scheduler de recordatorios diariamente';
COMMENT ON EXTENSION pg_net IS 'Cliente HTTP asincrónico para invocar Edge Functions desde Postgres';

-- 5. Verificar si el cron job existe (opcional, no falla si no existe)
DO $$
DECLARE
  job_count integer;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'daily-reminder-scheduler';

  IF job_count > 0 THEN
    RAISE NOTICE '✅ Cron job encontrado: daily-reminder-scheduler';
  ELSE
    RAISE NOTICE '⚠️ Cron job NO encontrado. Recuerda configurarlo manualmente siguiendo las instrucciones arriba.';
  END IF;
END $$;

-- PASOS POST-MIGRACIÓN:
-- ========================
--
-- 1. Generar token de autenticación:
--    openssl rand -base64 32
--
-- 2. Guardar token en Vault (ejecutar en SQL Editor):
--    SELECT vault.create_secret('TU_TOKEN_GENERADO', 'scheduler_auth_token');
--
-- 3. Configurar variable de entorno en Edge Functions (CLI):
--    npx supabase secrets set SCHEDULER_AUTH_TOKEN='TU_TOKEN_GENERADO'
--
-- 4. Actualizar project_url en el cron job (si es necesario):
--    SELECT cron.alter_job(
--      job_id := (SELECT jobid FROM cron.job WHERE jobname = 'daily-reminder-scheduler'),
--      command := $$
--        SELECT net.http_post(
--          url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/scheduler_dispatch',
--          headers := jsonb_build_object(
--            'Content-Type', 'application/json',
--            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'scheduler_auth_token')
--          ),
--          body := jsonb_build_object('dry_run', false),
--          timeout_milliseconds := 300000
--        ) as request_id;
--      $$
--    );
--
-- 5. Verificar que el cron job está activo:
--    SELECT jobid, schedule, command, active
--    FROM cron.job
--    WHERE jobname = 'daily-reminder-scheduler';
--
-- GESTIÓN DEL CRON JOB:
-- =====================
--
-- Ver historial de ejecuciones:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-reminder-scheduler')
-- ORDER BY start_time DESC LIMIT 10;
--
-- Desactivar temporalmente:
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'daily-reminder-scheduler'),
--   active := false
-- );
--
-- Reactivar:
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'daily-reminder-scheduler'),
--   active := true
-- );
--
-- Cambiar horario (ejemplo: 10:00 AM):
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'daily-reminder-scheduler'),
--   schedule := '0 10 * * *'
-- );
--
-- Eliminar cron job:
-- SELECT cron.unschedule('daily-reminder-scheduler');
