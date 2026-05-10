// Production console log cleaner - removes debug logs in production
const isProduction = process.env.NODE_ENV === 'production';

// Store original console methods
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Override console methods in production and filter noisy warnings in development
if (isProduction) {
  // Disable all console output in production to mute errors and logs
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};

  // Prevent uncaught errors from bubbling to the console or showing overlays
  if (typeof window !== 'undefined') {
    // Swallow window.onerror
    window.addEventListener('error', (ev) => {
      try { ev.preventDefault(); } catch (e) { /* noop */ }
    }, { passive: true });

    // Swallow unhandled promise rejections
    window.addEventListener('unhandledrejection', (ev) => {
      try { ev.preventDefault(); } catch (e) { /* noop */ }
    }, { passive: true });
  }
} else {
  // In development, filter known noisy library warnings (e.g., Recharts defaultProps deprecation)
  console.warn = (...args: any[]) => {
    try {
      // Build a joined message safely
      const parts = args.map(a => {
        try {
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
        } catch (e) {
          return String(a);
        }
      });
      const message = parts.join(' ');

      // Detect Recharts defaultProps deprecation in both formatted and unformatted warning forms
      const isDefaultPropsDeprecation = message.includes('Support for defaultProps will be removed from function components')
        || (typeof args[0] === 'string' && args[0].includes('Support for defaultProps'));

      const mentionsAxis = parts.some(p => /\b(XAxis|YAxis)\b/.test(p));

      if (isDefaultPropsDeprecation && mentionsAxis) {
        // ignore this specific Recharts warning
        return;
      }
    } catch (e) {
      // If serialization fails, fall through to original warn
    }
    originalWarn(...args);
  };

  // Additionally, prevent this specific Recharts warning from surfacing as a global error overlay
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event: ErrorEvent) => {
      try {
        const msg = event?.message || (event.error && event.error.message) || '';
        const isRechartsDefaultProps = typeof msg === 'string' && msg.includes('Support for defaultProps') && /\b(XAxis|YAxis)\b/.test(msg);
        const isResizeObserverNoise = typeof msg === 'string' && (
          msg.includes('ResizeObserver loop completed with undelivered notifications') ||
          msg.includes('ResizeObserver loop limit exceeded')
        );
        if (isRechartsDefaultProps || isResizeObserverNoise) {
          try { event.preventDefault(); } catch (_e) { /* noop */ }
          return;
        }
      } catch (e) {
        // nothing
      }
      // otherwise let it proceed (do not call originalError here because global handler will run)
    }, { passive: true });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      try {
        const reason = event?.reason;
        const msg = typeof reason === 'string' ? reason : (reason && reason.message) ? reason.message : '';
        const isRechartsDefaultProps = typeof msg === 'string' && msg.includes('Support for defaultProps') && /\b(XAxis|YAxis)\b/.test(msg);
        const isResizeObserverNoise = typeof msg === 'string' && (
          msg.includes('ResizeObserver loop completed with undelivered notifications') ||
          msg.includes('ResizeObserver loop limit exceeded')
        );
        if (isRechartsDefaultProps || isResizeObserverNoise) {
          try { event.preventDefault(); } catch (_e) { /* noop */ }
          return;
        }
      } catch (e) {
        // nothing
      }
      // otherwise leave it
    }, { passive: true });
  }
}

// Performance monitoring for development
export const performanceLog = (operation: string, duration: number) => {
  if (!isProduction && duration > 1000) {
    originalWarn(`🐌 Slow operation detected: ${operation} took ${duration}ms`);
  }
};

// Utility for timing operations
export const measurePerformance = async <T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    performanceLog(operation, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    // In production errors are muted; still call originalError for potential external logging hooks
    try { originalError && originalError(`❌ ${operation} failed after ${duration}ms:`, error); } catch (e) { /* noop */ }
    throw error;
  }
};
