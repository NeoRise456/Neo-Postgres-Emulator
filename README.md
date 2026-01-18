# Neo's Postgres Emulator

A client-side PostgreSQL playground that runs entirely in your browser using PGlite and WebAssembly. No server required.

## Overview

Neo's Postgres Emulator provides a full-featured SQL development environment powered by [PGlite](https://github.com/electric-sql/pglite), an embeddable PostgreSQL compiled to WebAssembly. Write, execute, and experiment with SQL queries without setting up a database server.

## Features

- **SQL Editor** - CodeMirror-based editor with PostgreSQL syntax highlighting, autocompletion, and keyboard shortcuts
- **Query Results** - View results in a grid or JSON format with execution time metrics
- **Schema Inspector** - Browse tables and their columns, types, constraints, and relationships
- **ERD Diagram** - Auto-generated entity relationship diagram using React Flow with foreign key visualization
- **Query History** - Track and re-run previous queries
- **Database Tools** - Import/export SQL files and clear the database
- **Keyboard Shortcuts** - Press `?` to view all available shortcuts
- **Persistent Storage** - Database state persists in browser storage

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Database**: PGlite (PostgreSQL compiled to WASM)
- **Editor**: CodeMirror with SQL language support
- **UI Components**: Radix UI primitives with Tailwind CSS
- **Diagrams**: React Flow with Dagre layout
- **State Management**: Zustand

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm, yarn, pnpm, or bun

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sql-playground

# Install dependencies
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Usage

1. **Write SQL** - Enter your SQL queries in the editor panel
2. **Execute** - Press `Ctrl+Enter` (or `Cmd+Enter` on Mac) to run the query
3. **View Results** - See query results in the grid or JSON view
4. **Inspect Schema** - Browse the schema tree to see tables and columns
5. **View ERD** - Switch to the ERD tab to see table relationships

### Example Queries

```sql
-- Create a table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert data
INSERT INTO users (name, email) VALUES 
  ('Alice', 'alice@example.com'),
  ('Bob', 'bob@example.com');

-- Query data
SELECT * FROM users;
```

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Execute query | Ctrl+Enter | Cmd+Enter |
| Toggle comment | Ctrl+/ | Cmd+/ |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Shift+Z | Cmd+Shift+Z |
| Find | Ctrl+F | Cmd+F |
| Find and replace | Ctrl+H | Cmd+H |
| Show shortcuts | ? | ? |

## Project Structure

```
src/
  app/                    # Next.js app router pages
  components/             # React components
    ui/                   # Reusable UI primitives
    sql-editor.tsx        # SQL editor with CodeMirror
    query-results.tsx     # Results grid and JSON view
    schema-inspector.tsx  # Schema tree browser
    erd-diagram.tsx       # Entity relationship diagram
    query-history.tsx     # Query history panel
    database-tools.tsx    # Import/export/clear tools
    keyboard-shortcuts.tsx # Shortcuts dialog
    playground-layout.tsx  # Main layout component
    loading-screen.tsx     # Initial loading state
  lib/
    pglite-provider.tsx   # PGlite context and hooks
    store.ts              # Zustand state management
    utils.ts              # Utility functions
```

## Browser Support

Requires a modern browser with WebAssembly support:
- Chrome 57+
- Firefox 52+
- Safari 11+
- Edge 16+

## Limitations

- Database runs entirely in-browser; data is stored in IndexedDB
- Some PostgreSQL extensions and features may not be available in PGlite
- Large datasets may impact browser performance
- No multi-user or server-side persistence

## License

MIT
