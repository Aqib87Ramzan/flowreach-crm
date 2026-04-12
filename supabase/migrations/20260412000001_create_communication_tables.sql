-- Create messages table (SMS and Email)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL, -- 'sms' or 'email'
  direction TEXT NOT NULL, -- 'inbound' or 'outbound'
  channel TEXT, -- 'sms', 'email'
  content TEXT NOT NULL,
  sender_id UUID REFERENCES auth.users(id),
  recipient_email TEXT,
  recipient_phone TEXT,
  subject TEXT, -- for emails
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'read'
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT messages_lead_fk FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Create communication logs table
CREATE TABLE communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
  step TEXT NOT NULL, -- 'initial_contact', 'wait_period', 'check_reply', 'follow_up', 'create_task'
  channel TEXT, -- 'sms', 'email'
  status TEXT NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
  action_data JSONB, -- stores data about the action taken
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create tasks table (for sales rep call tasks)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL, -- 'call', 'followup', 'meeting'
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create workflow steps tracking table
CREATE TABLE workflow_step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  step_type TEXT NOT NULL, -- 'trigger', 'sms', 'email', 'wait', 'condition', 'task'
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX idx_messages_lead_id ON messages(lead_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_workflow_execution ON messages(workflow_execution_id);
CREATE INDEX idx_messages_direction ON messages(direction);

CREATE INDEX idx_communication_logs_lead_id ON communication_logs(lead_id);
CREATE INDEX idx_communication_logs_workflow_execution ON communication_logs(workflow_execution_id);
CREATE INDEX idx_communication_logs_created_at ON communication_logs(created_at DESC);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_workflow_execution ON tasks(workflow_execution_id);

CREATE INDEX idx_workflow_step_logs_execution ON workflow_step_logs(workflow_execution_id);
CREATE INDEX idx_workflow_step_logs_status ON workflow_step_logs(status);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages (view conversations)
CREATE POLICY "Users can view messages for their workflows"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflow_executions, workflows
      WHERE workflow_executions.id = messages.workflow_execution_id
      AND workflows.id = workflow_executions.workflow_id
      AND workflows.user_id = auth.uid()
    )
    OR sender_id = auth.uid()
  );

-- RLS Policies for communication logs
CREATE POLICY "Users can view their communication logs"
  ON communication_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflow_executions, workflows
      WHERE workflow_executions.id = communication_logs.workflow_execution_id
      AND workflows.id = workflow_executions.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

-- RLS Policies for tasks
CREATE POLICY "Users can view their tasks"
  ON tasks FOR SELECT
  USING (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Users can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for workflow step logs
CREATE POLICY "Users can view their workflow step logs"
  ON workflow_step_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflow_executions, workflows
      WHERE workflow_executions.id = workflow_step_logs.workflow_execution_id
      AND workflows.id = workflow_executions.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

-- Trigger for updating messages.updated_at
CREATE OR REPLACE FUNCTION update_messages_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_messages_updated_at_column();
