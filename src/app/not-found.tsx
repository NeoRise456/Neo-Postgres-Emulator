import Link from 'next/link';

export default function NotFound() {
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
      
      <h1 className="font-mono text-6xl font-bold text-white mb-2">404</h1>
      <p className="font-mono text-lg text-neutral-500 mb-8">
        Page not found
      </p>
      
      <Link
        href="/"
        className="font-mono text-sm text-cyan-400 hover:text-cyan-300 transition-colors px-4 py-2 border border-cyan-400/30 rounded hover:border-cyan-400/60"
      >
        Back to Playground
      </Link>
    </div>
  );
}
