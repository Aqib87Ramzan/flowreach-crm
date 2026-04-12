import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ConversationList, MessageThread } from '@/components/inbox/InboxComponents';
import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message } from '@/types/communications';
import { toast } from 'sonner';

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadConversations();

    // Subscribe to real-time message updates
    const subscription = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all leads for this user's workflows
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('date_added', { ascending: false });

      if (leadsError) throw leadsError;

      // Get all messages grouped by lead
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Build conversations
      const conversationMap = new Map<string, Conversation>();

      leads?.forEach((lead) => {
        const leadMessages = messages?.filter((m) => m.lead_id === lead.id) || [];
        const lastMessage = leadMessages[0];

        conversationMap.set(lead.id, {
          lead_id: lead.id,
          lead_name: lead.name,
          lead_email: lead.email,
          lead_phone: lead.phone,
          last_message: lastMessage?.content || 'No messages',
          last_message_time: lastMessage?.created_at || lead.date_added,
          unread_count: leadMessages.filter(
            (m) => m.direction === 'inbound' && m.status !== 'read'
          ).length,
          messages: leadMessages,
        });
      });

      const convArray = Array.from(conversationMap.values());
      setConversations(convArray);

      // Pre-select first conversation if none selected
      if (!selectedConversation && convArray.length > 0) {
        setSelectedConversation(convArray[0]);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (data: {
    lead_id: string;
    content: string;
    channel: 'sms' | 'email';
  }) => {
    if (!selectedConversation) return;

    try {
      setSending(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get lead details
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', data.lead_id)
        .single();

      if (leadError) throw leadError;

      // Create message record
      const { error: messageError } = await supabase.from('messages').insert([
        {
          lead_id: data.lead_id,
          message_type: data.channel,
          direction: 'outbound',
          channel: data.channel,
          content: data.content,
          sender_id: user.id,
          recipient_email: data.channel === 'email' ? lead.email : undefined,
          recipient_phone: data.channel === 'sms' ? lead.phone : undefined,
          status: 'sent',
        },
      ]);

      if (messageError) throw messageError;

      // Call appropriate sending function
      if (data.channel === 'sms') {
        await supabase.functions.invoke('send-sms', {
          body: {
            phone: lead.phone,
            message: data.content,
            lead_id: data.lead_id,
          },
        });
      } else if (data.channel === 'email') {
        await supabase.functions.invoke('send-email', {
          body: {
            to: lead.email,
            subject: 'Message from FlowReach',
            html: `<p>${data.content}</p>`,
            lead_id: data.lead_id,
          },
        });
      }

      toast.success(`${data.channel.toUpperCase()} sent successfully`);
      await loadConversations();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message';
      toast.error(message);
      console.error('Send message error:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col">
        <div className="flex-1 flex gap-0 rounded-lg overflow-hidden border bg-card">
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            loading={loading}
          />
          <MessageThread
            conversation={selectedConversation}
            onSendMessage={handleSendMessage}
            sending={sending}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
