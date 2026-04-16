import { useCallback, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  TriggerNode,
  EmailNode,
  WaitNode,
  ConditionNode,
  TaskNode,
} from './WorkflowNodes';
import { WorkflowNodePalette } from './WorkflowNodePalette';
import { Workflow } from '@/types/workflow';

const nodeTypes = {
  trigger: TriggerNode,
  email: EmailNode,
  wait: WaitNode,
  condition: ConditionNode,
  task: TaskNode,
};

interface WorkflowCanvasProps {
  workflow?: Workflow;
  onSave: (nodes: Node[], edges: Edge[]) => void;
}

export function WorkflowCanvas({ workflow, onSave }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.edges || []);
  const [isSaving, setIsSaving] = useState(false);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const nodeLabel = {
        trigger: 'New Lead (Webhook)',
        sms: 'Send SMS',
        email: 'Send Email',
        wait: 'Wait 5 minutes',
        condition: 'If/Then',
        task: 'Task',
      }[type as string] || 'Node';

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label: nodeLabel },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(nodes, edges);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSelected = useCallback(() => {
    setNodes((nodes) =>
      nodes.filter(
        (node) =>
          !(node.selected) &&
          !node.data.isDeleting
      )
    );
    setEdges((edges) =>
      edges.filter(
        (edge) =>
          !(edge.selected)
      )
    );
  }, [setNodes, setEdges]);

  return (
    <div className="flex h-full gap-4">
      {/* Node Palette */}
      <div className="w-56 bg-card border rounded-lg p-4 overflow-y-auto">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Available Nodes</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Drag nodes to the canvas
            </p>
          </div>
          <WorkflowNodePalette />
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>

        {/* Toolbar */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-card border rounded-lg shadow-lg p-4 flex items-center gap-4">
            {nodes.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                Start by adding a Trigger node
              </div>
            )}
            <Button onClick={deleteSelected} variant="outline">
              Delete Selected
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90">
              {isSaving ? 'Saving...' : 'Save Workflow'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
