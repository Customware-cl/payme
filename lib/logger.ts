// Sistema de logging para Edge Functions
import { LogEntry } from '../types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private functionName: string;
  private tenantId?: string;
  private contactId?: string;
  private agreementId?: string;

  constructor(
    functionName: string,
    context?: {
      tenantId?: string;
      contactId?: string;
      agreementId?: string;
    }
  ) {
    this.functionName = functionName;
    this.tenantId = context?.tenantId;
    this.contactId = context?.contactId;
    this.agreementId = context?.agreementId;
  }

  /**
   * Crea una nueva instancia del logger con contexto actualizado
   */
  withContext(context: {
    tenantId?: string;
    contactId?: string;
    agreementId?: string;
  }): Logger {
    return new Logger(this.functionName, {
      tenantId: context.tenantId || this.tenantId,
      contactId: context.contactId || this.contactId,
      agreementId: context.agreementId || this.agreementId,
    });
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log('error', message, metadata);
  }

  /**
   * Log de errores con stack trace
   */
  errorWithStack(message: string, error: Error, metadata?: Record<string, any>): void {
    this.log('error', message, {
      ...metadata,
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name,
    });
  }

  /**
   * Log específico para eventos de WhatsApp
   */
  whatsappEvent(
    event: 'message_sent' | 'message_received' | 'webhook_received' | 'status_update',
    details: Record<string, any>
  ): void {
    this.info(`WhatsApp ${event}`, {
      event_type: 'whatsapp',
      event_name: event,
      ...details,
    });
  }

  /**
   * Log específico para scheduler
   */
  schedulerEvent(
    event: 'processing_start' | 'instance_processed' | 'batch_complete' | 'error',
    details: Record<string, any>
  ): void {
    this.info(`Scheduler ${event}`, {
      event_type: 'scheduler',
      event_name: event,
      ...details,
    });
  }

  /**
   * Log específico para base de datos
   */
  databaseEvent(
    operation: 'select' | 'insert' | 'update' | 'delete' | 'rpc',
    table: string,
    details?: Record<string, any>
  ): void {
    this.debug(`Database ${operation} on ${table}`, {
      event_type: 'database',
      operation,
      table,
      ...details,
    });
  }

  /**
   * Método principal de logging
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    const logLevel = Deno.env.get('LOG_LEVEL') || 'info';
    const levels = ['debug', 'info', 'warn', 'error'];

    if (levels.indexOf(level) < levels.indexOf(logLevel)) {
      return; // No logear si está por debajo del nivel configurado
    }

    const logEntry: LogEntry = {
      level,
      message,
      function_name: this.functionName,
      timestamp: new Date().toISOString(),
      tenant_id: this.tenantId,
      contact_id: this.contactId,
      agreement_id: this.agreementId,
      metadata: metadata || {},
    };

    // En desarrollo, usar console
    if (Deno.env.get('ENVIRONMENT') === 'development') {
      this.consoleLog(logEntry);
    } else {
      // En producción, usar structured logging
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Logging para desarrollo con formato legible
   */
  private consoleLog(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const context = this.formatContext();
    const metadata = Object.keys(entry.metadata || {}).length > 0
      ? `\n  ${JSON.stringify(entry.metadata, null, 2)}`
      : '';

    const levelSymbols = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    };

    console.log(
      `${levelSymbols[entry.level]} [${timestamp}] ${entry.function_name}${context}: ${entry.message}${metadata}`
    );
  }

  /**
   * Formatea el contexto para logging legible
   */
  private formatContext(): string {
    const parts = [];
    if (this.tenantId) parts.push(`tenant:${this.tenantId.slice(-8)}`);
    if (this.contactId) parts.push(`contact:${this.contactId.slice(-8)}`);
    if (this.agreementId) parts.push(`agreement:${this.agreementId.slice(-8)}`);

    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  }
}

/**
 * Utilidades para timing y performance
 */
export class PerformanceLogger {
  private startTime: number;
  private logger: Logger;
  private operation: string;

  constructor(logger: Logger, operation: string) {
    this.logger = logger;
    this.operation = operation;
    this.startTime = performance.now();
    this.logger.debug(`Starting ${operation}`);
  }

  /**
   * Finaliza el timing y logea el resultado
   */
  end(metadata?: Record<string, any>): void {
    const duration = Math.round(performance.now() - this.startTime);
    this.logger.info(`Completed ${this.operation}`, {
      ...metadata,
      duration_ms: duration,
    });
  }

  /**
   * Finaliza con error
   */
  error(error: Error, metadata?: Record<string, any>): void {
    const duration = Math.round(performance.now() - this.startTime);
    this.logger.errorWithStack(`Failed ${this.operation}`, error, {
      ...metadata,
      duration_ms: duration,
    });
  }

  /**
   * Checkpoint intermedio
   */
  checkpoint(name: string, metadata?: Record<string, any>): void {
    const duration = Math.round(performance.now() - this.startTime);
    this.logger.debug(`${this.operation} checkpoint: ${name}`, {
      ...metadata,
      elapsed_ms: duration,
    });
  }
}

/**
 * Factory para crear loggers
 */
export function createLogger(
  functionName: string,
  context?: {
    tenantId?: string;
    contactId?: string;
    agreementId?: string;
  }
): Logger {
  return new Logger(functionName, context);
}

/**
 * Wrapper para logging de errores globales
 */
export function setupGlobalErrorHandler(functionName: string): void {
  globalThis.addEventListener('error', (event) => {
    const logger = createLogger(functionName);
    logger.errorWithStack('Unhandled error', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  globalThis.addEventListener('unhandledrejection', (event) => {
    const logger = createLogger(functionName);
    logger.error('Unhandled promise rejection', {
      reason: event.reason?.toString() || 'Unknown reason',
      promise: event.promise?.toString() || 'Unknown promise',
    });
  });
}

/**
 * Middleware para logging de requests HTTP
 */
export function logRequest(
  logger: Logger,
  request: Request,
  additionalInfo?: Record<string, any>
): void {
  logger.info('Incoming request', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    user_agent: request.headers.get('user-agent'),
    ...additionalInfo,
  });
}

/**
 * Middleware para logging de responses HTTP
 */
export function logResponse(
  logger: Logger,
  response: Response,
  duration?: number,
  additionalInfo?: Record<string, any>
): void {
  logger.info('Outgoing response', {
    status: response.status,
    status_text: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    duration_ms: duration,
    ...additionalInfo,
  });
}