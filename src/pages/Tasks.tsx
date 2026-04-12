import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Phone, Plus, Edit2, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Task, Message } from '@/types/communications';
import { toast } from 'sonner';

interface TaskWithMessages extends Task {
  lead?: {
    name: string;
    phone: string;
    email: string;
  };
  messages: Message[];
}

export default function Tasks() {
  const [tasks, setTasks] = useState<TaskWithMessages[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskWithMessages[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [selectedTask, setSelectedTask] = useState<TaskWithMessages | null>(null);
  const [notes, setNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    filterTasks();
  }, [tasks, statusFilter]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch messages for each task
      const tasksWithMessages = await Promise.all(
        (tasksData || []).map(async (task) => {
          const { data: leadData } = await supabase
            .from('leads')
            .select('name, phone, email')
            .eq('id', task.lead_id)
            .single();

          const { data: messagesData } = await supabase
            .from('messages')
            .select('*')
            .eq('lead_id', task.lead_id)
            .order('created_at', { ascending: false });

          return {
            ...task,
            lead: leadData,
            messages: messagesData || [],
          };
        })
      );

      setTasks(tasksWithMessages);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    let filtered = tasks;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }

    const sorted = filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setFilteredTasks(sorted);
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      setCompleting(true);

      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Task marked as complete');
      await loadTasks();
      setSelectedTask(null);
      setNotes('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete task';
      toast.error(message);
      console.error('Error completing task:', error);
    } finally {
      setCompleting(false);
    }
  };

  const handleAddNotes = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          description: notes,
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Notes updated');
      await loadTasks();
      setNotes('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add notes';
      toast.error(message);
      console.error('Error adding notes:', error);
    }
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-primary/10 text-primary',
    completed: 'bg-success/10 text-success',
    in_progress: 'bg-warning/10 text-warning',
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading tasks...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Call Tasks</h1>
            <p className="text-muted-foreground">
              Manage follow-up calls for leads
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tasks Grid */}
        {filteredTasks.length === 0 ? (
          <div className="bg-card border rounded-lg p-12 text-center">
            <p className="text-muted-foreground mb-4">
              {statusFilter === 'completed'
                ? 'No completed tasks yet'
                : 'No pending tasks'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="bg-card border rounded-lg p-6 space-y-4 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => setSelectedTask(task)}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">
                      {task.lead?.name || 'Unknown Lead'}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <Phone className="w-4 h-4" />
                      {task.lead?.phone || 'No phone'}
                    </p>
                  </div>
                  <Badge className={statusColor[task.status]}>
                    {task.status === 'completed' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Completed
                      </>
                    ) : (
                      <>
                        <Circle className="w-3 h-3 mr-1" />
                        Pending
                      </>
                    )}
                  </Badge>
                </div>

                {/* Task Info */}
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Created:</span>{' '}
                    {new Date(task.created_at).toLocaleDateString()}
                  </p>
                  {task.due_date && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Due:</span>{' '}
                      {new Date(task.due_date).toLocaleDateString()}
                    </p>
                  )}
                  {task.description && (
                    <p className="text-foreground bg-muted/30 p-2 rounded">
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Recent Messages Preview */}
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Recent Conversation ({task.messages.length})
                  </p>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {task.messages.slice(0, 2).map((msg) => (
                      <p key={msg.id} className="text-xs text-muted-foreground truncate">
                        <span className="font-medium">{msg.direction === 'outbound' ? 'You:' : 'Lead:'}</span> {msg.content}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                {task.status === 'pending' && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCompleteTask(task.id);
                    }}
                    disabled={completing}
                    className="w-full bg-success hover:bg-success/90 text-white"
                  >
                    {completing ? 'Completing...' : 'Mark Complete'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Detail View Modal */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">
                  {selectedTask.lead?.name}
                </h2>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-sm bg-muted/30 p-4 rounded">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Phone:</span>{' '}
                  {selectedTask.lead?.phone}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Email:</span>{' '}
                  {selectedTask.lead?.email}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Status:</span>{' '}
                  <Badge className={statusColor[selectedTask.status]}>
                    {selectedTask.status}
                  </Badge>
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Created:</span>{' '}
                  {new Date(selectedTask.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Full Message Thread */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Message History ({selectedTask.messages.length})
                </p>
                <div className="bg-muted/20 p-4 rounded space-y-2 max-h-64 overflow-y-auto">
                  {selectedTask.messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No messages</p>
                  ) : (
                    selectedTask.messages.map((msg) => (
                      <div key={msg.id} className="text-xs bg-muted/30 p-2 rounded">
                        <p className="font-medium text-foreground">
                          {msg.direction === 'outbound' ? 'You' : 'Lead'} ({msg.channel.toUpperCase()})
                        </p>
                        <p className="text-muted-foreground mt-1">{msg.content}</p>
                        <p className="text-muted-foreground/70 mt-1">
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Notes Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Call Notes</label>
                <Textarea
                  value={selectedTask.status === 'pending' ? notes : selectedTask.description || ''}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about the call..."
                  disabled={selectedTask.status === 'completed'}
                  className="min-h-24"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setSelectedTask(null)}
                >
                  Close
                </Button>
                {selectedTask.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleAddNotes(selectedTask.id)}
                      disabled={completing}
                    >
                      Save Notes
                    </Button>
                    <Button
                      onClick={() => handleCompleteTask(selectedTask.id)}
                      disabled={completing}
                      className="bg-success hover:bg-success/90 text-white ml-auto"
                    >
                      {completing ? 'Completing...' : 'Mark Complete'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
