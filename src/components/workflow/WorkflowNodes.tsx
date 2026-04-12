import { Handle, Position } from 'reactflow';
import { Zap, MessageSquare, Mail, Clock, GitBranch, CheckSquare } from 'lucide-react';

interface NodeProp {
  data: {
    label: string;
  };
}

const nodeStyles = {
  base: 'px-4 py-2 rounded-lg border-2 bg-card shadow-lg',
  trigger: 'border-primary bg-primary/10',
  sms: 'border-success bg-success/10',
  email: 'border-warning bg-warning/10',
  wait: 'border-muted bg-muted/20',
  condition: 'border-destructive bg-destructive/10',
  task: 'border-blue-500 bg-blue-500/10',
};

export function TriggerNode({ data }: NodeProp) {
  return (
    <div className={`${nodeStyles.base} ${nodeStyles.trigger}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm text-card-foreground">{data.label || 'Trigger'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function SMSNode({ data }: NodeProp) {
  return (
    <div className={`${nodeStyles.base} ${nodeStyles.sms}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-success" />
        <span className="font-semibold text-sm text-card-foreground">{data.label || 'Send SMS'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function EmailNode({ data }: NodeProp) {
  return (
    <div className={`${nodeStyles.base} ${nodeStyles.email}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-warning" />
        <span className="font-semibold text-sm text-card-foreground">{data.label || 'Send Email'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function WaitNode({ data }: NodeProp) {
  return (
    <div className={`${nodeStyles.base} ${nodeStyles.wait}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm text-card-foreground">{data.label || 'Wait'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function ConditionNode({ data }: NodeProp) {
  return (
    <div className={`${nodeStyles.base} ${nodeStyles.condition}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-destructive" />
        <span className="font-semibold text-sm text-card-foreground">{data.label || 'Condition'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function TaskNode({ data }: NodeProp) {
  return (
    <div className={`${nodeStyles.base} ${nodeStyles.task}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-blue-500" />
        <span className="font-semibold text-sm text-card-foreground">{data.label || 'Task'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
