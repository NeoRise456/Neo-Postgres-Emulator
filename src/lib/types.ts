// Database schema types
export interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_table?: string;
  foreign_column?: string;
}

export interface TableSchema {
  table_name: string;
  columns: TableColumn[];
}

export interface ForeignKey {
  constraint_name: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: { name: string; dataTypeID: number }[];
  rowCount: number;
  command: string;
  duration: number;
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  success: boolean;
  rowCount?: number;
  error?: string;
}

// UI State types
export type ViewMode = 'editor' | 'diagram';
export type ResultViewMode = 'grid' | 'json';

export interface DiagramNodePosition {
  id: string;
  x: number;
  y: number;
}
