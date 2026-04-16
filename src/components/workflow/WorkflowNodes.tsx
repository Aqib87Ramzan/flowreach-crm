import { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Zap, Mail, Clock, GitBranch, CheckSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const nodeStyles = {
  base: 'px-4 py-3 rounded-lg border-2 bg-card shadow-lg min-w-[200px]',
  trigger: 'border-primary bg-primary/10',
  sms: 'border-success bg-success/10',
  email: 'border-warning bg-warning/10',
  whatsapp: 'border-green-500 bg-green-500/10',
  wait: 'border-muted bg-muted/20',
  condition: 'border-destructive bg-destructive/10',
  task: 'border-blue-500 bg-blue-500/10',
};

export function TriggerNode({ data }: NodeProps) {
  return (
    <div className={`${nodeStyles.base} ${nodeStyles.trigger}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm text-card-foreground">{data.label || 'New Lead (Webhook)'}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Triggers when a new lead arrives</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}



export function EmailNode({ data }: NodeProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className={`${nodeStyles.base} ${nodeStyles.email}`} onDoubleClick={() => setEditing(!editing)}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-warning" />
        <span className="font-semibold text-sm text-card-foreground">{data.label || 'Send Email'}</span>
      </div>
      {editing ? (
        <div className="mt-2 space-y-1">
          <Input
            defaultValue={data.subject || ''}
            onChange={(e) => { data.subject = e.target.value; }}
            placeholder="Email subject..."
            className="text-xs bg-card"
          />
          <Textarea
            defaultValue={data.message || ''}
            onChange={(e) => { data.message = e.target.value; }}
            placeholder="Email body..."
            className="text-xs min-h-[60px] bg-card"
          />
          <p className="text-xs text-muted-foreground">Double-click to toggle edit</p>
        </div>
      ) : (
        <div className="mt-1">
          <p className="text-xs text-muted-foreground max-w-[180px] truncate">
            {data.subject || 'Double-click to set subject & body'}
          </p>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function WaitNode({ data }: NodeProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className={`${nodeStyles.base} ${nodeStyles.wait}`} onDoubleClick={() => setEditing(!editing)}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm text-card-foreground">{data.label || 'Wait'}</span>
      </div>
      {editing ? (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              defaultValue={data.hours || 24}
              onChange={(e) => { data.hours = parseInt(e.target.value) || 24; }}
              className="text-xs w-20 bg-card"
              min={1}
            />
            <span className="text-xs text-muted-foreground">hours</span>
          </div>
          <p className="text-xs text-muted-foreground">Double-click to toggle edit</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">
          Wait {data.hours || 24} hours
        </p>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function ConditionNode({ data }: NodeProps) {
  return (
    <div className={`${nodeStyles.base} ${nodeStyles.condition}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-destructive" />
        <span className="font-semibold text-sm text-card-foreground">{data.label || 'Check Reply'}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Stops workflow if lead replied
      </p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}



export function TaskNode({ data }: NodeProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className={`${nodeStyles.base} ${nodeStyles.task}`} onDoubleClick={() => setEditing(!editing)}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-blue-500" />
        <span className="font-semibold text-sm text-card-foreground">{data.label || 'Create Task'}</span>
      </div>
      {editing ? (
        <div className="mt-2 space-y-1">
          <Input
            defaultValue={data.title || ''}
            onChange={(e) => { data.title = e.target.value; }}
            placeholder="Task title..."
            className="text-xs bg-card"
          />
          <div className="flex items-center gap-1">
            <Input
              type="number"
              defaultValue={data.due_days || 1}
              onChange={(e) => { data.due_days = parseInt(e.target.value) || 1; }}
              className="text-xs w-20 bg-card"
              min={1}
            />
            <span className="text-xs text-muted-foreground">days to due</span>
          </div>
          <p className="text-xs text-muted-foreground">Double-click to toggle edit</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">
          {data.title || 'Creates a call task for sales rep'}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
