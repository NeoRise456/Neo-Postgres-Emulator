'use client';

import { useState, useRef, useCallback } from 'react';
import { usePGlite } from '@/lib/pglite-provider';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Download,
  Upload,
  HardDrive,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import type { TableSchema } from '@/lib/types';

// Types
interface ImportStatus {
  type: 'success' | 'error';
  message: string;
}

// Helper to convert PostgreSQL data types for export
function convertDataType(dataType: string, columnDefault: string | null): string {
  // If the column has a nextval default, it's a SERIAL type
  if (columnDefault && columnDefault.includes('nextval(')) {
    if (dataType === 'integer') return 'SERIAL';
    if (dataType === 'bigint') return 'BIGSERIAL';
    if (dataType === 'smallint') return 'SMALLSERIAL';
  }
  
  // Map common types
  switch (dataType) {
    case 'character varying':
      return 'VARCHAR(255)';
    case 'timestamp without time zone':
      return 'TIMESTAMP';
    case 'timestamp with time zone':
      return 'TIMESTAMPTZ';
    default:
      return dataType.toUpperCase();
  }
}

// Helper to check if default should be included (skip nextval for SERIAL)
function shouldIncludeDefault(columnDefault: string | null): boolean {
  if (!columnDefault) return false;
  // Skip nextval defaults as they're handled by SERIAL type
  if (columnDefault.includes('nextval(')) return false;
  return true;
}

// Helper to format default value
function formatDefault(columnDefault: string): string {
  // Clean up the default value
  let def = columnDefault;
  // Remove type casts like ::character varying
  def = def.replace(/::[a-z_ ]+/gi, '');
  return def;
}

// Sort tables by dependencies (tables with no FK first)
function sortTablesByDependencies(tables: TableSchema[]): TableSchema[] {
  const sorted: TableSchema[] = [];
  const remaining = [...tables];
  const added = new Set<string>();
  
  // Keep iterating until all tables are sorted
  let maxIterations = tables.length * 2;
  while (remaining.length > 0 && maxIterations > 0) {
    maxIterations--;
    
    for (let i = remaining.length - 1; i >= 0; i--) {
      const table = remaining[i];
      
      // Get all foreign key references for this table
      const fkReferences = table.columns
        .filter(col => col.is_foreign_key && col.foreign_table)
        .map(col => col.foreign_table!);
      
      // Check if all referenced tables are already added (or self-referencing)
      const allDepsResolved = fkReferences.every(
        ref => added.has(ref) || ref === table.table_name
      );
      
      if (allDepsResolved || fkReferences.length === 0) {
        sorted.push(table);
        added.add(table.table_name);
        remaining.splice(i, 1);
      }
    }
  }
  
  // Add any remaining tables (circular dependencies)
  sorted.push(...remaining);
  
  return sorted;
}

export function DatabaseTools() {
  const { rawQuery, refreshSchema, executeQuery } = usePGlite();
  const tables = useAppStore((state) => state.tables);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const currentTables = useAppStore.getState().tables;
      
      if (currentTables.length === 0) {
        console.warn('No tables to export');
        setIsExporting(false);
        return;
      }

      // Sort tables by dependencies
      const sortedTables = sortTablesByDependencies(currentTables);

      const lines: string[] = [];
      lines.push("-- Neo's Postgres Emulator - Database Export");
      lines.push(`-- Generated: ${new Date().toISOString()}`);
      lines.push('');

      // Drop tables in reverse order (dependents first)
      lines.push('-- Drop existing tables');
      for (const table of [...sortedTables].reverse()) {
        lines.push(`DROP TABLE IF EXISTS "${table.table_name}" CASCADE;`);
      }
      lines.push('');

      // Create tables in dependency order
      lines.push('-- Create tables');
      for (const table of sortedTables) {
        try {
          const columnsResult = await rawQuery<{
            column_name: string;
            data_type: string;
            is_nullable: string;
            column_default: string | null;
          }>(`
            SELECT 
              column_name,
              data_type,
              is_nullable,
              column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = '${table.table_name}'
            ORDER BY ordinal_position
          `);

          if (columnsResult.rows.length > 0) {
            lines.push(`-- Table: ${table.table_name}`);
            
            const columnDefs: string[] = [];
            
            // Build column definitions
            for (const col of columnsResult.rows) {
              const dataType = convertDataType(col.data_type, col.column_default);
              let def = `  "${col.column_name}" ${dataType}`;
              
              // Add NOT NULL (but not for SERIAL types which are implicitly NOT NULL)
              if (col.is_nullable === 'NO' && !dataType.includes('SERIAL')) {
                def += ' NOT NULL';
              }
              
              // Add DEFAULT if applicable
              if (shouldIncludeDefault(col.column_default) && col.column_default) {
                def += ` DEFAULT ${formatDefault(col.column_default)}`;
              }
              
              columnDefs.push(def);
            }
            
            // Add primary key constraint inline
            const pkColumns = table.columns
              .filter((c) => c.is_primary_key)
              .map((c) => `"${c.column_name}"`);
            if (pkColumns.length > 0) {
              columnDefs.push(`  PRIMARY KEY (${pkColumns.join(', ')})`);
            }
            
            lines.push(`CREATE TABLE "${table.table_name}" (`);
            lines.push(columnDefs.join(',\n'));
            lines.push(');');
            lines.push('');
          }
        } catch (err) {
          console.warn(`Failed to get DDL for ${table.table_name}:`, err);
        }
      }

      // Add foreign key constraints after all tables are created
      lines.push('-- Foreign Key Constraints');
      for (const table of sortedTables) {
        for (const col of table.columns) {
          if (col.is_foreign_key && col.foreign_table && col.foreign_column) {
            lines.push(
              `ALTER TABLE "${table.table_name}" ADD CONSTRAINT "fk_${table.table_name}_${col.column_name}" FOREIGN KEY ("${col.column_name}") REFERENCES "${col.foreign_table}"("${col.foreign_column}");`
            );
          }
        }
      }
      lines.push('');

      // Export data in dependency order
      lines.push('-- Data');
      for (const table of sortedTables) {
        try {
          const dataResult = await rawQuery<Record<string, unknown>>(
            `SELECT * FROM "${table.table_name}"`
          );

          if (dataResult.rows.length > 0) {
            lines.push(`-- Data for ${table.table_name}`);

            for (const row of dataResult.rows) {
              const columns = Object.keys(row).map(c => `"${c}"`);
              const values = Object.values(row).map((val) => {
                if (val === null) return 'NULL';
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                if (val instanceof Date) return `'${val.toISOString()}'`;
                return String(val);
              });

              lines.push(
                `INSERT INTO "${table.table_name}" (${columns.join(', ')}) VALUES (${values.join(', ')});`
              );
            }
            lines.push('');
          }
        } catch (err) {
          console.warn(`Failed to export data for ${table.table_name}:`, err);
        }
      }

      // Reset sequences after data import
      lines.push('-- Reset sequences');
      for (const table of sortedTables) {
        const serialColumns = table.columns.filter(c => c.is_primary_key);
        for (const col of serialColumns) {
          // Only reset sequence for likely serial columns
          lines.push(
            `SELECT setval(pg_get_serial_sequence('"${table.table_name}"', '${col.column_name}'), COALESCE((SELECT MAX("${col.column_name}") FROM "${table.table_name}"), 1), true);`
          );
        }
      }
      lines.push('');

      const sql = lines.join('\n');

      // Create and download file
      const blob = new Blob([sql], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database-export-${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [rawQuery]);

  const handleImport = useCallback(async (file: File) => {
    setIsImporting(true);
    setImportStatus(null);

    try {
      const sql = await file.text();
      
      console.log('Importing SQL file, length:', sql.length);

      // Remove all comment lines first
      const sqlWithoutComments = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');

      // Split by semicolons, handling strings properly
      const statements: string[] = [];
      let currentStatement = '';
      let inString = false;
      let stringChar = '';
      
      for (let i = 0; i < sqlWithoutComments.length; i++) {
        const char = sqlWithoutComments[i];
        const prevChar = i > 0 ? sqlWithoutComments[i - 1] : '';
        
        // Track string state (handle escaped quotes)
        if ((char === "'" || char === '"') && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            // Check for escaped quote ('')
            const nextChar = i < sqlWithoutComments.length - 1 ? sqlWithoutComments[i + 1] : '';
            if (nextChar === stringChar) {
              // This is an escaped quote, skip the next char
              currentStatement += char;
              currentStatement += nextChar;
              i++;
              continue;
            }
            inString = false;
          }
        }
        
        // Split on semicolon only if not in string
        if (char === ';' && !inString) {
          const stmt = currentStatement.trim();
          if (stmt) {
            statements.push(stmt);
          }
          currentStatement = '';
        } else {
          currentStatement += char;
        }
      }
      
      // Add any remaining statement
      const finalStmt = currentStatement.trim();
      if (finalStmt) {
        statements.push(finalStmt);
      }

      console.log('Found statements:', statements.length);

      let successCount = 0;
      let errorCount = 0;

      for (const statement of statements) {
        // Skip empty statements
        if (!statement.trim()) continue;
        
        try {
          await executeQuery(statement + ';');
          successCount++;
        } catch (err) {
          errorCount++;
          console.warn('Statement failed:', statement.substring(0, 100), err);
        }
      }

      await refreshSchema();

      if (errorCount === 0) {
        setImportStatus({
          type: 'success',
          message: `Successfully executed ${successCount} statements`,
        });
      } else {
        setImportStatus({
          type: 'error',
          message: `Executed ${successCount} statements, ${errorCount} failed`,
        });
      }
    } catch (err) {
      setImportStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Import failed',
      });
    } finally {
      setIsImporting(false);
    }
  }, [executeQuery, refreshSchema]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImport(file);
    }
    // Reset input
    e.target.value = '';
  }, [handleImport]);

  const handleClearDatabase = useCallback(async () => {
    setIsClearing(true);
    try {
      // Get fresh tables from store to avoid stale closure
      const currentTables = useAppStore.getState().tables;
      
      // Drop all tables using CASCADE to handle dependencies
      for (const table of [...currentTables].reverse()) {
        try {
          await rawQuery(`DROP TABLE IF EXISTS "${table.table_name}" CASCADE`);
        } catch (err) {
          console.warn(`Failed to drop ${table.table_name}:`, err);
        }
      }
      
      await refreshSchema();
      setShowClearDialog(false);
    } catch (err) {
      console.error('Failed to clear database:', err);
    } finally {
      setIsClearing(false);
    }
  }, [rawQuery, refreshSchema]);

  const openImportDialog = useCallback(() => {
    setShowImportDialog(true);
  }, []);

  const openClearDialog = useCallback(() => {
    setShowClearDialog(true);
  }, []);

  const closeClearDialog = useCallback(() => {
    setShowClearDialog(false);
  }, []);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const tablesLength = tables.length;

  return (
    <>
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={isExporting || tablesLength === 0}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">Export database as SQL</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={openImportDialog}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10"
              >
                <Upload className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">Import SQL file</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={openClearDialog}
                disabled={tablesLength === 0}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">Clear all tables</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".sql,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-[#0a0a0a] border-[#1a1a1a] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-cyan-400">
              <HardDrive className="h-5 w-5" />
              Import SQL File
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Import a SQL file to execute statements in your database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                <div className="text-sm">
                  <p className="text-yellow-500 font-medium">Warning</p>
                  <p className="text-muted-foreground mt-1">
                    Importing SQL will execute all statements in the file. This
                    may modify or delete existing data.
                  </p>
                </div>
              </div>
            </div>

            {importStatus ? (
              <div
                className={`p-3 rounded-lg border ${
                  importStatus.type === 'success'
                    ? 'border-cyan-500/30 bg-cyan-500/5'
                    : 'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  {importStatus.type === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-cyan-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={`text-sm font-mono ${
                      importStatus.type === 'success'
                        ? 'text-cyan-400'
                        : 'text-red-400'
                    }`}
                  >
                    {importStatus.message}
                  </span>
                </div>
              </div>
            ) : null}

            <Button
              onClick={triggerFileInput}
              disabled={isImporting}
              className="w-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Select SQL File
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center font-mono">
              Accepts .sql or .txt files
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="bg-[#0a0a0a] border-[#1a1a1a] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-red-400">
              <Trash2 className="h-5 w-5" />
              Clear Database
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will permanently delete all tables and data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                <div className="text-sm">
                  <p className="text-red-500 font-medium">Danger Zone</p>
                  <p className="text-muted-foreground mt-1">
                    This action cannot be undone. All {tablesLength} table(s) and their data will be permanently deleted.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={closeClearDialog}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleClearDatabase}
                disabled={isClearing}
                className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
