/**
 * Production configuration and setup
 * Handles production-specific initialization and settings
 */

import { logger } from './logger';
import { errorReporter } from './errorReporting';
import { performanceMonitor, trackEvent } from './performanceMonitor';

export interface ProductionConfig {
  // Analytics configuration
  analytics: {
    enabled: boolean;
    trackingId?: string;
    sessionTimeout: number;
  };
  
  // Error reporting configuration
  errorReporting: {
    enabled: boolean;
    sentryDsn?: string;
    environment: string;
  };
  
  // Performance monitoring
  performance: {
    enabled: boolean;
    sampleRate: number;
    trackLongTasks: boolean;
  };
  
  // Feature flags
  features: {
    enableRealtimeUpdates: boolean;
    enableAdvancedAnalytics: boolean;
    enableBetaFeatures: boolean;
  };
}

const defaultConfig: ProductionConfig = {
  analytics: {
    enabled: process.env.NODE_ENV === 'production',
    sessionTimeout: 30, // minutes
  },
  errorReporting: {
    enabled: process.env.NODE_ENV === 'production',
    environment: process.env.NODE_ENV || 'development',
  },
  performance: {
    enabled: process.env.NODE_ENV === 'production',
    sampleRate: 0.1, // 10% of users
    trackLongTasks: true,
  },
  features: {
    enableRealtimeUpdates: true,
    enableAdvancedAnalytics: process.env.NODE_ENV === 'production',
    enableBetaFeatures: process.env.NODE_ENV === 'development',
  },
};

class ProductionManager {
  private config: ProductionConfig;
  private initialized = false;

  constructor(config: ProductionConfig = defaultConfig) {
    this.config = config;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      logger.info('Initializing production services', { config: this.config });

      // Initialize error reporting
      if (this.config.errorReporting.enabled) {
        this.setupErrorReporting();
      }

      // Initialize analytics
      if (this.config.analytics.enabled) {
        this.setupAnalytics();
      }

      // Initialize performance monitoring
      if (this.config.performance.enabled) {
        this.setupPerformanceMonitoring();
      }

      // Track app initialization
      trackEvent('app_initialized', {
        environment: this.config.errorReporting.environment,
        timestamp: new Date().toISOString(),
      });

      this.initialized = true;
      logger.info('Production services initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize production services', error as Error);
    }
  }

  private setupErrorReporting() {
    // Error reporting is already initialized via global handlers
    // Additional configuration can be added here
    
    logger.info('Error reporting enabled', {
      environment: this.config.errorReporting.environment,
    });
  }

  private setupAnalytics() {
    // Track user sessions
    if (typeof window !== 'undefined') {
      // Track page views
      trackEvent('page_view', {
        url: window.location.pathname,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      });

      // Track session start
      trackEvent('session_start', {
        timestamp: new Date().toISOString(),
      });

      // Track session end on page unload
      window.addEventListener('beforeunload', () => {
        trackEvent('session_end', {
          timestamp: new Date().toISOString(),
        });
      });

      // Track page visibility changes
      document.addEventListener('visibilitychange', () => {
        trackEvent('page_visibility_change', {
          hidden: document.hidden,
          timestamp: new Date().toISOString(),
        });
      });
    }

    logger.info('Analytics enabled', {
      trackingId: this.config.analytics.trackingId,
      sessionTimeout: this.config.analytics.sessionTimeout,
    });
  }

  private setupPerformanceMonitoring() {
    // Performance monitoring is already initialized
    // Additional configuration can be added here

    // Set up memory usage tracking interval
    if (typeof window !== 'undefined' && this.config.performance.enabled) {
      setInterval(() => {
        performanceMonitor.trackMemoryUsage();
      }, 60000); // Every minute
    }

    logger.info('Performance monitoring enabled', {
      sampleRate: this.config.performance.sampleRate,
      trackLongTasks: this.config.performance.trackLongTasks,
    });
  }

  // Update configuration
  updateConfig(newConfig: Partial<ProductionConfig>) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Production configuration updated', { config: this.config });
  }

  // Get current configuration
  getConfig(): ProductionConfig {
    return { ...this.config };
  }

  // Feature flag helpers
  isFeatureEnabled(feature: keyof ProductionConfig['features']): boolean {
    return this.config.features[feature];
  }

  // Health check for production services
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'down'; services: Record<string, boolean> }> {
    const services = {
      errorReporting: this.config.errorReporting.enabled,
      analytics: this.config.analytics.enabled,
      performance: this.config.performance.enabled,
    };

    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.keys(services).length;

    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (healthyServices === 0) {
      status = 'down';
    } else if (healthyServices < totalServices) {
      status = 'degraded';
    }

    return { status, services };
  }
}

export const productionManager = new ProductionManager();

// Initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    productionManager.initialize();
  });
}

// Export helper functions
export const isFeatureEnabled = (feature: keyof ProductionConfig['features']) =>
  productionManager.isFeatureEnabled(feature);

export const getProductionConfig = () => productionManager.getConfig();

export const updateProductionConfig = (config: Partial<ProductionConfig>) =>
  productionManager.updateConfig(config);