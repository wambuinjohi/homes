/**
 * Performance monitoring and analytics service
 * Tracks application performance metrics and user interactions
 */

import { logger } from './logger';

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'score';
  timestamp: string;
  userId?: string;
  context?: Record<string, any>;
}

export interface UserAnalytic {
  id: string;
  event: string;
  userId?: string;
  properties?: Record<string, any>;
  timestamp: string;
  sessionId?: string;
}

class PerformanceMonitor {
  private isProduction = process.env.NODE_ENV === 'production';
  private metricsBuffer: PerformanceMetric[] = [];
  private analyticsBuffer: UserAnalytic[] = [];
  private sessionId: string;
  private maxBufferSize = 200;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupPerformanceObservers();
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Performance metrics tracking
  trackMetric(name: string, value: number, unit: PerformanceMetric['unit'], context?: Record<string, any>) {
    const metric: PerformanceMetric = {
      id: this.generateId(),
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      context
    };

    this.metricsBuffer.push(metric);
    if (this.metricsBuffer.length > this.maxBufferSize) {
      this.metricsBuffer.shift();
    }

    // Log significant performance issues
    if (this.isPerformanceIssue(metric)) {
      logger.warn(`Performance issue detected: ${name}`, { metric });
    }
  }

  private isPerformanceIssue(metric: PerformanceMetric): boolean {
    switch (metric.name) {
      case 'page_load_time':
        return metric.value > 3000; // > 3 seconds
      case 'api_response_time':
        return metric.value > 2000; // > 2 seconds
      case 'component_render_time':
        return metric.value > 100; // > 100ms
      case 'bundle_size':
        return metric.value > 5 * 1024 * 1024; // > 5MB
      default:
        return false;
    }
  }

  // User analytics tracking
  trackEvent(event: string, properties?: Record<string, any>, userId?: string) {
    const analytic: UserAnalytic = {
      id: this.generateId(),
      event,
      properties,
      userId,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    };

    this.analyticsBuffer.push(analytic);
    if (this.analyticsBuffer.length > this.maxBufferSize) {
      this.analyticsBuffer.shift();
    }

    // Log important events
    if (this.isImportantEvent(event)) {
      logger.info(`User event: ${event}`, { properties, userId });
    }
  }

  private isImportantEvent(event: string): boolean {
    const importantEvents = [
      'user_login',
      'user_signup',
      'payment_completed',
      'trial_started',
      'subscription_upgraded',
      'error_occurred'
    ];
    return importantEvents.includes(event);
  }

  // Web Vitals and Performance API integration
  private setupPerformanceObservers() {
    if (typeof window === 'undefined' || !this.isProduction) return;

    // Track navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.trackMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart, 'ms');
          this.trackMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart, 'ms');
          this.trackMetric('first_paint', navigation.responseStart - navigation.fetchStart, 'ms');
        }
      }, 0);
    });

    // Track resource timing for large resources
    if ('PerformanceObserver' in window) {
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            const resourceEntry = entry as PerformanceResourceTiming;
            if (resourceEntry.transferSize && resourceEntry.transferSize > 100000) { // > 100KB
              this.trackMetric('large_resource_load', entry.duration, 'ms', {
                resource: entry.name,
                size: resourceEntry.transferSize
              });
            }
          });
        });
        resourceObserver.observe({ entryTypes: ['resource'] });

        // Track Long Tasks (> 50ms)
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.trackMetric('long_task', entry.duration, 'ms', {
              startTime: entry.startTime
            });
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        logger.warn('Failed to setup performance observers', { error });
      }
    }
  }

  // Component performance tracking
  measureComponentRender<T>(componentName: string, renderFunction: () => T): T {
    const startTime = performance.now();
    const result = renderFunction();
    const endTime = performance.now();
    
    this.trackMetric('component_render_time', endTime - startTime, 'ms', {
      component: componentName
    });
    
    return result;
  }

  // API call performance tracking
  async measureApiCall<T>(apiName: string, apiCall: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await apiCall();
      const endTime = performance.now();
      
      this.trackMetric('api_response_time', endTime - startTime, 'ms', {
        api: apiName,
        status: 'success'
      });
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      
      this.trackMetric('api_response_time', endTime - startTime, 'ms', {
        api: apiName,
        status: 'error'
      });
      
      throw error;
    }
  }

  // Memory usage tracking
  trackMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.trackMetric('memory_used', memory.usedJSHeapSize, 'bytes');
      this.trackMetric('memory_total', memory.totalJSHeapSize, 'bytes');
      this.trackMetric('memory_limit', memory.jsHeapSizeLimit, 'bytes');
    }
  }

  // Get buffered data for external service integration
  getMetrics(): PerformanceMetric[] {
    return [...this.metricsBuffer];
  }

  getAnalytics(): UserAnalytic[] {
    return [...this.analyticsBuffer];
  }

  clearBuffers() {
    this.metricsBuffer.length = 0;
    this.analyticsBuffer.length = 0;
  }

  // Send data to external services
  async sendToAnalyticsService() {
    if (!this.isProduction) return;

    try {
      // This would integrate with services like Google Analytics, Mixpanel, Amplitude
      // For now, just log the data
      const metrics = this.getMetrics();
      const analytics = this.getAnalytics();
      
      if (metrics.length > 0 || analytics.length > 0) {
        logger.info('Sending analytics data', {
          metricsCount: metrics.length,
          analyticsCount: analytics.length
        });
        
        // Clear buffers after sending
        this.clearBuffers();
      }
    } catch (error) {
      logger.error('Failed to send analytics data', error as Error);
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Helper functions for easy use
export const trackMetric = (name: string, value: number, unit: PerformanceMetric['unit'], context?: Record<string, any>) =>
  performanceMonitor.trackMetric(name, value, unit, context);

export const trackEvent = (event: string, properties?: Record<string, any>, userId?: string) =>
  performanceMonitor.trackEvent(event, properties, userId);

export const measureApiCall = <T>(apiName: string, apiCall: () => Promise<T>) =>
  performanceMonitor.measureApiCall(apiName, apiCall);

export const measureComponentRender = <T>(componentName: string, renderFunction: () => T) =>
  performanceMonitor.measureComponentRender(componentName, renderFunction);

// Setup periodic analytics data sending in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  setInterval(() => {
    performanceMonitor.sendToAnalyticsService();
  }, 30000); // Send every 30 seconds
}