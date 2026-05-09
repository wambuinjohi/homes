
// Self-hosted telemetry utility for sending data to central monitoring
// This should be included in self-hosted deployments

interface TelemetryConfig {
  centralUrl: string; // Central Supabase project URL
  instanceId: string;
  writeKey: string;
  enabled?: boolean;
}

interface HeartbeatData {
  app_version?: string;
  environment?: string;
  online_users?: number;
  metrics?: Record<string, any>;
}

interface TelemetryEvent {
  event_type: string;
  severity?: 'info' | 'warn' | 'error' | 'critical';
  payload?: Record<string, any>;
  occurred_at?: string;
  dedupe_key?: string;
}

interface TelemetryError {
  message: string;
  stack?: string;
  url?: string;
  severity?: 'error' | 'warning' | 'critical';
  fingerprint?: string;
  user_id_hash?: string;
  context?: Record<string, any>;
}

class SelfHostedTelemetry {
  private config: TelemetryConfig;
  private heartbeatInterval?: number;
  private eventQueue: TelemetryEvent[] = [];
  private errorQueue: TelemetryError[] = [];
  private readonly BATCH_SIZE = 10;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds

  constructor(config: TelemetryConfig) {
    this.config = { enabled: true, ...config };
    
    if (this.config.enabled) {
      this.startHeartbeat();
      this.startBatchProcessor();
      this.setupErrorCapture();
    }
  }

  // Send heartbeat every 5 minutes
  private startHeartbeat() {
    const sendHeartbeat = async () => {
      try {
        const heartbeatData: HeartbeatData = {
          app_version: this.getAppVersion(),
          environment: this.getEnvironment(),
          online_users: this.getOnlineUsers(),
          metrics: await this.collectMetrics()
        };

        await this.sendHeartbeat(heartbeatData);
      } catch (error) {
        console.warn('Failed to send heartbeat:', error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat();
    
    // Set up interval (5 minutes)
    this.heartbeatInterval = window.setInterval(sendHeartbeat, 5 * 60 * 1000);
  }

  private startBatchProcessor() {
    setInterval(() => {
      this.flushEvents();
      this.flushErrors();
    }, this.FLUSH_INTERVAL);
  }

  private setupErrorCapture() {
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.recordError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        severity: 'error',
        context: {
          line: event.lineno,
          column: event.colno,
          timestamp: new Date().toISOString()
        }
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError({
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        severity: 'error',
        context: {
          reason: event.reason,
          timestamp: new Date().toISOString()
        }
      });
    });
  }

  // Public methods
  public recordEvent(event: TelemetryEvent) {
    if (!this.config.enabled) return;
    
    this.eventQueue.push({
      ...event,
      occurred_at: event.occurred_at || new Date().toISOString()
    });

    if (this.eventQueue.length >= this.BATCH_SIZE) {
      this.flushEvents();
    }
  }

  public recordError(error: TelemetryError) {
    if (!this.config.enabled) return;
    
    this.errorQueue.push(error);

    if (this.errorQueue.length >= this.BATCH_SIZE) {
      this.flushErrors();
    }
  }

  // Helper methods for collecting system info
  private getAppVersion(): string {
    return process.env.REACT_APP_VERSION || '1.0.0';
  }

  private getEnvironment(): string {
    return process.env.NODE_ENV || 'production';
  }

  private getOnlineUsers(): number {
    // This would need to be implemented based on your authentication system
    // For now, return a placeholder
    return 1;
  }

  private async collectMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};
    
    try {
      // Memory usage (if available)
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        metrics.memory = {
          used: memInfo.usedJSHeapSize,
          total: memInfo.totalJSHeapSize,
          limit: memInfo.jsHeapSizeLimit
        };
      }

      // Connection info
      if ('connection' in navigator) {
        const conn = (navigator as any).connection;
        metrics.connection = {
          type: conn.effectiveType,
          downlink: conn.downlink,
          rtt: conn.rtt
        };
      }

      // Page performance
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        metrics.performance = {
          load_time: navigation.loadEventEnd - navigation.fetchStart,
          dom_ready: navigation.domContentLoadedEventEnd - navigation.fetchStart
        };
      }

    } catch (error) {
      console.warn('Failed to collect some metrics:', error);
    }

    return metrics;
  }

  // Network methods
  private async sendHeartbeat(data: HeartbeatData) {
    try {
      const response = await fetch(`${this.config.centralUrl}/functions/v1/telemetry-heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.writeKey}`
        },
        body: JSON.stringify({
          instance_id: this.config.instanceId,
          write_key: this.config.writeKey,
          ...data
        })
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to send heartbeat:', error);
    }
  }

  private async flushEvents() {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.BATCH_SIZE);
    
    try {
      const response = await fetch(`${this.config.centralUrl}/functions/v1/telemetry-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.writeKey}`
        },
        body: JSON.stringify({
          instance_id: this.config.instanceId,
          write_key: this.config.writeKey,
          events
        })
      });

      if (!response.ok) {
        // Re-queue events on failure
        this.eventQueue.unshift(...events);
        throw new Error(`Events flush failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to flush events:', error);
    }
  }

  private async flushErrors() {
    if (this.errorQueue.length === 0) return;

    const errors = this.errorQueue.splice(0, this.BATCH_SIZE);
    
    try {
      const response = await fetch(`${this.config.centralUrl}/functions/v1/telemetry-errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.writeKey}`
        },
        body: JSON.stringify({
          instance_id: this.config.instanceId,
          write_key: this.config.writeKey,
          errors
        })
      });

      if (!response.ok) {
        // Re-queue errors on failure
        this.errorQueue.unshift(...errors);
        throw new Error(`Errors flush failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to flush errors:', error);
    }
  }

  // Cleanup
  public destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Final flush
    this.flushEvents();
    this.flushErrors();
  }
}

// Export for use in self-hosted deployments
export default SelfHostedTelemetry;

// Example usage:
/*
const telemetry = new SelfHostedTelemetry({
  centralUrl: 'https://kdpqimetajnhcqseajok.supabase.co',
  instanceId: 'uuid-from-registration',
  writeKey: 'secret-write-key',
  enabled: process.env.NODE_ENV === 'production'
});

// Record feature usage
telemetry.recordEvent({
  event_type: 'feature_usage',
  severity: 'info',
  payload: { feature: 'tenant_management', action: 'create_tenant' }
});

// Record performance metrics
telemetry.recordEvent({
  event_type: 'performance_metric',
  payload: { api_endpoint: '/api/tenants', response_time: 245 }
});
*/
