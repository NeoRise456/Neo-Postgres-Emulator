'use client';

import { useState, useCallback, memo } from 'react';
import { useAppStore } from '@/lib/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TableIcon,
  Key,
  Link,
  ChevronDown,
  ChevronRight,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TableColumn } from '@/lib/types';

// Hoisted static empty states
const loadingState = (
  <div className="flex h-full items-center justify-center bg-[#0a0a0a]">
    <div className="text-center">
      <Database className="mx-auto h-6 w-6 animate-pulse text-cyan-500/50" />
      <p className="mt-2 text-xs font-mono text-muted-foreground">
        Loading schema...
      </p>
    </div>
  </div>
);

const emptyState = (
  <div className="flex h-full items-center justify-center bg-[#0a0a0a] text-muted-foreground">
    <div className="text-center">
      <TableIcon className="mx-auto h-6 w-6 opacity-50" />
      <p className="mt-2 text-xs font-mono">No tables found</p>
    </div>
  </div>
);

// Type icon mapping function - hoisted outside component
function getTypeIcon(dataType: string) {
  const type = dataType.toLowerCase();
  if (type.includes('int') || type.includes('serial') || type.includes('numeric') || type.includes('decimal')) {
    return Hash;
  }
  if (type.includes('bool')) {
    return ToggleLeft;
  }
  if (type.includes('time') || type.includes('date')) {
    return Calendar;
  }
  return Type;
}

// Memoized column node component
const ColumnNode = memo(function ColumnNode({
  column,
}: {
  column: TableColumn;
}) {
  const TypeIcon = getTypeIcon(column.data_type);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-[#1a1a1a]/50',
              column.is_primary_key && 'bg-yellow-500/5'
            )}
          >
            <TypeIcon className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-mono text-foreground/90 truncate">
              {column.column_name}
            </span>
            <span className="font-mono text-muted-foreground text-[10px] truncate">
              {column.data_type}
            </span>
            <div className="ml-auto flex items-center gap-1 shrink-0">
              {column.is_primary_key ? (
                <Key className="h-3 w-3 text-yellow-500" />
              ) : null}
              {column.is_foreign_key ? (
                <Link className="h-3 w-3 text-cyan-400" />
              ) : null}
              {column.is_nullable === 'NO' && !column.is_primary_key ? (
                <span className="text-[9px] text-red-400 font-mono">NN</span>
              ) : null}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          className="bg-[#1a1a1a] border-[#2a2a2a] text-xs"
        >
          <div className="space-y-1">
            <p className="font-mono">
              <span className="text-muted-foreground">Type:</span>{' '}
              {column.data_type}
            </p>
            <p className="font-mono">
              <span className="text-muted-foreground">Nullable:</span>{' '}
              {column.is_nullable}
            </p>
            {column.column_default ? (
              <p className="font-mono">
                <span className="text-muted-foreground">Default:</span>{' '}
                {column.column_default}
              </p>
            ) : null}
            {column.is_foreign_key && column.foreign_table ? (
              <p className="font-mono text-cyan-400">
                FK &rarr; {column.foreign_table}.{column.foreign_column}
              </p>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

// Memoized table node component
const TableNode = memo(function TableNode({
  tableName,
  columns,
  columnCount,
}: {
  tableName: string;
  columns: TableColumn[];
  columnCount: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const setCurrentQuery = useAppStore((state) => state.setCurrentQuery);

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleTableClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrentQuery(`SELECT * FROM ${tableName} LIMIT 100;`);
    },
    [tableName, setCurrentQuery]
  );

  return (
    <div className="mb-1">
      <button
        onClick={handleToggleExpand}
        className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-left hover:bg-[#1a1a1a] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <TableIcon className="h-3.5 w-3.5 text-cyan-400/70" />
        <span
          className="flex-1 font-mono text-xs text-foreground hover:text-cyan-400 cursor-pointer"
          onClick={handleTableClick}
        >
          {tableName}
        </span>
        <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1">
          {columnCount}
        </Badge>
      </button>

      {expanded ? (
        <div className="ml-4 border-l border-[#1a1a1a] pl-2">
          {columns.map((column) => (
            <ColumnNode key={column.column_name} column={column} />
          ))}
        </div>
      ) : null}
    </div>
  );
});

export function SchemaInspector() {
  // Use individual selectors for better re-render optimization
  const tables = useAppStore((state) => state.tables);
  const isLoading = useAppStore((state) => state.isLoading);

  // Early return for loading state
  if (isLoading) {
    return loadingState;
  }

  // Early return for empty state
  if (tables.length === 0) {
    return emptyState;
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <ScrollArea className="flex-1">
        <div className="p-2">
          {tables.map((table) => (
            <TableNode
              key={table.table_name}
              tableName={table.table_name}
              columns={table.columns}
              columnCount={table.columns.length}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
