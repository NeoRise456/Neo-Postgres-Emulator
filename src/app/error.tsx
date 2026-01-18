'use client';

import { useEffect } from 'react';

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
      <div className="flex items-center gap-3 mb-8">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-cyan-400"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5V19A9 3 0 0 0 21 19V5" />
          <path d="M3 12A9 3 0 0 0 21 12" />
        </svg>
        <span className="font-mono text-2xl font-bold text-cyan-400">
          Neo&apos;s Postgres Emulator
        </span>
      </div>
      
      <h1 className="font-mono text-4xl font-bold text-white mb-2">
        Something went wrong
      </h1>
      <p className="font-mono text-sm text-neutral-500 mb-8 max-w-md text-center">
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
