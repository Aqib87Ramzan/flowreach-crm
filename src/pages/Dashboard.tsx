import { useState, useEffect } from 'react';
import {
  Users,
  MessageSquare,
  Mail,
  Megaphone,
  Copy,
  Zap,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useWebhook } from '@/hooks/use-webhook';
import { errorHandlingService } from '@/services/ErrorHandlingService';
import { FailedMessage } from '@/types/errors';
import { toast } from 'sonner';
import { Workflow } from '@/types/workflow';

const statusColor: Record<string, string> = {
  New: 'bg-primary/10 text-primary',
  Contacted: 'bg-warning/10 text-warning',
  Replied: 'bg-success/10 text-success',
  Converted: 'bg-muted text-muted-foreground',
};

interface DashboardLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  date_added: string;
}

interface DashboardTask {
  id: string;
  title: string;
  status: string | null;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { testWebhook } = useWebhook();

  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeWorkflows: 0,
    failedMessages: 0,
    pendingTasks: 0,
    totalConversations: 0,
    smsSent: 0,
    emailsSent: 0,
  });
  const [failedMessages, setFailedMessages] = useState<FailedMessage[]>([]);
  const [recentTasks, setRecentTasks] = useState<DashboardTask[]>([]);
  const [recentLeads, setRecentLeads] = useState<DashboardLead[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // All queries in parallel
      const [
        workflowRes,
        leadsCountRes,
        activeCountRes,
        tasksCountRes,
        smsCountRes,
        emailCountRes,
        uniqueLeadsRes,
        recentLeadsRes,
        tasksRes,
      ] = await Promise.all([
        supabase.from('workflows').select('*').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('workflows').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('message_type', 'sms').eq('direction', 'outbound'),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('message_type', 'email').eq('direction', 'outbound'),
        supabase.from('messages').select('lead_id').neq('lead_id', null as any),
        supabase.from('leads').select('id, name, email, phone, status, date_added').eq('user_id', user.id).order('date_added', { ascending: false }).limit(5),
        supabase.from('tasks').select('id, title, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ]);

      if (workflowRes.data) {
        setActiveWorkflow(workflowRes.data as any as Workflow);
      }

      const uniqueLeadCount = uniqueLeadsRes.data
        ? new Set(uniqueLeadsRes.data.map((m: any) => m.lead_id)).size
        : 0;

      const failedCount = await errorHandlingService.getFailedMessagesCount();

      setStats({
        totalLeads: leadsCountRes.count || 0,
        activeWorkflows: activeCountRes.count || 0,
        failedMessages: failedCount,
        pendingTasks: tasksCountRes.count || 0,
        totalConversations: uniqueLeadCount,
        smsSent: smsCountRes.count || 0,
        emailsSent: emailCountRes.count || 0,
      });

      setRecentLeads(recentLeadsRes.data || []);
      setRecentTasks(tasksRes.data || []);

      const failed = await errorHandlingService.getFailedMessagesForDay(1);
      setFailedMessages(failed.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleCopyWebhook = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Webhook URL copied to clipboard');
  };

  const handleTestWebhook = async () => {
    if (!activeWorkflow?.webhook_url) return;
    setTesting(true);
    try {
      await testWebhook(activeWorkflow.webhook_url);
    } finally {
      setTesting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">Welcome back to FlowReach</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Leads" value={stats.totalLeads} icon={Users} />
          <StatCard title="Active Workflows" value={stats.activeWorkflows} icon={Zap} color="bg-primary" />
          <StatCard title="Failed Messages" value={stats.failedMessages} icon={AlertCircle} color="bg-destructive" />
          <StatCard title="Pending Tasks" value={stats.pendingTasks} icon={CheckCircle2} color="bg-warning" />
          <StatCard title="Conversations" value={stats.totalConversations} icon={MessageCircle} color="bg-success" />
          <StatCard title="SMS Sent" value={stats.smsSent} icon={MessageSquare} color="bg-info" />
          <StatCard title="Emails Sent" value={stats.emailsSent} icon={Mail} color="bg-info" />
        </div>

        {/* Webhook Integration Section */}
        {activeWorkflow?.webhook_url && (
          <div className="bg-card border rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-card-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Webhook Lead Capture
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Active workflow: <span className="font-medium">{activeWorkflow.name}</span>
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm text-foreground break-all">
              {activeWorkflow.webhook_url}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleCopyWebhook(activeWorkflow.webhook_url!)} className="gap-2">
                <Copy className="w-4 h-4" /> Copy URL
              </Button>
              <Button variant="outline" size="sm" onClick={handleTestWebhook} disabled={testing} className="gap-2">
                {testing ? 'Testing...' : 'Test Webhook'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/workflows')} className="gap-2">
                Manage Workflows
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Use this URL to capture leads from external sources. POST lead data with: name, email, phone, source.
            </p>
          </div>
        )}

        {/* Recent Failed Messages */}
        {failedMessages.length > 0 && (
          <div className="bg-card border rounded-xl shadow-sm">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="font-semibold text-card-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                Recent Failed Messages
              </h3>
              <Button variant="outline" size="sm" onClick={() => navigate('/inbox')}>View All</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium text-muted-foreground">Lead Name</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Channel</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Error Reason</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Retries</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {failedMessages.map((message) => (
                    <tr key={message.error_log_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium text-card-foreground">{message.lead_name}</td>
                      <td className="p-4"><Badge variant="outline" className="uppercase">{message.channel}</Badge></td>
                      <td className="p-4 text-destructive text-xs">{message.error_reason}</td>
                      <td className="p-4 text-muted-foreground">{message.retry_attempts}/1</td>
                      <td className="p-4 text-muted-foreground">{new Date(message.created_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Tasks */}
        {recentTasks.length > 0 && (
          <div className="bg-card border rounded-xl shadow-sm">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="font-semibold text-card-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-warning" />
                Recent Call Tasks
              </h3>
              <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>View All</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium text-muted-foreground">Title</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map((task) => (
                    <tr key={task.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium text-card-foreground">{task.title}</td>
                      <td className="p-4">
                        <Badge variant="secondary" className={task.status === 'completed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                          {task.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">{new Date(task.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No Active Workflow */}
        {!activeWorkflow && (
          <div className="bg-card border border-dashed rounded-xl shadow-sm p-6 text-center space-y-3">
            <div className="flex justify-center">
              <Zap className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground">No Active Workflow</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create and activate a workflow to enable webhook lead capture
              </p>
            </div>
            <Button onClick={() => navigate('/workflow-builder')} className="bg-primary hover:bg-primary/90 gap-2">
              <Zap className="w-4 h-4" /> Create Workflow
            </Button>
          </div>
        )}

        {/* Recent Leads */}
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="p-6 border-b">
            <h3 className="font-semibold text-card-foreground">Recent Leads</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Phone</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Date Added</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No leads yet</td></tr>
                ) : (
                  recentLeads.map((lead) => (
                    <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium text-card-foreground">{lead.name}</td>
                      <td className="p-4 text-muted-foreground">{lead.email || '-'}</td>
                      <td className="p-4 text-muted-foreground">{lead.phone || '-'}</td>
                      <td className="p-4">
                        <Badge variant="secondary" className={statusColor[lead.status || 'New']}>
                          {lead.status || 'New'}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">{new Date(lead.date_added).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
