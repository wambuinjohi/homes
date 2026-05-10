/**
 * Production-ready logging service
 * Replaces console.log statements with structured logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';
  private buffer: LogEntry[] = [];
  private maxBufferSize = 100;

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isProduction) return true;
    
    // In production, only log warnings and errors
    return level === 'warn' || level === 'error';
  }

  private output(entry: LogEntry) {
    if (this.isProduction) {
      // In production, send to external service (Sentry, LogRocket, etc.)
      this.buffer.push(entry);
      if (this.buffer.length > this.maxBufferSize) {
        this.buffer.shift();
      }
      
      // Only console.error for errors in production
      if (entry.level === 'error') {
        console.error(`[${entry.timestamp}] ${entry.message}`, entry.context, entry.error);
      }
    } else {
      // Development logging
      const logMethod = entry.level === 'error' ? console.error : 
                       entry.level === 'warn' ? console.warn : 
                       console.log;
      
      logMethod(`[${entry.level.toUpperCase()}] ${entry.message}`, 
                entry.context || '', 
                entry.error || '');
    }
  }

  debug(message: string, context?: Record<string, any>) {
    const entry = this.createLogEntry('debug', message, context);
    if (this.shouldLog('debug')) {
      this.output(entry);
    }
  }

  info(message: string, context?: Record<string, any>) {
    const entry = this.createLogEntry('info', message, context);
    if (this.shouldLog('info')) {
      this.output(entry);
    }
  }

  warn(message: string, context?: Record<string, any>) {
    const entry = this.createLogEntry('warn', message, context);
    if (this.shouldLog('warn')) {
      this.output(entry);
    }
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    const entry = this.createLogEntry('error', message, context, error);
    if (this.shouldLog('error')) {
      this.output(entry);
    }
  }

  // Get buffered logs for external service integration
  getBufferedLogs(): LogEntry[] {
    return [...this.buffer];
  }

  clearBuffer() {
    this.buffer.length = 0;
  }
}

export const logger = new Logger();

// Helper functions to replace console.log usage
export const logDebug = (message: string, context?: Record<string, any>) => 
  logger.debug(message, context);

export const logInfo = (message: string, context?: Record<string, any>) => 
  logger.info(message, context);

export const logWarn = (message: string, context?: Record<string, any>) => 
  logger.warn(message, context);

export const logError = (message: string, error?: Error, context?: Record<string, any>) => 
  logger.error(message, error, context);