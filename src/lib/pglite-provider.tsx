'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { PGlite } from '@electric-sql/pglite';
import { useAppStore } from '@/lib/store';
import type { TableSchema, ForeignKey, QueryResult } from '@/lib/types';

interface PGliteContextType {
  db: PGlite | null;
  executeQuery: (query: string) => Promise<QueryResult>;
  refreshSchema: () => Promise<void>;
  rawQuery: <T = Record<string, unknown>>(query: string) => Promise<{ rows: T[] }>;
}

const PGliteContext = createContext<PGliteContextType | null>(null);

const DEMO_SEED_SQL = `
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Create posts table with foreign key to users
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create comments table with foreign keys to users and posts
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#3b82f6'
);

-- Create post_tags junction table
CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Insert demo users (only if table is empty)
INSERT INTO users (username, email) 
SELECT 'alice', 'alice@example.com' WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'alice');
INSERT INTO users (username, email) 
SELECT 'bob', 'bob@example.com' WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'bob');
INSERT INTO users (username, email) 
SELECT 'charlie', 'charlie@example.com' WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'charlie');

-- Insert demo posts (only if table is empty)
INSERT INTO posts (user_id, title, content, published)
SELECT 1, 'Getting Started with SQL', 'SQL is a powerful language for managing data...', true
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE title = 'Getting Started with SQL');

INSERT INTO posts (user_id, title, content, published)
SELECT 1, 'Advanced PostgreSQL Tips', 'Here are some advanced tips for PostgreSQL...', true
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE title = 'Advanced PostgreSQL Tips');

INSERT INTO posts (user_id, title, content, published)
SELECT 2, 'My First Blog Post', 'Hello world! This is my first post.', true
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE title = 'My First Blog Post');

INSERT INTO posts (user_id, title, content, published)
SELECT 3, 'Draft Post', 'This is still a work in progress...', false
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE title = 'Draft Post');

-- Insert demo tags
INSERT INTO tags (name, color) SELECT 'sql', '#3b82f6' WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'sql');
INSERT INTO tags (name, color) SELECT 'tutorial', '#10b981' WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'tutorial');
INSERT INTO tags (name, color) SELECT 'postgresql', '#8b5cf6' WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'postgresql');

-- Insert demo post_tags
INSERT INTO post_tags (post_id, tag_id) SELECT 1, 1 WHERE NOT EXISTS (SELECT 1 FROM post_tags WHERE post_id = 1 AND tag_id = 1);
INSERT INTO post_tags (post_id, tag_id) SELECT 1, 2 WHERE NOT EXISTS (SELECT 1 FROM post_tags WHERE post_id = 1 AND tag_id = 2);
INSERT INTO post_tags (post_id, tag_id) SELECT 2, 3 WHERE NOT EXISTS (SELECT 1 FROM post_tags WHERE post_id = 2 AND tag_id = 3);

-- Insert demo comments
INSERT INTO comments (post_id, user_id, content)
SELECT 1, 2, 'Great article! Very helpful.'
WHERE NOT EXISTS (SELECT 1 FROM comments WHERE post_id = 1 AND user_id = 2);

INSERT INTO comments (post_id, user_id, content)
SELECT 1, 3, 'Thanks for sharing this!'
WHERE NOT EXISTS (SELECT 1 FROM comments WHERE post_id = 1 AND user_id = 3);

INSERT INTO comments (post_id, user_id, content)
SELECT 3, 1, 'Welcome to blogging!'
WHERE NOT EXISTS (SELECT 1 FROM comments WHERE post_id = 3 AND user_id = 1);
`;

// DDL command patterns - hoisted outside component
const DDL_PATTERNS = ['CREATE', 'DROP', 'ALTER'] as const;

export function PGliteProvider({ children }: { children: React.ReactNode }) {
  const dbRef = useRef<PGlite | null>(null);
  const initializingRef = useRef(false);

  // Use stable selectors to prevent unnecessary re-renders
  const setDbReady = useAppStore((state) => state.setDbReady);
  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);
  const setTables = useAppStore((state) => state.setTables);
  const setForeignKeys = useAppStore((state) => state.setForeignKeys);
  const setQueryResult = useAppStore((state) => state.setQueryResult);
  const setQueryError = useAppStore((state) => state.setQueryError);
  const setIsExecuting = useAppStore((state) => state.setIsExecuting);
  const addToHistory = useAppStore((state) => state.addToHistory);

  const refreshSchema = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;

    try {
      // Get all tables
      const tablesResult = await db.query<{ table_name: string }>(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tables: TableSchema[] = [];

      for (const row of tablesResult.rows) {
        const tableName = row.table_name;
        
        // Get columns for each table
        const columnsResult = await db.query<{
          column_name: string;
          data_type: string;
          is_nullable: string;
          column_default: string | null;
        }>(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${tableName}'
          ORDER BY ordinal_position
        `);

        // Get primary keys
        const pkResult = await db.query<{ column_name: string }>(`
          SELECT a.attname as column_name
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = '${tableName}'::regclass AND i.indisprimary
        `);
        const primaryKeys = new Set(pkResult.rows.map((r) => r.column_name));

        // Get foreign keys for this table
        const fkResult = await db.query<{
          column_name: string;
          foreign_table_name: string;
          foreign_column_name: string;
        }>(`
          SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = '${tableName}'
        `);

        const fkMap = new Map(
          fkResult.rows.map((fk) => [
            fk.column_name,
            { table: fk.foreign_table_name, column: fk.foreign_column_name },
          ])
        );

        tables.push({
          table_name: tableName,
          columns: columnsResult.rows.map((col) => ({
            ...col,
            is_primary_key: primaryKeys.has(col.column_name),
            is_foreign_key: fkMap.has(col.column_name),
            foreign_table: fkMap.get(col.column_name)?.table,
            foreign_column: fkMap.get(col.column_name)?.column,
          })),
        });
      }

      setTables(tables);

      // Get all foreign keys for diagram
      const allFkResult = await db.query<{
        constraint_name: string;
        source_table: string;
        source_column: string;
        target_table: string;
        target_column: string;
      }>(`
        SELECT
          tc.constraint_name,
          tc.table_name AS source_table,
          kcu.column_name AS source_column,
          ccu.table_name AS target_table,
          ccu.column_name AS target_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
      `);

      setForeignKeys(allFkResult.rows as ForeignKey[]);
    } catch (err) {
      console.error('Failed to refresh schema:', err);
    }
  }, [setTables, setForeignKeys]);

  // Raw query without history tracking - for internal use (exports, schema inspection)
  const rawQuery = useCallback(
    async <T = Record<string, unknown>>(query: string): Promise<{ rows: T[] }> => {
      const db = dbRef.current;
      if (!db) {
        throw new Error('Database not initialized');
      }
      const result = await db.query<T>(query);
      return { rows: result.rows };
    },
    []
  );

  const executeQuery = useCallback(
    async (query: string): Promise<QueryResult> => {
      const db = dbRef.current;
      if (!db) {
        throw new Error('Database not initialized');
      }

      setIsExecuting(true);
      setQueryError(null);

      const startTime = performance.now();
      const historyId = crypto.randomUUID();

      try {
        const result = await db.query(query);
        const duration = performance.now() - startTime;

        const queryResult: QueryResult = {
          rows: result.rows as Record<string, unknown>[],
          fields: result.fields,
          rowCount: result.rows.length,
          command: query.trim().split(/\s+/)[0].toUpperCase(),
          duration,
        };

        setQueryResult(queryResult);

        addToHistory({
          id: historyId,
          query,
          timestamp: new Date(),
          success: true,
          rowCount: result.rows.length,
        });

        // Refresh schema if it was a DDL command - check early exit pattern
        const commandUpper = query.trim().toUpperCase();
        const isDDL = DDL_PATTERNS.some((pattern) => commandUpper.startsWith(pattern));
        
        if (isDDL) {
          await refreshSchema();
        }

        return queryResult;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setQueryError(errorMessage);

        addToHistory({
          id: historyId,
          query,
          timestamp: new Date(),
          success: false,
          error: errorMessage,
        });

        throw err;
      } finally {
        setIsExecuting(false);
      }
    },
    [setIsExecuting, setQueryError, setQueryResult, addToHistory, refreshSchema]
  );

  useEffect(() => {
    async function initDb() {
      if (initializingRef.current || dbRef.current) return;
      initializingRef.current = true;

      try {
        setLoading(true);
        setError(null);

        // Initialize PGlite with IndexedDB persistence
        const db = new PGlite('idb://sql-playground-db');
        dbRef.current = db;

        // Wait for db to be ready
        await db.waitReady;

        // Check if this is first run (no users table)
        const checkResult = await db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'users'
          ) as exists
        `);

        const tableExists = (checkResult.rows[0] as { exists: boolean }).exists;

        if (!tableExists) {
          // Seed demo data
          await db.exec(DEMO_SEED_SQL);
        }

        await refreshSchema();
        setDbReady(true);
      } catch (err) {
        console.error('Failed to initialize database:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize database');
      } finally {
        setLoading(false);
      }
    }

    initDb();

    return () => {
      // Cleanup on unmount
      if (dbRef.current) {
        dbRef.current.close();
        dbRef.current = null;
      }
    };
  }, [setDbReady, setLoading, setError, refreshSchema]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<PGliteContextType>(
    () => ({
      db: dbRef.current,
      executeQuery,
      refreshSchema,
      rawQuery,
    }),
    [executeQuery, refreshSchema, rawQuery]
  );

  return (
    <PGliteContext.Provider value={contextValue}>
      {children}
    </PGliteContext.Provider>
  );
}

export function usePGlite() {
  const context = useContext(PGliteContext);
  if (!context) {
    throw new Error('usePGlite must be used within a PGliteProvider');
  }
  return context;
}
