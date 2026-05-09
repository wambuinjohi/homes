import { Chart as ChartJS, ChartConfiguration } from 'chart.js';

export interface ChartDataConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  data: any;
  options?: any;
  title?: string;
}

export class ChartToPDFRenderer {
  static async renderChartToBase64(chartConfig: ChartDataConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Create ultra-compact canvas for maximum space efficiency
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 220;
        canvas.style.backgroundColor = 'white';
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Fill background with white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Configure chart
        const config: ChartConfiguration = {
          type: chartConfig.type,
          data: chartConfig.data,
          options: {
            ...chartConfig.options,
            responsive: false,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              ...chartConfig.options?.plugins,
              legend: {
                display: true,
                position: 'top' as const,
                labels: {
                  usePointStyle: true,
                  padding: 6,
                  font: { size: 8 }
                }
              },
              title: {
                display: !!chartConfig.title,
                text: chartConfig.title,
                font: { size: 9, weight: 'bold' },
                padding: { bottom: 5 }
              },
            },
          },
        };

        // Create and render chart
        const chart = new ChartJS(ctx, config);

        // Wait for chart to render, then convert to base64
        setTimeout(() => {
          try {
            const base64Image = canvas.toDataURL('image/png');
            chart.destroy();
            resolve(base64Image);
          } catch (error) {
            chart.destroy();
            reject(error);
          }
        }, 500);

      } catch (error) {
        reject(error);
      }
    });
  }

  static async getImageDimensions(base64Image: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      img.src = base64Image;
    });
  }
}