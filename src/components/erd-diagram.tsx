'use client';

import { useCallback, useEffect, useRef, useMemo, memo, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
  getNodesBounds,
  getViewportForBounds,
} from '@xyflow/react';
import type { Node, Edge, NodeProps } from '@xyflow/react';
import dagre from 'dagre';
import { toPng } from 'html-to-image';
import '@xyflow/react/dist/style.css';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RotateCcw, Key, Link, Database, ImageDown, Loader2 } from 'lucide-react';
import type { TableSchema, ForeignKey, TableColumn } from '@/lib/types';

// Define custom node data type
interface TableNodeData extends Record<string, unknown> {
  label: string;
  columns: TableColumn[];
}

// Hoisted static loading state
const loadingState = (
  <div className="flex h-full items-center justify-center bg-[#0a0a0a]">
    <div className="text-center">
      <Database className="mx-auto h-8 w-8 animate-pulse text-cyan-500/50" />
      <p className="mt-2 text-sm font-mono text-muted-foreground">
        Loading diagram...
      </p>
    </div>
  </div>
);

// Hoisted static empty state
const emptyState = (
  <div className="flex h-full items-center justify-center bg-[#0a0a0a] text-muted-foreground">
    <div className="text-center">
      <Database className="mx-auto h-8 w-8 opacity-50" />
      <p className="mt-2 text-sm font-mono">No tables to display</p>
    </div>
  </div>
);

// Constants for layout
const NODE_WIDTH = 220;
const NODE_HEIGHT = 150;
const NODE_SEP = 80;
const RANK_SEP = 150;

// PNG export constants
const IMAGE_WIDTH = 2048;
const IMAGE_HEIGHT = 1536;

// Edge style constants - hoisted
const EDGE_STYLE = { stroke: '#22d3ee', strokeWidth: 2 };
const EDGE_MARKER = {
  type: MarkerType.ArrowClosed,
  color: '#22d3ee',
} as const;
const EDGE_LABEL_STYLE = {
  fill: '#6b7280',
  fontSize: 10,
  fontFamily: 'monospace',
};
const EDGE_LABEL_BG_STYLE = {
  fill: '#0a0a0a',
  fillOpacity: 0.8,
};

// Memoized column row component
const ColumnRow = memo(function ColumnRow({ column }: { column: TableColumn }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        {column.is_primary_key ? (
          <Key className="h-3 w-3 text-yellow-500 shrink-0" />
        ) : column.is_foreign_key ? (
          <Link className="h-3 w-3 text-cyan-400 shrink-0" />
        ) : (
          <span className="w-3" />
        )}
        <span className="font-mono text-foreground">
          {column.column_name}
        </span>
      </div>
      <Badge
        variant="secondary"
        className="text-[10px] font-mono h-4 px-1 bg-[#1a1a1a]"
      >
        {column.data_type}
      </Badge>
    </div>
  );
});

// Custom node component for tables - memoized
const TableNode = memo(function TableNode({ data }: NodeProps<Node<TableNodeData, 'tableNode'>>) {
  return (
    <div className="min-w-[200px] rounded-lg border border-cyan-500/30 bg-[#0a0a0a] shadow-lg shadow-cyan-500/5 overflow-hidden">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-cyan-400 !w-2 !h-2"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-cyan-500 !w-2 !h-2"
      />

      <div className="flex items-center gap-2 border-b border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
        <Database className="h-4 w-4 text-cyan-400" />
        <span className="font-mono text-sm font-semibold text-cyan-400">
          {data.label}
        </span>
      </div>

      <div className="divide-y divide-[#1a1a1a]">
        {data.columns.map((column) => (
          <ColumnRow key={column.column_name} column={column} />
        ))}
      </div>
    </div>
  );
});

// Hoisted nodeTypes object - must be stable reference
const nodeTypes = {
  tableNode: TableNode,
} as const;

type TableNode = Node<TableNodeData, 'tableNode'>;

// Dagre layout algorithm - pure function
function getLayoutedElements(
  nodes: TableNode[],
  edges: Edge[],
  direction = 'LR'
): { nodes: TableNode[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: NODE_SEP, ranksep: RANK_SEP });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node): TableNode => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Helper to create edges from foreign keys
function createEdgesFromForeignKeys(foreignKeys: ForeignKey[]): Edge[] {
  return foreignKeys.map((fk): Edge => ({
    id: fk.constraint_name,
    source: fk.source_table,
    target: fk.target_table,
    type: 'smoothstep',
    animated: true,
    style: EDGE_STYLE,
    markerEnd: EDGE_MARKER,
    label: fk.source_column,
    labelStyle: EDGE_LABEL_STYLE,
    labelBgStyle: EDGE_LABEL_BG_STYLE,
  }));
}

// Helper to create nodes from tables
function createNodesFromTables(tables: TableSchema[]): TableNode[] {
  return tables.map((table): TableNode => ({
    id: table.table_name,
    type: 'tableNode' as const,
    position: { x: 0, y: 0 },
    data: {
      label: table.table_name,
      columns: table.columns,
    },
  }));
}

// Inner component that uses useReactFlow hook
function ErdDiagramInner() {
  // Use individual selectors for better re-render optimization
  const tables = useAppStore((state) => state.tables);
  const foreignKeys = useAppStore((state) => state.foreignKeys);
  const diagramPositions = useAppStore((state) => state.diagramPositions);
  const setDiagramPositions = useAppStore((state) => state.setDiagramPositions);
  const resetDiagramPositions = useAppStore((state) => state.resetDiagramPositions);
  const isLoading = useAppStore((state) => state.isLoading);

  const initializedRef = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<TableNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isExportingPng, setIsExportingPng] = useState(false);
  
  const { getNodes } = useReactFlow();

  // Memoize table count for dependency checking
  const tableCount = tables.length;
  const positionCount = diagramPositions.length;

  // Initialize nodes and edges when tables/foreignKeys change
  useEffect(() => {
    if (tableCount === 0) {
      setNodes([]);
      setEdges([]);
      initializedRef.current = false;
      return;
    }

    const newEdges = createEdgesFromForeignKeys(foreignKeys);

    // Check if we have saved positions for ALL tables
    const allTablesHavePositions = tables.every((table) =>
      diagramPositions.some((p) => p.id === table.table_name)
    );

    if (allTablesHavePositions && positionCount >= tableCount) {
      // Use saved positions
      const newNodes: TableNode[] = tables.map((table): TableNode => {
        const savedPosition = diagramPositions.find((p) => p.id === table.table_name)!;
        return {
          id: table.table_name,
          type: 'tableNode' as const,
          position: { x: savedPosition.x, y: savedPosition.y },
          data: {
            label: table.table_name,
            columns: table.columns,
          },
        };
      });
      setNodes(newNodes);
      setEdges(newEdges);
      initializedRef.current = true;
    } else if (!initializedRef.current) {
      // Calculate layout for new nodes
      const newNodes = createNodesFromTables(tables);
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        newNodes,
        newEdges
      );

      // Save all calculated positions
      const positions = layoutedNodes.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
      }));
      setDiagramPositions(positions);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      initializedRef.current = true;
    }
  }, [tables, foreignKeys, diagramPositions, tableCount, positionCount, setNodes, setEdges, setDiagramPositions]);

  // Save node position when dragged - stable callback
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: TableNode) => {
      // Use functional update pattern to get latest positions
      const currentPositions = useAppStore.getState().diagramPositions;
      const existingIndex = currentPositions.findIndex((p) => p.id === node.id);
      
      let updatedPositions;
      if (existingIndex >= 0) {
        updatedPositions = [...currentPositions];
        updatedPositions[existingIndex] = {
          id: node.id,
          x: node.position.x,
          y: node.position.y,
        };
      } else {
        updatedPositions = [
          ...currentPositions,
          { id: node.id, x: node.position.x, y: node.position.y },
        ];
      }
      
      setDiagramPositions(updatedPositions);
    },
    [setDiagramPositions]
  );

  // Reset layout handler - stable callback
  const handleResetLayout = useCallback(() => {
    resetDiagramPositions();
    initializedRef.current = false;

    // Get fresh data from store
    const currentTables = useAppStore.getState().tables;
    const currentForeignKeys = useAppStore.getState().foreignKeys;

    const newNodes = createNodesFromTables(currentTables);
    const newEdges = createEdgesFromForeignKeys(currentForeignKeys);

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      newNodes,
      newEdges
    );

    // Save all new positions
    const positions = layoutedNodes.map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    }));
    setDiagramPositions(positions);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    initializedRef.current = true;
  }, [resetDiagramPositions, setDiagramPositions, setNodes, setEdges]);

  // Export to PNG handler
  const handleExportPng = useCallback(async () => {
    setIsExportingPng(true);
    
    try {
      // Get the viewport element
      const viewportElement = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewportElement) {
        console.error('Could not find React Flow viewport');
        return;
      }

      const currentNodes = getNodes();
      if (currentNodes.length === 0) {
        console.warn('No nodes to export');
        return;
      }

      // Calculate bounds
      const nodesBounds = getNodesBounds(currentNodes);
      const viewport = getViewportForBounds(
        nodesBounds,
        IMAGE_WIDTH,
        IMAGE_HEIGHT,
        0.5,
        2,
        0.1
      );

      // Generate PNG
      const dataUrl = await toPng(viewportElement, {
        backgroundColor: '#0a0a0a',
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        style: {
          width: String(IMAGE_WIDTH),
          height: String(IMAGE_HEIGHT),
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      // Download
      const link = document.createElement('a');
      link.download = `erd-diagram-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export PNG:', err);
    } finally {
      setIsExportingPng(false);
    }
  }, [getNodes]);

  // Memoize default edge options
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
      animated: true,
    }),
    []
  );

  // Memoize fit view options
  const fitViewOptions = useMemo(() => ({ padding: 0.2 }), []);

  // Early return for loading state
  if (isLoading) {
    return loadingState;
  }

  // Early return for empty state
  if (tableCount === 0) {
    return emptyState;
  }

  return (
    <div className="relative h-full w-full bg-[#0a0a0a]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={fitViewOptions}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={defaultEdgeOptions}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1a1a1a"
        />
        <Controls
          className="!bg-[#0d0d0d] !border-[#1a1a1a] !shadow-lg"
          showInteractive={false}
        />
      </ReactFlow>

      <div className="absolute right-4 top-4 flex gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportPng}
                disabled={isExportingPng}
                className="bg-[#0a0a0a] border-[#1a1a1a] hover:bg-[#1a1a1a] hover:border-cyan-500/30"
              >
                {isExportingPng ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImageDown className="mr-2 h-4 w-4" />
                )}
                Export PNG
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">Export diagram as PNG image</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetLayout}
                className="bg-[#0a0a0a] border-[#1a1a1a] hover:bg-[#1a1a1a] hover:border-cyan-500/30"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Layout
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">Reset diagram to auto-layout</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// Main component wrapped with ReactFlowProvider
export function ErdDiagram() {
  return (
    <ReactFlowProvider>
      <ErdDiagramInner />
    </ReactFlowProvider>
  );
}
