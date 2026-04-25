export interface ErrorLog {
  id: string;
  lead_id: string;
  workflow_execution_id?: string;
  message_id?: string;
  channel: 'email';
  error_type: 'send_failed' | 'validation_error' | 'provider_error';
  error_message: string;
  retry_count: number;
  last_retry_at?: string;
  status: 'pending' | 'resolved' | 'abandoned';
  created_at: string;
  updated_at?: string;
}

export interface AlertLog {
  id: string;
  user_id: string;
  alert_type: 'daily_failures' | 'critical_error';
  recipient_email: string;
  subject: string;
  message_count?: number;
  status: 'sent' | 'failed';
  error_message?: string;
  created_at: string;
}

export interface FailedMessage {
  lead_id: string;
  lead_name: string;
  channel: 'email';
  error_reason: string;
  retry_attempts: number;
  created_at: string;
  error_log_id: string;
}
