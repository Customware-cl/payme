// Script de configuración de bot Telegram
// Configura webhook, comandos y actualiza tenant

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramClient } from '../supabase/functions/_shared/telegram-client.ts';

interface TelegramBotConfig {
  botToken: string;
  webhookUrl: string;
  secretToken?: string;
  botUsername?: string;
  tenantId: string;
}

class TelegramBotSetup {
  private supabase: any;
  private telegram: TelegramClient;

  constructor(private config: TelegramBotConfig) {
    this.supabase = createClient(
      'https://qgjxkszfdoolaxmsupil.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnanhrc3pmZG9vbGF4bXN1cGlsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU4OTk3MSwiZXhwIjoyMDc0MTY1OTcxfQ.G0dkXunOrSLXfX6_Wa9YeWIyyS2wXbU_c18uULKpBH0'
    );
    this.telegram = new TelegramClient(config.botToken);
  }

  async setupBot(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🤖 Configurando bot de Telegram...');
      console.log('=' .repeat(50));

      // 1. Verificar que el bot funciona
      console.log('1️⃣ Verificando bot...');
      const botInfo = await this.telegram.getMe();

      if (!botInfo.success) {
        return { success: false, error: `Error obteniendo info del bot: ${botInfo.error}` };
      }

      console.log(`✅ Bot verificado: @${botInfo.botInfo?.username} (${botInfo.botInfo?.first_name})`);
      this.config.botUsername = botInfo.botInfo?.username;

      // 2. Configurar webhook
      console.log('\n2️⃣ Configurando webhook...');
      const webhookResult = await this.telegram.setWebhook(
        this.config.webhookUrl,
        this.config.secretToken
      );

      if (!webhookResult.success) {
        return { success: false, error: `Error configurando webhook: ${webhookResult.error}` };
      }

      console.log(`✅ Webhook configurado: ${this.config.webhookUrl}`);

      // 3. Configurar comandos del bot
      console.log('\n3️⃣ Configurando comandos...');
      const commandsResult = await this.telegram.setMyCommands([
        { command: 'start', description: 'Iniciar conversación con el bot' },
        { command: 'prestamo', description: 'Registrar nuevo préstamo' },
        { command: 'servicio', description: 'Configurar servicio mensual' },
        { command: 'estado', description: 'Ver estado de mis acuerdos' },
        { command: 'reprogramar', description: 'Reprogramar fecha de vencimiento' },
        { command: 'ayuda', description: 'Mostrar ayuda y comandos disponibles' }
      ]);

      if (!commandsResult.success) {
        console.warn(`⚠️ Error configurando comandos: ${commandsResult.error}`);
        // No es crítico, continuar
      } else {
        console.log('✅ Comandos del bot configurados');
      }

      // 4. Actualizar configuración del tenant
      console.log('\n4️⃣ Actualizando tenant...');
      const { error: updateError } = await this.supabase
        .from('tenants')
        .update({
          telegram_bot_token: this.config.botToken,
          telegram_bot_username: this.config.botUsername,
          telegram_webhook_secret: this.config.secretToken,
          telegram_enabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.config.tenantId);

      if (updateError) {
        return { success: false, error: `Error actualizando tenant: ${updateError.message}` };
      }

      console.log('✅ Tenant actualizado con configuración de Telegram');

      // 5. Verificar configuración final
      console.log('\n5️⃣ Verificando configuración...');
      const { data: tenant } = await this.supabase
        .from('tenants')
        .select('telegram_enabled, telegram_bot_username, telegram_bot_token')
        .eq('id', this.config.tenantId)
        .single();

      if (tenant?.telegram_enabled) {
        console.log('✅ Configuración verificada correctamente');
        console.log('\n🎉 ¡Bot de Telegram configurado exitosamente!');
        console.log(`📱 Bot: @${tenant.telegram_bot_username}`);
        console.log(`🔗 Webhook: ${this.config.webhookUrl}`);
        console.log(`🆔 Tenant ID: ${this.config.tenantId}`);
      } else {
        return { success: false, error: 'Configuración no se guardó correctamente' };
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testBot(): Promise<void> {
    console.log('\n🧪 Probando bot...');
    console.log('Para probar el bot:');
    console.log(`1. Busca @${this.config.botUsername} en Telegram`);
    console.log('2. Envía /start');
    console.log('3. Prueba comandos como "nuevo préstamo" o "ayuda"');
    console.log('\nMonitorea los logs en Supabase Edge Functions para debug.');
  }

  async removeWebhook(): Promise<{ success: boolean; error?: string }> {
    console.log('🗑️ Removiendo webhook...');

    const result = await this.telegram.setWebhook(''); // URL vacía remueve el webhook

    if (result.success) {
      console.log('✅ Webhook removido');

      // Deshabilitar en tenant
      await this.supabase
        .from('tenants')
        .update({
          telegram_enabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.config.tenantId);

      console.log('✅ Telegram deshabilitado en tenant');
    }

    return result;
  }
}

// Función para ejecutar configuración
export async function setupTelegramBot(config: TelegramBotConfig) {
  const setup = new TelegramBotSetup(config);
  const result = await setup.setupBot();

  if (result.success) {
    await setup.testBot();
  }

  return result;
}

// Función para remover configuración
export async function removeTelegramBot(config: Pick<TelegramBotConfig, 'botToken' | 'tenantId'>) {
  const setup = new TelegramBotSetup({
    ...config,
    webhookUrl: '',
    tenantId: config.tenantId
  });

  return setup.removeWebhook();
}

// Ejecutar si se llama directamente
if (import.meta.main) {
  const command = Deno.args[0] || 'help';

  const tenantId = 'd4c43ab8-426f-4bb9-8736-dfe301459590'; // Tenant principal
  const supabaseProjectRef = 'qgjxkszfdoolaxmsupil'; // Extraído de la URL

  switch (command) {
    case 'setup':
      const botToken = Deno.args[1];
      const secretToken = Deno.args[2] || 'prestabot_telegram_secret_2025';

      if (!botToken) {
        console.error('❌ Falta BOT_TOKEN');
        console.log('Uso: deno run --allow-net setup-telegram-bot.ts setup BOT_TOKEN [SECRET_TOKEN]');
        console.log('');
        console.log('Ejemplo:');
        console.log('deno run --allow-net setup-telegram-bot.ts setup 7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw SECRET_TOKEN');
        Deno.exit(1);
      }

      const webhookUrl = `https://${supabaseProjectRef}.supabase.co/functions/v1/tg_webhook`;

      console.log('🚀 Configurando bot de Telegram para PrestaBot');
      console.log(`📋 Tenant ID: ${tenantId}`);
      console.log(`🔗 Webhook URL: ${webhookUrl}`);
      console.log(`🔑 Secret Token: ${secretToken}`);
      console.log('');

      const result = await setupTelegramBot({
        botToken,
        webhookUrl,
        secretToken,
        tenantId
      });

      if (result.success) {
        console.log('\n🎉 Configuración completada exitosamente!');
        Deno.exit(0);
      } else {
        console.error(`❌ Error: ${result.error}`);
        Deno.exit(1);
      }
      break;

    case 'remove':
      const removeToken = Deno.args[1];

      if (!removeToken) {
        console.error('❌ Falta BOT_TOKEN');
        console.log('Uso: deno run --allow-net setup-telegram-bot.ts remove BOT_TOKEN');
        Deno.exit(1);
      }

      const removeResult = await removeTelegramBot({
        botToken: removeToken,
        tenantId
      });

      if (removeResult.success) {
        console.log('✅ Bot removido exitosamente');
      } else {
        console.error(`❌ Error: ${removeResult.error}`);
      }
      break;

    default:
      console.log('🤖 Script de configuración de Telegram Bot para PrestaBot');
      console.log('');
      console.log('Comandos disponibles:');
      console.log('  setup BOT_TOKEN [SECRET_TOKEN] - Configurar bot');
      console.log('  remove BOT_TOKEN               - Remover configuración');
      console.log('');
      console.log('Pasos para obtener BOT_TOKEN:');
      console.log('1. Habla con @BotFather en Telegram');
      console.log('2. Envía /newbot');
      console.log('3. Sigue las instrucciones');
      console.log('4. Copia el token y úsalo en este script');
      console.log('');
      console.log('Ejemplos:');
      console.log('deno run --allow-net setup-telegram-bot.ts setup 7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw');
      console.log('deno run --allow-net setup-telegram-bot.ts remove 7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw');
  }
}