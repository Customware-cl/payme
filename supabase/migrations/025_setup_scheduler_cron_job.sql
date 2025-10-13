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
-- NOTA: Reemplazar 'YOUR_PROJECT_URL' con la URL real de tu proyecto
-- Ejemplo: https://qgjxkszfdoolaxmsupil.supabase.co
DO $$
DECLARE
  project_url text := 'YOUR_PROJECT_URL';
BEGIN
  -- Solo crear el cron job si no existe
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-reminder-scheduler') THEN
    PERFORM cron.schedule(
      'daily-reminder-scheduler',
      '0 9 * * *', -- Todos los días a las 09:00 AM
      format($$
        SELECT net.http_post(
          url := '%s/functions/v1/scheduler_dispatch',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'scheduler_auth_token')
          ),
          body := jsonb_build_object('dry_run', false),
          timeout_milliseconds := 300000
        ) as request_id;
      $$, project_url)
    );

    RAISE NOTICE 'Cron job "daily-reminder-scheduler" creado exitosamente';
  ELSE
    RAISE NOTICE 'Cron job "daily-reminder-scheduler" ya existe, saltando...';
  END IF;
END $$;

-- 4. Comentarios de documentación
COMMENT ON EXTENSION pg_cron IS 'Scheduler de tareas programadas para ejecutar el scheduler de recordatorios diariamente';
COMMENT ON EXTENSION pg_net IS 'Cliente HTTP asincrónico para invocar Edge Functions desde Postgres';

-- 5. Verificar que el cron job fue creado
DO $$
DECLARE
  job_count integer;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'daily-reminder-scheduler';

  IF job_count > 0 THEN
    RAISE NOTICE '✅ Cron job verificado: daily-reminder-scheduler';
  ELSE
    RAISE WARNING '⚠️ Cron job NO encontrado. Verificar configuración manual.';
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
