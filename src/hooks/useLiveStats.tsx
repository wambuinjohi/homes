import { useState, useEffect } from "react";
import { useRealtime } from "./useRealtime";

interface LiveStatsConfig {
  refreshInterval?: number;
  enableRealtime?: boolean;
}

export function useLiveStats<T>(
  fetchFunction: () => Promise<T>,
  config: LiveStatsConfig = {}
) {
  const { refreshInterval = 30000, enableRealtime = true } = config;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      const result = await fetchFunction();
      setData(result);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching live stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh timer
  useEffect(() => {
    fetchData();
    
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Real-time updates for specific tables
  useRealtime({
    table: 'landlord_subscriptions',
    onUpdate: fetchData
  });

  useRealtime({
    table: 'payment_transactions', 
    onUpdate: fetchData
  });

  return {
    data,
    loading,
    lastUpdated,
    refetch: fetchData
  };
}