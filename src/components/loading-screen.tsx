'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Database, Loader2 } from 'lucide-react';

// Progress update interval in ms
const PROGRESS_INTERVAL = 50;

// Hoisted static logo JSX
const logo = (
  <div className="flex items-center gap-3 mb-8">
    <Database className="h-10 w-10 text-cyan-400" />
    <span className="font-mono text-2xl font-bold text-cyan-400">
      Neo&apos;s Postgres Emulator
    </span>
  </div>
);

// Hoisted static spinner JSX
const spinner = <Loader2 className="h-8 w-8 text-cyan-400 animate-spin mb-6" />;

// Status text helper - pure function
function getStatusText(progress: number): { main: string; sub: string } {
  if (progress < 50) {
    return { main: 'Initializing PostgreSQL...', sub: 'Loading WASM runtime' };
  }
  if (progress < 80) {
    return { main: 'Initializing PostgreSQL...', sub: 'Setting up database engine' };
  }
  if (progress < 100) {
    return { main: 'Initializing PostgreSQL...', sub: 'Preparing workspace' };
  }
  return { main: 'Ready!', sub: 'Welcome' };
}

export function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  // Use individual selectors for better re-render optimization
  const isLoading = useAppStore((state) => state.isLoading);
  const isDbReady = useAppStore((state) => state.isDbReady);
  
  // Use lazy state initialization for progress
  const [progress, setProgress] = useState(0);

  // Animate progress using functional setState to avoid stale closures
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        // Check current ready state from store to avoid closure issues
        const ready = useAppStore.getState().isDbReady;
        
        if (ready && prev >= 80) {
          return 100;
        }
        if (prev < 80) {
          return prev + 2;
        }
        if (prev < 95 && !ready) {
          return prev + 0.3;
        }
        if (!ready) {
          return 95;
        }
        return Math.min(prev + 5, 100);
      });
    }, PROGRESS_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Complete when ready - stable callback with proper dependencies
  useEffect(() => {
    if (progress >= 100 && isDbReady) {
      const timeout = setTimeout(onComplete, 300);
      return () => clearTimeout(timeout);
    }
  }, [progress, isDbReady, onComplete]);

  // Derive status text
  const { main: statusMain, sub: statusSub } = getStatusText(progress);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]">
      {logo}
      {spinner}

      {/* Progress bar */}
      <div className="w-72 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-100 ease-linear rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status text */}
      <p className="font-mono text-sm text-cyan-400">{statusMain}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{statusSub}</p>
    </div>
  );
}
