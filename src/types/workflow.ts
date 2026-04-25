// Workflow node types
export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'email' | 'wait' | 'condition' | 'task';
  position: { x: number; y: number };
  data: {
    label: string;
    [key: string]: any;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  webhook_url?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  trigger_type: 'webhook' | 'manual' | 'scheduled';
  trigger_data?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  completed_at?: string;
}
