import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useWebhook() {
  const generateWebhookUrl = useCallback(async (workflowId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return null;
      }

      // Generate a unique webhook URL for this workflow
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-lead/?workflow_id=${workflowId}&user_id=${user.id}`;

      // Save webhook URL to workflow
      const { error } = await supabase
        .from('workflows')
        .update({ webhook_url: webhookUrl })
        .eq('id', workflowId);

      if (error) throw error;

      return webhookUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate webhook URL';
      toast.error(message);
      console.error('Webhook URL generation error:', err);
      return null;
    }
  }, []);

  const testWebhook = useCallback(async (webhookUrl: string) => {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Lead',
          email: 'test@example.com',
          phone: '+1234567890',
          source: 'test',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      toast.success('Test webhook sent successfully');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to test webhook';
      toast.error(message);
      console.error('Webhook test error:', err);
      return null;
    }
  }, []);

  return { generateWebhookUrl, testWebhook };
}
