'use client';

import { memo, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TableIcon, Code, Clock, AlertCircle, CheckCircle } from 'lucide-react';

// Hoisted static empty state JSX
const emptyState = (
  <div className="flex h-full items-center justify-center bg-[#0a0a0a] text-muted-foreground">
    <div className="text-center">
      <TableIcon className="mx-auto h-8 w-8 opacity-50" />
      <p className="mt-2 text-sm font-mono">Run a query to see results</p>
    </div>
  </div>
);

const noRowsMessage = (
  <div className="flex h-full items-center justify-center text-muted-foreground">
    <p className="text-sm font-mono">No rows returned</p>
  </div>
);

// Utility function - hoisted outside component
function formatValue(value: unknown): string {
  if (value === null) return 'NULL';
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Memoized error display component
const ErrorDisplay = memo(function ErrorDisplay({ error }: { error: string }) {
  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <div className="border-b border-[#1a1a1a] px-4 py-2">
        <span className="text-xs font-mono text-red-500">ERROR</span>
      </div>
      <div className="flex-1 p-4">
        <div className="rounded border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-red-500 shrink-0" />
            <pre className="text-sm text-red-400 font-mono whitespace-pre-wrap break-all">
              {error}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
});

// Memoized table row component for better list performance
const ResultTableRow = memo(function ResultTableRow({
  row,
  fields,
  rowIndex,
}: {
  row: Record<string, unknown>;
  fields: { name: string }[];
  rowIndex: number;
}) {
  return (
    <TableRow className="border-[#1a1a1a] hover:bg-[#1a1a1a]/50">
      {fields.map((field) => (
        <TableCell
          key={`${rowIndex}-${field.name}`}
          className="font-mono text-xs py-2 whitespace-nowrap"
        >
          {formatValue(row[field.name])}
        </TableCell>
      ))}
    </TableRow>
  );
});

// Memoized grid view component
const GridView = memo(function GridView({
  rows,
  fields,
}: {
  rows: Record<string, unknown>[];
  fields: { name: string }[];
}) {
  if (rows.length === 0) {
    return noRowsMessage;
  }

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader className="sticky top-0 bg-[#0d0d0d]">
          <TableRow className="border-[#1a1a1a] hover:bg-transparent">
            {fields.map((field) => (
              <TableHead
                key={field.name}
                className="font-mono text-xs text-cyan-400/70 whitespace-nowrap"
              >
                {field.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <ResultTableRow
              key={i}
              row={row}
              fields={fields}
              rowIndex={i}
            />
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
});

// Memoized JSON view component
const JsonView = memo(function JsonView({
  rows,
}: {
  rows: Record<string, unknown>[];
}) {
  return (
    <ScrollArea className="h-full">
      <pre className="p-4 font-mono text-xs text-foreground/90">
        {JSON.stringify(rows, null, 2)}
      </pre>
    </ScrollArea>
  );
});

// Memoized result header component
const ResultHeader = memo(function ResultHeader({
  command,
  rowCount,
  duration,
  resultViewMode,
  onViewModeChange,
}: {
  command: string;
  rowCount: number;
  duration: number;
  resultViewMode: 'grid' | 'json';
  onViewModeChange: (mode: string) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-cyan-400" />
          <span className="text-xs font-mono text-cyan-400">{command}</span>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          {rowCount} row{rowCount !== 1 ? 's' : ''}
        </Badge>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="text-xs font-mono">{duration.toFixed(2)}ms</span>
        </div>
      </div>
      <Tabs value={resultViewMode} onValueChange={onViewModeChange}>
        <TabsList className="h-7 bg-[#1a1a1a]">
          <TabsTrigger value="grid" className="h-5 px-2 text-xs font-mono">
            <TableIcon className="mr-1 h-3 w-3" />
            Grid
          </TabsTrigger>
          <TabsTrigger value="json" className="h-5 px-2 text-xs font-mono">
            <Code className="mr-1 h-3 w-3" />
            JSON
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
});

export function QueryResults() {
  // Use individual selectors for better re-render optimization
  const queryResult = useAppStore((state) => state.queryResult);
  const queryError = useAppStore((state) => state.queryError);
  const resultViewMode = useAppStore((state) => state.resultViewMode);
  const setResultViewMode = useAppStore((state) => state.setResultViewMode);

  const handleViewModeChange = useCallback(
    (value: string) => {
      setResultViewMode(value as 'grid' | 'json');
    },
    [setResultViewMode]
  );

  // Error state - early return pattern
  if (queryError) {
    return <ErrorDisplay error={queryError} />;
  }

  // Empty state - early return pattern
  if (!queryResult) {
    return emptyState;
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <ResultHeader
        command={queryResult.command}
        rowCount={queryResult.rowCount}
        duration={queryResult.duration}
        resultViewMode={resultViewMode}
        onViewModeChange={handleViewModeChange}
      />

      <div className="flex-1 overflow-hidden">
        {resultViewMode === 'grid' ? (
          <GridView rows={queryResult.rows} fields={queryResult.fields} />
        ) : (
          <JsonView rows={queryResult.rows} />
        )}
      </div>
    </div>
  );
}
