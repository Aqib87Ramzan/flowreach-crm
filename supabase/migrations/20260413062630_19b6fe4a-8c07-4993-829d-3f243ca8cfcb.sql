
-- Leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'new',
  notes TEXT,
  hashed_lead_id TEXT,
  date_added TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own leads" ON public.leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workflows table
CREATE TABLE public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT false,
  webhook_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own workflows" ON public.workflows FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_execution_id UUID,
  message_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  channel TEXT NOT NULL,
  content TEXT NOT NULL,
  sender_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  subject TEXT,
  status TEXT DEFAULT 'sent',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access messages for own leads" ON public.messages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = messages.lead_id AND leads.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = messages.lead_id AND leads.user_id = auth.uid()));

-- Tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_execution_id UUID,
  task_type TEXT DEFAULT 'call',
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workflow executions table
CREATE TABLE public.workflow_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE NOT NULL,
  trigger_type TEXT DEFAULT 'manual',
  trigger_data JSONB,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own workflow executions" ON public.workflow_executions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.workflows WHERE workflows.id = workflow_executions.workflow_id AND workflows.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workflows WHERE workflows.id = workflow_executions.workflow_id AND workflows.user_id = auth.uid()));

-- Workflow step logs
CREATE TABLE public.workflow_step_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE CASCADE NOT NULL,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.workflow_step_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own step logs" ON public.workflow_step_logs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.workflow_executions we
    JOIN public.workflows w ON w.id = we.workflow_id
    WHERE we.id = workflow_step_logs.workflow_execution_id AND w.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workflow_executions we
    JOIN public.workflows w ON w.id = we.workflow_id
    WHERE we.id = workflow_step_logs.workflow_execution_id AND w.user_id = auth.uid()
  ));

-- Communication logs
CREATE TABLE public.communication_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE SET NULL,
  step TEXT,
  channel TEXT,
  status TEXT DEFAULT 'pending',
  action_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own comm logs" ON public.communication_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = communication_logs.lead_id AND leads.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = communication_logs.lead_id AND leads.user_id = auth.uid()));

-- Error logs
CREATE TABLE public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  channel TEXT,
  error_type TEXT,
  error_message TEXT,
  workflow_execution_id UUID,
  message_id UUID,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own error logs" ON public.error_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = error_logs.lead_id AND leads.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = error_logs.lead_id AND leads.user_id = auth.uid()));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_error_logs_updated_at BEFORE UPDATE ON public.error_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
