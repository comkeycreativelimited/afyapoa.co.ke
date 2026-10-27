import pino from 'pino';

export interface LogContext {
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  facilityCode?: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === 'production';

export const pinoLogger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      'passwordHash',
      'refreshToken',
      'token',
      'accessToken',
      'mfaSecret',
      'mfaToken',
      'pin',
      'kraPin',
      'authorization',
      'headers.authorization',
      'phoneEncrypted',
      'valueEncrypted',
      'credentialsEncrypted',
      '*.password',
      '*.passwordHash',
      '*.refreshToken',
      '*.token',
      '*.accessToken',
      '*.mfaSecret',
      '*.pin',
      '*.kraPin',
      '*.authorization',
      '*.credentialsEncrypted',
      '*.phoneEncrypted',
      '*.valueEncrypted',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});

export class StructuredLogger {
  constructor(private readonly contextName: string = 'App') {}

  info(message: string, context?: LogContext): void {
    pinoLogger.info({ context: this.contextName, ...context }, message);
  }

  debug(message: string, context?: LogContext): void {
    pinoLogger.debug({ context: this.contextName, ...context }, message);
  }

  warn(message: string, context?: LogContext): void {
    pinoLogger.warn({ context: this.contextName, ...context }, message);
  }

  error(message: string, trace?: string, context?: LogContext): void {
    pinoLogger.error({ context: this.contextName, trace, ...context }, message);
  }

  child(context: LogContext): StructuredLogger {
    const childName = context.facilityCode || context.tenantId || this.contextName;
    return new StructuredLogger(String(childName));
  }
}

export const logger = new StructuredLogger('Root');
