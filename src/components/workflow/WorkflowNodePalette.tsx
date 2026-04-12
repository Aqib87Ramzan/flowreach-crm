import { Zap, MessageSquare, Mail, Clock, GitBranch, CheckSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';

const nodes = [
  {
    type: 'trigger',
    label: 'Trigger',
    description: 'Webhook lead',
    icon: Zap,
    color: 'text-primary',
  },
  {
    type: 'sms',
    label: 'Send SMS',
    description: 'Send a text',
    icon: MessageSquare,
    color: 'text-success',
  },
  {
    type: 'email',
    label: 'Send Email',
    description: 'Send an email',
    icon: Mail,
    color: 'text-warning',
  },
  {
    type: 'wait',
    label: 'Wait',
    description: 'Delay workflow',
    icon: Clock,
    color: 'text-muted-foreground',
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'If/Then branch',
    icon: GitBranch,
    color: 'text-destructive',
  },
  {
    type: 'task',
    label: 'Task',
    description: 'Custom task',
    icon: CheckSquare,
    color: 'text-blue-500',
  },
];

export function WorkflowNodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/reactflow', nodeType);
  };

  return (
    <div className="space-y-2">
      {nodes.map((node) => {
        const Icon = node.icon;
        return (
          <Card
            key={node.type}
            draggable
            onDragStart={(e) => onDragStart(e, node.type)}
            className="p-3 cursor-move hover:bg-accent transition-colors border"
          >
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${node.color}`} />
              <div>
                <p className="text-sm font-medium text-foreground">{node.label}</p>
                <p className="text-xs text-muted-foreground">{node.description}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
