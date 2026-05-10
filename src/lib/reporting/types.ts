export type Role = 'admin' | 'landlord' | 'tenant';

export type PeriodPreset = 
  | 'current_period'
  | 'last_12_months' 
  | 'ytd'
  | 'last_6_months'
  | 'next_90_days'
  | 'as_of_today';

export interface KPI {
  key: string;
  label: string;
  format: 'currency' | 'number' | 'percent' | 'duration' | 'date';
  decimals?: number;
}

export interface Chart {
  id: string;
  type: 'line' | 'bar' | 'area' | 'pie' | 'donut';
  xKey?: string;
  yKeys?: string[];
  stacked?: boolean;
  title?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'number' | 'percent' | 'date' | 'duration';
  decimals?: number;
}

export interface Table {
  columns: TableColumn[];
}

export interface ReportConfig {
  id: string;
  title: string;
  description: string;
  defaultPeriod: PeriodPreset;
  roles: Role[];
  kpis: KPI[];
  charts: Chart[];
  table?: Table;
  queryId: string;
}

export interface ReportData {
  kpis: Record<string, number>;
  charts: Record<string, any[]>;
  table?: any[];
  comparisonMode?: 'portfolio' | 'market';
}

export interface ReportFilters {
  periodPreset?: PeriodPreset;
  startDate?: string;
  endDate?: string;
  propertyId?: string;
  tableOnly?: boolean;
  comparisonMode?: 'portfolio' | 'market';
}