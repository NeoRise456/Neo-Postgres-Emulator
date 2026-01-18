'use client';

import { PGliteProvider } from '@/lib/pglite-provider';
import { PlaygroundLayout } from '@/components/playground-layout';

export default function Home() {
  return (
    <PGliteProvider>
      <PlaygroundLayout />
    </PGliteProvider>
  );
}
