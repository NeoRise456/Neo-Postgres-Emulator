'use client';

import { useState, useCallback, memo } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/lib/store';
import { SqlEditor } from '@/components/sql-editor';
import { ErdDiagram } from '@/components/erd-diagram';
import { SchemaInspector } from '@/components/schema-inspector';
import { QueryResults } from '@/components/query-results';
import { QueryHistory } from '@/components/query-history';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { DatabaseTools } from '@/components/database-tools';
import { LoadingScreen } from '@/components/loading-screen';
import { Code, GitBranch, Database, History, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Hoisted static JSX elements to avoid re-creation
const connectionIndicator = (
  <div className="flex items-center gap-2">
    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
    <span className="text-xs font-mono text-cyan-400/70">Connected</span>
  </div>
);

const pgliteTag = (
  <span className="text-xs font-mono text-muted-foreground">
    PGlite + WASM
  </span>
);

// Memoized header component to prevent re-renders
const Header = memo(function Header() {
  return (
    <header className="flex h-12 items-center justify-between border-b border-[#1a1a1a] bg-[#0a0a0a] px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-cyan-400" />
          <span className="font-mono text-sm font-bold text-cyan-400">
            Neo&apos;s Postgres Emulator
          </span>
        </div>
        {pgliteTag}
      </div>
      <div className="flex items-center gap-4">
        <DatabaseTools />
        <KeyboardShortcuts />
        <Button
          variant="ghost"
          size="icon-sm"
          asChild
          className="text-muted-foreground hover:text-cyan-400"
        >
          <a
            href="https://github.com/NeoRise456/Neo-Postgres-Emulator"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
        </Button>
        {connectionIndicator}
      </div>
    </header>
  );
});

// Error display component
const ErrorDisplay = memo(function ErrorDisplay({ error }: { error: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-[#050505]">
      <div className="text-center max-w-md">
        <Database className="mx-auto h-16 w-16 text-red-500/50" />
        <p className="mt-4 font-mono text-sm text-red-500">
          Failed to initialize database
        </p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {error}
        </p>
      </div>
    </div>
  );
});

export function PlaygroundLayout() {
  // Use individual selectors for better re-render optimization
  const viewMode = useAppStore((state) => state.viewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const isLoading = useAppStore((state) => state.isLoading);
  const error = useAppStore((state) => state.error);
  const isDbReady = useAppStore((state) => state.isDbReady);

  const [showLoading, setShowLoading] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<'schema' | 'history'>('schema');

  const handleLoadingComplete = useCallback(() => {
    setShowLoading(false);
  }, []);

  const handleViewModeChange = useCallback(
    (value: string) => {
      setViewMode(value as 'editor' | 'diagram');
    },
    [setViewMode]
  );

  const handleRightPanelTabChange = useCallback(
    (value: string) => {
      setRightPanelTab(value as 'schema' | 'history');
    },
    []
  );

  // Show loading screen while DB is loading
  if (isLoading || (showLoading && !error)) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  // Error state - use explicit ternary pattern
  if (error) {
    return <ErrorDisplay error={error} />;
  }

  // Not ready state
  if (!isDbReady) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-[#050505]">
      <Header />

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel - Editor/Diagram */}
        <ResizablePanel defaultSize={66} minSize={40}>
          <Tabs
            value={viewMode}
            onValueChange={handleViewModeChange}
            className="flex h-full flex-col"
          >
            <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
              <TabsList className="h-10 w-full justify-start rounded-none border-none bg-transparent px-2">
                <TabsTrigger
                  value="editor"
                  className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 font-mono text-xs"
                >
                  <Code className="h-4 w-4" />
                  SQL Editor
                </TabsTrigger>
                <TabsTrigger
                  value="diagram"
                  className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 font-mono text-xs"
                >
                  <GitBranch className="h-4 w-4" />
                  ERD Diagram
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="editor" className="mt-0 flex-1 overflow-hidden">
              <SqlEditor />
            </TabsContent>
            <TabsContent value="diagram" className="mt-0 flex-1 overflow-hidden">
              <ErdDiagram />
            </TabsContent>
          </Tabs>
        </ResizablePanel>

        <ResizableHandle className="w-1 bg-[#1a1a1a] hover:bg-cyan-500/30 transition-colors" />

        {/* Right Panel - Schema/History + Results */}
        <ResizablePanel defaultSize={34} minSize={25}>
          <ResizablePanelGroup direction="vertical">
            {/* Top - Schema Inspector or Query History */}
            <ResizablePanel defaultSize={50} minSize={20}>
              <Tabs
                value={rightPanelTab}
                onValueChange={handleRightPanelTabChange}
                className="flex h-full flex-col"
              >
                <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                  <TabsList className="h-9 w-full justify-start rounded-none border-none bg-transparent px-2">
                    <TabsTrigger
                      value="schema"
                      className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 font-mono text-xs"
                    >
                      <Database className="h-3.5 w-3.5" />
                      Schema
                    </TabsTrigger>
                    <TabsTrigger
                      value="history"
                      className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 font-mono text-xs"
                    >
                      <History className="h-3.5 w-3.5" />
                      History
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="schema" className="mt-0 flex-1 overflow-hidden">
                  <SchemaInspector />
                </TabsContent>
                <TabsContent value="history" className="mt-0 flex-1 overflow-hidden">
                  <QueryHistory />
                </TabsContent>
              </Tabs>
            </ResizablePanel>

            <ResizableHandle className="h-1 bg-[#1a1a1a] hover:bg-cyan-500/30 transition-colors" />

            {/* Bottom - Query Results */}
            <ResizablePanel defaultSize={50} minSize={20}>
              <QueryResults />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
