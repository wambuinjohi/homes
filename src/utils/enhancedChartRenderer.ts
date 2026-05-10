import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

import { BrandingData } from './unifiedPDFRenderer';
import { formatAmount } from './currency';

export interface ChartConfig {
  id?: string;
  title: string;
  type: 'bar' | 'line' | 'doughnut' | 'pie';
  data: any;
  options?: any;
  branding?: BrandingData;
  dimensions?: 'ultra-compact' | 'compact' | 'standard' | 'large';
}

// Export alias for backward compatibility
export interface EnhancedChartConfig extends ChartConfig {}

export class EnhancedChartRenderer {
  private static getChartDimensions(size: string = 'standard'): { width: number; height: number } {
    switch (size) {
      case 'ultra-compact':
        return { width: 400, height: 200 };
      case 'compact':
        return { width: 500, height: 250 };
      case 'large':
        return { width: 800, height: 400 };
      case 'standard':
      default:
        return { width: 600, height: 300 };
    }
  }

  private static getZiraColors() {
    return {
      primary: '#2563eb',     // Blue
      success: '#22c55e',     // Green
      warning: '#f59e0b',     // Orange
      danger: '#ef4444',      // Red
      navy: '#1b365d',        // Navy Blue
      orange: '#f36f21',      // Orange
      neutral: '#6b7280',     // Gray
      light: '#f8fafc',       // Light gray
    };
  }

  private static applyBrandingToChart(chartConfig: ChartConfig): ChartConfig {
    const colors = this.getZiraColors();
    const config = { ...chartConfig };

    // Apply Zira branding colors to datasets
    if (config.data?.datasets) {
      config.data.datasets = config.data.datasets.map((dataset: any, index: number) => {
        const colorKeys = Object.keys(colors);
        const colorIndex = index % colorKeys.length;
        const color = colors[colorKeys[colorIndex] as keyof typeof colors];

        return {
          ...dataset,
          backgroundColor: dataset.backgroundColor || 
            (config.type === 'doughnut' || config.type === 'pie' 
              ? [colors.primary, colors.success, colors.warning, colors.danger, colors.navy, colors.orange]
              : color),
          borderColor: dataset.borderColor || color,
          borderWidth: dataset.borderWidth || 2,
        };
      });
    }

    // Apply professional options
    config.options = {
      ...config.options,
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        ...config.options?.plugins,
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 11,
              family: 'Arial, sans-serif'
            }
          },
          ...config.options?.plugins?.legend,
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          cornerRadius: 4,
          displayColors: true,
          callbacks: {
            label: (context: any) => {
              const raw = (context.parsed?.y ?? context.parsed ?? 0) as number;
              const dsLabel = (context.dataset?.label || '').toString().toLowerCase();
              const isCurrency = /amount|revenue|expense|income|cost|balance|rent/.test(dsLabel);
              const value = isCurrency ? formatAmount(Number(raw)) : (typeof raw === 'number' ? raw.toLocaleString() : String(raw));
              return `${context.dataset?.label ? context.dataset.label + ': ' : ''}${value}`;
            },
            ...(config.options?.plugins?.tooltip?.callbacks || {})
          },
          ...config.options?.plugins?.tooltip,
        },
        title: {
          display: true,
          text: config.title,
          font: {
            size: 14,
            weight: 'bold',
            family: 'Arial, sans-serif'
          },
          color: colors.navy,
          padding: {
            top: 10,
            bottom: 20
          },
          ...config.options?.plugins?.title,
        }
      },
      scales: config.type !== 'doughnut' && config.type !== 'pie' ? {
        ...config.options?.scales,
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 10
            },
            color: colors.neutral
          },
          ...config.options?.scales?.x,
        },
        y: {
          grid: {
            color: '#e5e7eb',
            lineWidth: 1
          },
          ticks: {
            font: {
              size: 10
            },
            color: colors.neutral,
            callback: (value: any) => {
              const n = Number(value);
              return isNaN(n) ? String(value) : (n >= 1000 ? formatAmount(n) : n.toString());
            },
            ...config.options?.scales?.y?.ticks,
          },
          ...config.options?.scales?.y,
        }
      } : undefined
    };

    return config;
  }

  static async renderChartForPDF(chartConfig: ChartConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Apply branding to chart
        const brandedConfig = this.applyBrandingToChart(chartConfig);
        
        // Get dimensions
        const dimensions = this.getChartDimensions(chartConfig.dimensions);
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        
        // Ensure canvas has a proper context
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Clear canvas with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, dimensions.width, dimensions.height);

        // Validate chart data
        if (!brandedConfig.data || !brandedConfig.data.datasets || brandedConfig.data.datasets.length === 0) {
          console.warn('Chart has no valid datasets:', brandedConfig);
          // Generate placeholder image
          ctx.fillStyle = '#f3f4f6';
          ctx.fillRect(10, 10, dimensions.width - 20, dimensions.height - 20);
          ctx.fillStyle = '#6b7280';
          ctx.font = '16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('No Data Available', dimensions.width / 2, dimensions.height / 2);
          
          resolve(canvas.toDataURL('image/png'));
          return;
        }

        // Create Chart.js instance
        const chart = new ChartJS(ctx, {
          type: brandedConfig.type as any,
          data: brandedConfig.data,
          options: {
            ...brandedConfig.options,
            animation: false, // Disable animations for PDF
            responsive: false,
            maintainAspectRatio: false,
          }
        });

        // Wait for chart to render then capture
        setTimeout(() => {
          try {
            const imageData = canvas.toDataURL('image/png');
            chart.destroy(); // Clean up
            resolve(imageData);
          } catch (error) {
            console.error('Error capturing chart image:', error);
            chart.destroy();
            reject(error);
          }
        }, 100);

      } catch (error) {
        console.error('Error rendering chart:', error);
        reject(error);
      }
    });
  }

  static createFallbackImage(title: string, width: number = 600, height: number = 300): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Icon
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('📊', width / 2, height / 2 - 20);

    // Text
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Arial';
    ctx.fillText('Chart Unavailable', width / 2, height / 2 + 10);
    
    if (title) {
      ctx.font = '12px Arial';
      ctx.fillText(title, width / 2, height / 2 + 30);
    }

    return canvas.toDataURL('image/png');
  }
}