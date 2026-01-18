'use client';

import { useCallback, memo } from 'react';
import { useAppStore } from '@/lib/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  History,
  CheckCircle,
  XCircle,
  Trash2,
  Clock,
  Copy,
  Play,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePGlite } from '@/lib/pglite-provider';
import type { QueryHistoryItem } from '@/lib/types';

// Hoisted regex for cleaning queries
const COMMENT_REGEX = /--.*$/gm;
const WHITESPACE_REGEX = /\s+/g;

// Hoisted static empty state
const emptyState = (
  <div className="flex h-full flex-col bg-[#0a0a0a]">
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center">
        <Clock className="mx-auto h-8 w-8 text-muted-foreground/30" />
        <p className="mt-2 text-xs text-muted-foreground font-mono">
          No queries yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70 font-mono">
          Run a query to see it here
        </p>
      </div>
    </div>
  </div>
);

// Utility functions - hoisted outside component
function formatTimestamp(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  // Otherwise show date
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncateQuery(query: string, maxLength = 60): string {
  // Remove comments and normalize whitespace
  const cleaned = query
    .replace(COMMENT_REGEX, '')
    .replace(WHITESPACE_REGEX, ' ')
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength) + '...';
}

// Memoized history item component
const HistoryItem = memo(function HistoryItem({
  item,
  onCopy,
  onLoad,
  onRun,
}: {
  item: QueryHistoryItem;
  onCopy: (query: string) => void;
  onLoad: (query: string) => void;
  onRun: (query: string) => void;
}) {
  const handleCopy = useCallback(() => onCopy(item.query), [item.query, onCopy]);
  const handleLoad = useCallback(() => onLoad(item.query), [item.query, onLoad]);
  const handleRun = useCallback(() => onRun(item.query), [item.query, onRun]);

  return (
    <div className="group relative rounded-md border border-[#1a1a1a] bg-[#0d0d0d] p-3 hover:border-cyan-500/30 transition-colors">
      <div className="flex items-start gap-2">
        {item.success ? (
          <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
        ) : (
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-foreground/90 break-all">
            {truncateQuery(item.query)}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <span>{formatTimestamp(item.timestamp)}</span>
            {item.success && item.rowCount !== undefined ? (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span>{item.rowCount} rows</span>
              </>
            ) : null}
            {!item.success && item.error ? (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span className="text-red-400/70 truncate max-w-[120px]">
                  {item.error}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {/* Action buttons - show on hover */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">Copy query</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoad}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10"
              >
                <History className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">Load to editor</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRun}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10"
              >
                <Play className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">Run query</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
});

// Memoized header component
const HistoryHeader = memo(function HistoryHeader({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#1a1a1a] px-3 py-1.5">
      <span className="text-xs text-muted-foreground font-mono">
        {count} queries
      </span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-mono text-xs">Clear history</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
});

export function QueryHistory() {
  // Use individual selectors for better re-render optimization
  const queryHistory = useAppStore((state) => state.queryHistory);
  const setCurrentQuery = useAppStore((state) => state.setCurrentQuery);
  const clearHistory = useAppStore((state) => state.clearHistory);
  const { executeQuery } = usePGlite();

  // Stable callbacks
  const handleCopyQuery = useCallback((query: string) => {
    navigator.clipboard.writeText(query);
  }, []);

  const handleLoadQuery = useCallback(
    (query: string) => {
      setCurrentQuery(query);
    },
    [setCurrentQuery]
  );

  const handleRunQuery = useCallback(
    async (query: string) => {
      setCurrentQuery(query);
      try {
        await executeQuery(query);
      } catch {
        // Error handled in provider
      }
    },
    [setCurrentQuery, executeQuery]
  );

  // Early return for empty state
  if (queryHistory.length === 0) {
    return emptyState;
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <HistoryHeader count={queryHistory.length} onClear={clearHistory} />
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {queryHistory.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              onCopy={handleCopyQuery}
              onLoad={handleLoadQuery}
              onRun={handleRunQuery}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
