// Cached assets for improved PDF generation performance
interface CachedAsset {
  data: string;
  timestamp: number;
}

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const assetCache = new Map<string, CachedAsset>();

export class CachedAssets {
  static async getLogoAsBase64(logoUrl: string): Promise<string | null> {
    if (!logoUrl) {
      console.warn('CachedAssets: No logo URL provided');
      return null;
    }
    
    console.log('CachedAssets: Processing logo URL:', logoUrl);
    
    // If it's already a data URL, return it directly
    if (logoUrl.startsWith('data:')) {
      console.log('CachedAssets: Logo is already a data URL, using directly');
      return logoUrl;
    }
    
    // Check cache first
    const cached = assetCache.get(logoUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('CachedAssets: Using cached logo data');
      return cached.data;
    }
    
    try {
      console.log('CachedAssets: Fetching logo from URL:', logoUrl);
      const response = await fetch(logoUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const blob = await response.blob();
      console.log('CachedAssets: Successfully fetched logo blob, size:', blob.size);
      
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          console.log('CachedAssets: Successfully converted logo to base64, length:', result.length);
          // Cache the base64 data
          assetCache.set(logoUrl, {
            data: result,
            timestamp: Date.now()
          });
          resolve(result);
        };
        reader.onerror = (error) => {
          console.error('CachedAssets: Failed to read logo as data URL:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('CachedAssets: Failed to cache logo as base64:', error);
      return null;
    }
  }
  
  static clearCache(): void {
    assetCache.clear();
  }
  
  static getCacheSize(): number {
    return assetCache.size;
  }
}