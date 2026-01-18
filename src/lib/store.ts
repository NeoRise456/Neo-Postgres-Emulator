import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  QueryResult,
  QueryHistoryItem,
  TableSchema,
  ForeignKey,
  ViewMode,
  ResultViewMode,
  DiagramNodePosition,
} from '@/lib/types';

// Constants
const MAX_HISTORY_ITEMS = 50;
const STORAGE_KEY = 'neos-postgres-emulator-storage';

const DEFAULT_QUERY = `-- Welcome to Neo's Postgres Emulator!
-- Your database is persisted in IndexedDB.
-- Try running some queries:

SELECT * FROM users;`;

interface AppState {
  // Database state
  isDbReady: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Schema state
  tables: TableSchema[];
  foreignKeys: ForeignKey[];
  
  // Query state
  currentQuery: string;
  queryResult: QueryResult | null;
  queryError: string | null;
  isExecuting: boolean;
  
  // History
  queryHistory: QueryHistoryItem[];
  
  // UI state
  viewMode: ViewMode;
  resultViewMode: ResultViewMode;
  
  // Diagram positions (persisted)
  diagramPositions: DiagramNodePosition[];
  
  // Actions
  setDbReady: (ready: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTables: (tables: TableSchema[]) => void;
  setForeignKeys: (keys: ForeignKey[]) => void;
  setCurrentQuery: (query: string) => void;
  setQueryResult: (result: QueryResult | null) => void;
  setQueryError: (error: string | null) => void;
  setIsExecuting: (executing: boolean) => void;
  addToHistory: (item: QueryHistoryItem) => void;
  clearHistory: () => void;
  setViewMode: (mode: ViewMode) => void;
  setResultViewMode: (mode: ResultViewMode) => void;
  setDiagramPositions: (positions: DiagramNodePosition[]) => void;
  updateDiagramPosition: (id: string, x: number, y: number) => void;
  resetDiagramPositions: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      isDbReady: false,
      isLoading: true,
      error: null,
      tables: [],
      foreignKeys: [],
      currentQuery: DEFAULT_QUERY,
      queryResult: null,
      queryError: null,
      isExecuting: false,
      queryHistory: [],
      viewMode: 'editor',
      resultViewMode: 'grid',
      diagramPositions: [],

      // Actions - using functional setState pattern for stable callbacks
      setDbReady: (ready) => set({ isDbReady: ready }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setTables: (tables) => set({ tables }),
      setForeignKeys: (keys) => set({ foreignKeys: keys }),
      setCurrentQuery: (query) => set({ currentQuery: query }),
      setQueryResult: (result) => set({ queryResult: result }),
      setQueryError: (error) => set({ queryError: error }),
      setIsExecuting: (executing) => set({ isExecuting: executing }),
      
      // Use functional setState to always get latest state
      addToHistory: (item) =>
        set((state) => ({
          queryHistory: [item, ...state.queryHistory].slice(0, MAX_HISTORY_ITEMS),
        })),
      
      clearHistory: () => set({ queryHistory: [] }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setResultViewMode: (mode) => set({ resultViewMode: mode }),
      setDiagramPositions: (positions) => set({ diagramPositions: positions }),
      
      // Use functional setState for operations depending on current state
      updateDiagramPosition: (id, x, y) =>
        set((state) => {
          const existingIndex = state.diagramPositions.findIndex((p) => p.id === id);
          
          if (existingIndex >= 0) {
            // Use toSpliced for immutability (or spread if not available)
            const newPositions = [...state.diagramPositions];
            newPositions[existingIndex] = { id, x, y };
            return { diagramPositions: newPositions };
          }
          
          return {
            diagramPositions: [...state.diagramPositions, { id, x, y }],
          };
        }),
      
      resetDiagramPositions: () => set({ diagramPositions: [] }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        currentQuery: state.currentQuery,
        queryHistory: state.queryHistory,
        viewMode: state.viewMode,
        resultViewMode: state.resultViewMode,
        diagramPositions: state.diagramPositions,
      }),
    }
  )
);
