import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Copy, CheckCircle2, Circle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Workflow } from '@/types/workflow';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Workflows() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkflows((data || []) as any as Workflow[]);
    } catch (err) {
      console.error('Failed to load workflows:', err);
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('workflows').delete().eq('id', id);
      if (error) throw error;

      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      setDeleteId(null);
      toast.success('Workflow deleted');
    } catch (err) {
      console.error('Failed to delete workflow:', err);
      toast.error('Failed to delete workflow');
    }
  };

  const handleToggleActive = async (workflow: Workflow) => {
    try {
      // Deactivate all other workflows for this user
      if (!workflow.is_active) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('workflows')
            .update({ is_active: false })
            .eq('user_id', user.id)
            .neq('id', workflow.id);
        }
      }

      const { error } = await supabase
        .from('workflows')
        .update({ is_active: !workflow.is_active })
        .eq('id', workflow.id);

      if (error) throw error;

      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflow.id
            ? { ...w, is_active: !w.is_active }
            : { ...w, is_active: false }
        )
      );

      toast.success(
        !workflow.is_active ? 'Workflow activated' : 'Workflow deactivated'
      );
    } catch (err) {
      console.error('Failed to update workflow:', err);
      toast.error('Failed to update workflow');
    }
  };

  const copyWebhookUrl = (webhookUrl?: string) => {
    if (!webhookUrl) {
      toast.error('Webhook URL not available');
      return;
    }
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading workflows...</p>
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
            <h1 className="text-3xl font-bold text-foreground">Workflows</h1>
            <p className="text-muted-foreground">
              Manage your automation workflows
            </p>
          </div>
          <Button
            onClick={() => navigate('/workflow-builder')}
            className="bg-primary hover:bg-primary/90 gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </Button>
        </div>

        {/* Workflows List */}
        {workflows.length === 0 ? (
          <div className="bg-card border rounded-lg p-12 text-center">
            <p className="text-muted-foreground mb-4">No workflows yet</p>
            <Button
              onClick={() => navigate('/workflow-builder')}
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Your First Workflow
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-card border rounded-lg p-6 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {workflow.name}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(workflow)}
                        className="gap-2"
                      >
                        {workflow.is_active ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-success" />
                            <span className="text-xs text-success">Active</span>
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              Inactive
                            </span>
                          </>
                        )}
                      </Button>
                    </div>

                    {workflow.description && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {workflow.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {workflow.nodes?.length || 0} nodes
                      </span>
                      <span>/</span>
                      <span>
                        Created {new Date(workflow.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {workflow.webhook_url && (
                      <div className="mt-3 p-2 bg-muted/50 rounded text-xs font-mono text-foreground">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{workflow.webhook_url}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyWebhookUrl(workflow.webhook_url)}
                            className="gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/workflow-builder/${workflow.id}`)}
                      className="gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(workflow.id)}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workflow? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
