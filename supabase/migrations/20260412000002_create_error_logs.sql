-- Create error_logs table for tracking failed messages
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  channel TEXT NOT NULL, -- 'sms' or 'email'
  error_type TEXT NOT NULL, -- 'send_failed', 'validation_error', 'provider_error'
  error_message TEXT NOT NULL,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 1,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'abandoned'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create alert_logs table for tracking sent admin alerts
CREATE TABLE alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'daily_failures', 'critical_error'
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message_count INT,
  status TEXT DEFAULT 'sent', -- 'sent', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_error_logs_lead_id ON error_logs(lead_id);
CREATE INDEX idx_error_logs_status ON error_logs(status);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_channel ON error_logs(channel);

CREATE INDEX idx_alert_logs_user_id ON alert_logs(user_id);
CREATE INDEX idx_alert_logs_created_at ON alert_logs(created_at DESC);

-- Enable RLS
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for error_logs
CREATE POLICY "Users can view error logs for their executions"
  ON error_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflow_executions, workflows
      WHERE workflow_executions.id = error_logs.workflow_execution_id
      AND workflows.id = workflow_executions.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

-- RLS Policies for alert_logs
CREATE POLICY "Users can view their alert logs"
  ON alert_logs FOR SELECT
  USING (user_id = auth.uid());
