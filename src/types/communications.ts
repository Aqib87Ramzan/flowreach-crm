/* Message and Communication Types */

export interface Message {
  id: string;
  lead_id: string;
  workflow_execution_id?: string;
  message_type: 'email';
  direction: 'inbound' | 'outbound';
  channel: 'email';
  content: string;
  sender_id?: string;
  recipient_email?: string;
  recipient_phone?: string;
  subject?: string;
  status: 'sent' | 'delivered' | 'failed' | 'read' | 'received';
  read_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CommunicationLog {
  id: string;
  lead_id: string;
  workflow_execution_id?: string;
  step: 'initial_contact' | 'wait_period' | 'check_reply' | 'follow_up' | 'create_task';
  channel: 'email';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  action_data?: Record<string, any>;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface Task {
  id: string;
  user_id: string;
  lead_id: string;
  workflow_execution_id?: string;
  task_type: 'call' | 'followup' | 'meeting';
  title: string;
  description?: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  assigned_to?: string;
  created_at: string;
  completed_at?: string;
}

export interface Conversation {
  lead_id: string;
  lead_name: string;
  lead_email: string;
  lead_phone: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  messages: Message[];
}

export interface WorkflowStepLog {
  id: string;
  workflow_execution_id: string;
  step_index: number;
  step_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  scheduled_for?: string;
  started_at?: string;
  completed_at?: string;
}
