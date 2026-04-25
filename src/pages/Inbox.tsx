import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ConversationList, MessageThread } from '@/components/inbox/InboxComponents';
import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message } from '@/types/communications';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

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

  // Auto-poll for new replies every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      checkForReplies(true);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const checkForReplies = async (silent = false) => {
    try {
      setChecking(true);
      const { data, error } = await supabase.functions.invoke('check-inbox');

      if (error) throw error;

      if (data?.success === false) {
        // IMAP error with details — always show these, even on silent polls
        const details = data.details;
        console.error('IMAP check failed:', data.error, details);
        if (details) {
          toast.error(
            `IMAP Error: ${data.error}\n\nHost tried: ${details.imapHost}:${details.imapPort}\nUser: ${details.username}\n\n${details.hint}`,
            { duration: 12000 }
          );
        } else {
          toast.error(data.error || 'Failed to check inbox', { duration: 8000 });
        }
        return;
      }

      if (data?.newMessages > 0) {
        toast.success(`${data.newMessages} new replies imported!`);
        await loadConversations();
      } else if (!silent) {
        const debugInfo = data?.debug ? ` (IMAP: ${data.debug.imapHost}:${data.debug.imapPort})` : '';
        toast.info(`No new replies found${debugInfo}`);
      }
    } catch (error) {
      if (!silent) {
        const msg = error instanceof Error ? error.message : 'Failed to check for replies';
        toast.error(msg);
      }
      console.error('Check replies error:', error);
    } finally {
      setChecking(false);
    }
  };

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
        .neq('message_type', 'task')
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
          last_message: (lastMessage?.content || 'No messages').replace(/<[^>]*>?/gm, ''),
          last_message_time: lastMessage?.created_at || lead.date_added,
          unread_count: leadMessages.filter(
            (m) => m.direction === 'inbound' && m.status !== 'read'
          ).length,
          messages: leadMessages as any as Message[],
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
    channel: 'email';
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

      if (leadError || !lead) throw leadError || new Error('Lead not found');



      // Call appropriate sending function
      await supabase.functions.invoke('send-email', {
        body: {
          to: lead!.email,
          subject: 'Message from FlowReach',
          html: `<p>${data.content}</p>`,
          lead_id: data.lead_id,
        },
      });

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
        <div className="flex-1 flex flex-col gap-0 rounded-lg overflow-hidden border bg-card">
        {/* Check Replies Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
          <h2 className="text-sm font-semibold text-foreground">Inbox</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkForReplies(false)}
            disabled={checking}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : 'Check Replies'}
          </Button>
        </div>
        <div className="flex-1 flex gap-0 overflow-hidden">
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
      </div>
    </DashboardLayout>
  );
}
