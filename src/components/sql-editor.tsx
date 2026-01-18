'use client';

import { useCallback, useMemo, memo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap, KeyBinding } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { useAppStore } from '@/lib/store';
import { usePGlite } from '@/lib/pglite-provider';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';

// Hoist static theme configuration outside component
const customTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
  },
  '.cm-gutters': {
    backgroundColor: '#0d0d0d',
    borderRight: '1px solid #1a1a1a',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#1a1a1a',
  },
  '.cm-activeLine': {
    backgroundColor: '#1a1a1a50',
  },
});

// Hoist static setup configuration
const basicSetupConfig = {
  lineNumbers: true,
  highlightActiveLineGutter: true,
  highlightActiveLine: true,
  foldGutter: true,
  autocompletion: true,
  bracketMatching: true,
} as const;

// Memoized toolbar component
const EditorToolbar = memo(function EditorToolbar({
  onExecute,
  isExecuting,
  hasQuery,
}: {
  onExecute: () => void;
  isExecuting: boolean;
  hasQuery: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-cyan-400/70 font-mono">SQL</span>
        <span className="text-xs text-muted-foreground">|</span>
        <span className="text-xs text-muted-foreground font-mono">
          Ctrl+Enter to run
        </span>
      </div>
      <Button
        size="sm"
        onClick={onExecute}
        disabled={isExecuting || !hasQuery}
        className="bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30"
      >
        {isExecuting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        Run
      </Button>
    </div>
  );
});

export function SqlEditor() {
  // Use individual selectors for better re-render optimization
  const currentQuery = useAppStore((state) => state.currentQuery);
  const setCurrentQuery = useAppStore((state) => state.setCurrentQuery);
  const isExecuting = useAppStore((state) => state.isExecuting);
  const { executeQuery } = usePGlite();

  // Stable callback using functional approach
  const handleExecute = useCallback(async () => {
    // Read current query from store at execution time to avoid stale closure
    const query = useAppStore.getState().currentQuery;
    const executing = useAppStore.getState().isExecuting;
    
    if (!query.trim() || executing) return;
    
    try {
      await executeQuery(query);
    } catch {
      // Error is already handled in the provider
    }
  }, [executeQuery]);

  // Memoize extensions array to prevent re-creating on every render
  const extensions = useMemo(() => {
    // Use Prec.highest to ensure our keymap takes precedence over basicSetup
    const runKeymap = Prec.highest(
      keymap.of([
        {
          key: 'Ctrl-Enter',
          run: () => {
            handleExecute();
            return true;
          },
          preventDefault: true,
        },
        {
          key: 'Cmd-Enter',
          run: () => {
            handleExecute();
            return true;
          },
          preventDefault: true,
        },
      ])
    );

    return [
      sql({ dialect: PostgreSQL }),
      customTheme,
      runKeymap,
      EditorView.lineWrapping,
    ];
  }, [handleExecute]);

  // Derive hasQuery for button state
  const hasQuery = currentQuery.trim().length > 0;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <EditorToolbar
        onExecute={handleExecute}
        isExecuting={isExecuting}
        hasQuery={hasQuery}
      />
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={currentQuery}
          onChange={setCurrentQuery}
          height="100%"
          theme={oneDark}
          extensions={extensions}
          basicSetup={basicSetupConfig}
          className="h-full"
        />
      </div>
    </div>
  );
}
