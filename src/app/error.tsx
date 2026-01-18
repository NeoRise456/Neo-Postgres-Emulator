'use client';

import { useEffect } from 'react';
import { Database } from 'lucide-react';

// Hoisted static logo JSX
const logo = (
  <div className="flex items-center gap-3 mb-8">
    <Database className="h-10 w-10 text-cyan-400" />
    <span className="font-mono text-2xl font-bold text-cyan-400">
      Neo&apos;s Postgres Emulator
    </span>
  </div>
);

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]">
      {logo}
      
      <h1 className="font-mono text-4xl font-bold text-white mb-2">
        Something went wrong
      </h1>
      <p className="font-mono text-sm text-muted-foreground mb-8 max-w-md text-center">
        An unexpected error occurred. Please try again.
      </p>
      
      <button
        onClick={reset}
        className="font-mono text-sm text-cyan-400 hover:text-cyan-300 transition-colors px-4 py-2 border border-cyan-400/30 rounded hover:border-cyan-400/60"
      >
        Try again
      </button>
    </div>
  );
}
