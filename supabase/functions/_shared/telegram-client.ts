// Cliente minimalista para Telegram Bot API
// Ventaja sobre WhatsApp: Sin ventana 24h, sin templates complejos, gratis

export interface TelegramMessage {
  chat_id: string | number
  text: string
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML'
  reply_markup?: TelegramKeyboard
}

export interface TelegramKeyboard {
  inline_keyboard?: TelegramButton[][]
  keyboard?: TelegramButton[][]
  resize_keyboard?: boolean
  one_time_keyboard?: boolean
  remove_keyboard?: boolean
}

export interface TelegramButton {
  text: string
  callback_data?: string
  url?: string
}

export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: TelegramUser
    chat: {
      id: number
      type: string
      first_name?: string
      username?: string
    }
    date: number
    text?: string
  }
  callback_query?: {
    id: string
    from: TelegramUser
    message: any
    data: string
  }
}

export class TelegramClient {
  private baseUrl: string

  constructor(private botToken: string) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`
  }

  // Enviar mensaje de texto simple
  async sendMessage(
    chatId: string | number,
    text: string,
    options: {
      parse_mode?: 'Markdown' | 'HTML'
      reply_markup?: TelegramKeyboard
    } = {}
  ): Promise<{ success: boolean; error?: string; messageId?: number }> {
    try {
      const message: TelegramMessage = {
        chat_id: chatId,
        text: this.formatTextForTelegram(text),
        parse_mode: options.parse_mode || 'Markdown',
        ...options
      }

      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      })

      const result = await response.json()

      if (result.ok) {
        return {
          success: true,
          messageId: result.result.message_id
        }
      } else {
        console.error('Error enviando mensaje Telegram:', result)
        return {
          success: false,
          error: result.description || 'Error desconocido'
        }
      }

    } catch (error) {
      console.error('Error en TelegramClient.sendMessage:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Enviar mensaje con botones inline (equivalente a Quick Reply de WhatsApp)
  async sendMessageWithButtons(
    chatId: string | number,
    text: string,
    buttons: Array<{ text: string; data: string }>,
    columns: number = 2
  ): Promise<{ success: boolean; error?: string }> {
    const keyboard = this.createInlineKeyboard(buttons, columns)

    return this.sendMessage(chatId, text, {
      reply_markup: keyboard
    })
  }

  // Responder a callback query (cuando usuario presiona botón)
  async answerCallbackQuery(
    callbackQueryId: string,
    options: {
      text?: string
      show_alert?: boolean
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          ...options
        })
      })

      const result = await response.json()
      return { success: result.ok, error: result.description }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Configurar webhook
  async setWebhook(webhookUrl: string, secretToken?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secretToken,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: true
        })
      })

      const result = await response.json()
      return { success: result.ok, error: result.description }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Configurar comandos del bot
  async setMyCommands(commands: Array<{ command: string; description: string }>): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands })
      })

      const result = await response.json()
      return { success: result.ok, error: result.description }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Obtener info del bot
  async getMe(): Promise<{ success: boolean; botInfo?: TelegramUser; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/getMe`)
      const result = await response.json()

      return {
        success: result.ok,
        botInfo: result.result,
        error: result.description
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Utilidades privadas
  private formatTextForTelegram(text: string): string {
    // Telegram soporta Markdown nativo - mucho más fácil que WhatsApp HSM
    return text
      .replace(/\*\*(.*?)\*\*/g, '*$1*') // Bold
      .replace(/__(.*?)__/g, '_$1_')     // Italic
      .replace(/`(.*?)`/g, '`$1`')       // Code
      .replace(/\n/g, '\n')              // Preservar saltos de línea
  }

  private createInlineKeyboard(
    buttons: Array<{ text: string; data: string }>,
    columns: number = 2
  ): TelegramKeyboard {
    const keyboard: TelegramButton[][] = []

    // Organizar botones en filas
    for (let i = 0; i < buttons.length; i += columns) {
      const row = buttons.slice(i, i + columns).map(btn => ({
        text: btn.text,
        callback_data: btn.data
      }))
      keyboard.push(row)
    }

    return { inline_keyboard: keyboard }
  }
}

// Utilidades para conversión desde sistema existente
export class TelegramMessageAdapter {

  // Convertir mensaje de ConversationManager a formato Telegram
  static adaptMessage(message: string, buttons?: Array<{ text: string; data?: string }>): {
    text: string
    keyboard?: TelegramKeyboard
  } {
    // El mensaje del ConversationManager ya está en español chileno
    // Solo necesitamos formatearlo para Telegram

    let adaptedText = message
      .replace(/📝 \*\*(.*?)\*\*/g, '*$1*')  // Adapt bold
      .replace(/🎯 \*\*(.*?)\*\*/g, '*$1*')  // Adapt bold
      .replace(/📅 \*\*(.*?)\*\*/g, '*$1*')  // Adapt bold

    let keyboard: TelegramKeyboard | undefined

    if (buttons && buttons.length > 0) {
      keyboard = {
        inline_keyboard: [
          buttons.map(btn => ({
            text: btn.text,
            callback_data: btn.data || btn.text.toLowerCase().replace(/\s+/g, '_')
          }))
        ]
      }
    }

    return { text: adaptedText, keyboard }
  }

  // Convertir botones de WhatsApp a Telegram
  static convertButtonsToTelegram(buttons: any[]): TelegramButton[] {
    if (!buttons) return []

    return buttons.map(btn => ({
      text: btn.text || btn.label || 'Opción',
      callback_data: btn.payload || btn.id || btn.text?.toLowerCase().replace(/\s+/g, '_') || 'option'
    }))
  }

  // Extraer texto del update de Telegram
  static extractTextFromUpdate(update: TelegramUpdate): string {
    if (update.message?.text) {
      // Convertir comandos a texto natural para ConversationManager
      const text = update.message.text

      if (text.startsWith('/')) {
        return this.convertCommandToText(text)
      }

      return text
    }

    if (update.callback_query?.data) {
      return update.callback_query.data
    }

    return ''
  }

  // Convertir comandos de Telegram a intenciones del sistema
  private static convertCommandToText(command: string): string {
    const commandMap: Record<string, string> = {
      '/start': 'hola',
      '/prestamo': 'nuevo préstamo',
      '/servicio': 'nuevo servicio',
      '/estado': 'estado de mis préstamos',
      '/reprogramar': 'reprogramar',
      '/ayuda': 'ayuda',
      '/help': 'ayuda'
    }

    return commandMap[command.toLowerCase()] || command.slice(1) // Remove '/' if not mapped
  }
}

// Ejemplo de uso:
// const telegram = new TelegramClient('BOT_TOKEN')
// await telegram.sendMessage(chatId, 'Hola! ¿En qué puedo ayudarte?')
// await telegram.sendMessageWithButtons(chatId, 'Elige una opción:', [
//   { text: 'Nuevo Préstamo', data: 'new_loan' },
//   { text: 'Ver Estado', data: 'check_status' }
// ])