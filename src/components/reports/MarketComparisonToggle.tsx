import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building, TrendingUp, Users, MapPin } from 'lucide-react';

interface MarketComparisonToggleProps {
  comparisonMode: 'portfolio' | 'market';
  onModeChange: (mode: 'portfolio' | 'market') => void;
  sampleSize?: number;
  unitTypes?: number;
  locations?: number;
}

export const MarketComparisonToggle: React.FC<MarketComparisonToggleProps> = ({
  comparisonMode,
  onModeChange,
  sampleSize,
  unitTypes,
  locations
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant={comparisonMode === 'portfolio' ? 'default' : 'outline'}
          onClick={() => onModeChange('portfolio')}
          className="flex items-center gap-2"
        >
          <Building className="h-4 w-4" />
          My Portfolio
        </Button>
        <Button
          variant={comparisonMode === 'market' ? 'default' : 'outline'}
          onClick={() => onModeChange('market')}
          className="flex items-center gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          Market Comparison
        </Button>
      </div>

      {comparisonMode === 'market' && (sampleSize || unitTypes || locations) && (
        <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/50">
          <div className="text-sm text-muted-foreground mb-2 w-full">
            Market data insights:
          </div>
          {sampleSize && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {sampleSize} properties analyzed
            </Badge>
          )}
          {unitTypes && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Building className="h-3 w-3" />
              {unitTypes} unit types
            </Badge>
          )}
          {locations && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {locations} locations
            </Badge>
          )}
          <div className="text-xs text-muted-foreground w-full mt-1">
            * Data is anonymized and aggregated from platform users
          </div>
        </div>
      )}
    </div>
  );
};