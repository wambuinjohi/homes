/**
 * Console replacer utility
 * Replaces console.log statements in production with proper logging
 */

import { logger } from './logger';

export interface ConsoleReplacerConfig {
  replaceInProduction: boolean;
  keepErrorsAndWarnings: boolean;
  bufferSize: number;
}

const defaultConfig: ConsoleReplacerConfig = {
  replaceInProduction: true,
  keepErrorsAndWarnings: true,
  bufferSize: 100,
};

class ConsoleReplacer {
  private originalConsole: Console;
  private buffer: Array<{ level: string; args: any[]; timestamp: string }> = [];
  private config: ConsoleReplacerConfig;

  constructor(config: ConsoleReplacerConfig = defaultConfig) {
    this.config = config;
    this.originalConsole = { ...console };
  }

  initialize() {
    if (!this.config.replaceInProduction || process.env.NODE_ENV !== 'production') {
      return; // Don't replace in development
    }

    // Replace console methods
    console.log = this.createReplacementMethod('log');
    console.info = this.createReplacementMethod('info');
    console.debug = this.createReplacementMethod('debug');

    if (!this.config.keepErrorsAndWarnings) {
      console.warn = this.createReplacementMethod('warn');
      console.error = this.createReplacementMethod('error');
    }

    logger.info('Console methods replaced for production');
  }

  private createReplacementMethod(level: string) {
    return (...args: any[]) => {
      // Buffer the call for debugging purposes
      this.buffer.push({
        level,
        args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)),
        timestamp: new Date().toISOString(),
      });

      // Keep buffer size manageable
      if (this.buffer.length > this.config.bufferSize) {
        this.buffer.shift();
      }

      // Convert to proper logging
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      switch (level) {
        case 'error':
          logger.error(message);
          break;
        case 'warn':
          logger.warn(message);
          break;
        case 'info':
          logger.info(message);
          break;
        case 'debug':
        case 'log':
        default:
          logger.debug(message);
          break;
      }
    };
  }

  // Restore original console methods
  restore() {
    Object.assign(console, this.originalConsole);
    logger.info('Console methods restored');
  }

  // Get buffered console calls for debugging
  getBuffer() {
    return [...this.buffer];
  }

  clearBuffer() {
    this.buffer.length = 0;
  }

  // Emergency restore (useful for debugging production issues)
  emergencyRestore() {
    this.restore();
    this.originalConsole.warn('Console methods restored due to emergency override');
  }
}

export const consoleReplacer = new ConsoleReplacer();

// Auto-initialize in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  consoleReplacer.initialize();
}

// Add emergency restore to window for debugging
if (typeof window !== 'undefined') {
  (window as any).__restoreConsole = () => consoleReplacer.emergencyRestore();
  (window as any).__getConsoleBuffer = () => consoleReplacer.getBuffer();
}
