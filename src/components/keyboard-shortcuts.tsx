'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

// Types
interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

// Hoisted static data - shortcuts array defined outside component
const SHORTCUTS: Shortcut[] = [
  // Editor
  { keys: ['Ctrl', 'Enter'], description: 'Execute query', category: 'Editor' },
  { keys: ['Ctrl', '/'], description: 'Toggle comment', category: 'Editor' },
  { keys: ['Ctrl', 'Z'], description: 'Undo', category: 'Editor' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo', category: 'Editor' },
  { keys: ['Ctrl', 'A'], description: 'Select all', category: 'Editor' },
  { keys: ['Ctrl', 'D'], description: 'Select word / next occurrence', category: 'Editor' },
  { keys: ['Ctrl', 'F'], description: 'Find', category: 'Editor' },
  { keys: ['Ctrl', 'H'], description: 'Find and replace', category: 'Editor' },
  
  // Navigation
  { keys: ['Ctrl', 'G'], description: 'Go to line', category: 'Navigation' },
  { keys: ['Ctrl', '['], description: 'Outdent line', category: 'Navigation' },
  { keys: ['Ctrl', ']'], description: 'Indent line', category: 'Navigation' },
  
  // General
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'General' },
  { keys: ['Esc'], description: 'Close dialogs', category: 'General' },
];

// Hoisted - pre-computed grouped shortcuts (static, no need to recompute)
const GROUPED_SHORTCUTS = SHORTCUTS.reduce((acc, shortcut) => {
  if (!acc[shortcut.category]) {
    acc[shortcut.category] = [];
  }
  acc[shortcut.category].push(shortcut);
  return acc;
}, {} as Record<string, Shortcut[]>);

// Hoisted static elements
const dialogFooter = (
  <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
    <p className="text-xs text-muted-foreground font-mono text-center">
      Press <kbd className="px-1.5 py-0.5 text-xs bg-[#1a1a1a] border border-[#2a2a2a] rounded">?</kbd> anytime to show this dialog
    </p>
  </div>
);

// Pure function for Mac key remapping (hoisted outside component)
function formatKeysForPlatform(keys: string[], isMac: boolean): string[] {
  if (!isMac) return keys;
  return keys.map(key => {
    switch (key) {
      case 'Ctrl': return '\u2318'; // Command
      case 'Alt': return '\u2325';  // Option
      case 'Shift': return '\u21E7'; // Shift
      default: return key;
    }
  });
}

// Memoized key badge component
const KeyBadge = memo(function KeyBadge({ keyText }: { keyText: string }) {
  return (
    <kbd className="px-2 py-1 text-xs font-mono bg-[#1a1a1a] border border-[#2a2a2a] rounded text-foreground/80">
      {keyText}
    </kbd>
  );
});

// Memoized shortcut row component
const ShortcutRow = memo(function ShortcutRow({
  shortcut,
  isMac,
}: {
  shortcut: Shortcut;
  isMac: boolean;
}) {
  const formattedKeys = formatKeysForPlatform(shortcut.keys, isMac);
  
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#1a1a1a] transition-colors">
      <span className="text-sm text-foreground/90">
        {shortcut.description}
      </span>
      <div className="flex items-center gap-1">
        {formattedKeys.map((key, i) => (
          <span key={i}>
            <KeyBadge keyText={key} />
            {i < shortcut.keys.length - 1 ? (
              <span className="text-muted-foreground mx-0.5">+</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
});

// Memoized category section component
const ShortcutCategory = memo(function ShortcutCategory({
  category,
  items,
  isMac,
}: {
  category: string;
  items: Shortcut[];
  isMac: boolean;
}) {
  return (
    <div>
      <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-2">
        {category}
      </h3>
      <div className="space-y-1">
        {items.map((shortcut, index) => (
          <ShortcutRow key={index} shortcut={shortcut} isMac={isMac} />
        ))}
      </div>
    </div>
  );
});

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  // Stable callback for opening dialog
  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  // Stable callback for closing dialog
  const closeDialog = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    // Detect Mac on mount
    setIsMac(navigator.platform.toLowerCase().includes('mac'));

    // Keyboard event handler
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input or editor
      const target = e.target as HTMLElement;
      const isEditing = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' ||
                        target.classList.contains('cm-content');
      
      if (e.key === '?' && !isEditing) {
        e.preventDefault();
        setOpen(true);
      }
      
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    // Add event listener with passive option where applicable
    // Note: keydown with preventDefault cannot be passive, but we add it explicitly
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Memoize the grouped entries to avoid re-computation on render
  const groupedEntries = useMemo(
    () => Object.entries(GROUPED_SHORTCUTS),
    []
  );

  return (
    <>
      {/* Trigger button in header */}
      <button
        onClick={openDialog}
        className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-cyan-400 transition-colors"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Shortcuts</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0a0a0a] border-[#1a1a1a] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-cyan-400">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {groupedEntries.map(([category, items]) => (
              <ShortcutCategory
                key={category}
                category={category}
                items={items}
                isMac={isMac}
              />
            ))}
          </div>

          {dialogFooter}
        </DialogContent>
      </Dialog>
    </>
  );
}
