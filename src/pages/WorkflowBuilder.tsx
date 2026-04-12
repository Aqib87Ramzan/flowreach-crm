import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Node, Edge } from 'reactflow';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Workflow } from '@/types/workflow';
import { toast } from 'sonner';

export default function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);

  // Load existing workflow if editing
  useEffect(() => {
    if (id) {
      loadWorkflow(id);
    }
  }, [id]);

  const loadWorkflow = async (workflowId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: err } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (err) throw err;
      
      setWorkflow(data);
      setName(data.name);
      setDescription(data.description || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
      toast.error('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (nodes: Node[], edges: Edge[]) => {
    try {
      if (!name.trim()) {
        toast.error('Workflow name is required');
        return;
      }

      if (nodes.length === 0) {
        toast.error('Workflow must have at least one node');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }

      const workflowData = {
        user_id: user.id,
        name,
        description,
        nodes,
        edges,
        is_active: workflow?.is_active || false,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (workflow?.id) {
        // Update existing
        const { error: err } = await supabase
          .from('workflows')
          .update(workflowData)
          .eq('id', workflow.id);
        
        if (err) throw err;
        result = workflow.id;
      } else {
        // Create new
        const { data, error: err } = await supabase
          .from('workflows')
          .insert([workflowData])
          .select('id')
          .single();
        
        if (err) throw err;
        result = data.id;
      }

      toast.success(workflow?.id ? 'Workflow updated!' : 'Workflow created!');
      navigate('/workflows');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save workflow';
      setError(message);
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-muted-foreground">Loading workflow...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/workflows')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {workflow ? 'Edit Workflow' : 'Create Workflow'}
              </h1>
              <p className="text-muted-foreground">
                {workflow ? 'Modify your workflow' : 'Build your first automation workflow'}
              </p>
            </div>
          </div>
        </div>

        {/* Workflow Details */}
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Workflow Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Welcome New Leads"
              className="mt-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              className="mt-2 min-h-20"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 min-h-[500px] bg-card border rounded-lg overflow-hidden">
          <WorkflowCanvas workflow={workflow || undefined} onSave={handleSave} />
        </div>
      </div>
    </DashboardLayout>
  );
}
