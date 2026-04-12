import { useState, useEffect } from 'react';
import { Search, Send, MessageSquare, Mail, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Message, Conversation } from '@/types/communications';
import { toast } from 'sonner';

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  loading: boolean;
}

export function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  loading,
}: ConversationListProps) {
  const filteredConversations = conversations.filter((conv) =>
    conv.lead_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lead_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-80 border-r bg-card flex flex-col">
      {/* Search Bar */}
      <div className="p-4 border-b space-y-3">
        <h2 className="font-semibold text-foreground">Inbox</h2>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.lead_id}
                onClick={() => onSelectConversation(conversation)}
                className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-accent ${
                  selectedConversation?.lead_id === conversation.lead_id
                    ? 'bg-primary/10 border-primary'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground truncate">
                      {conversation.lead_name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {conversation.last_message}
                    </p>
                  </div>
                  {conversation.unread_count > 0 && (
                    <Badge variant="secondary" className="flex-shrink-0 bg-primary text-primary-foreground">
                      {conversation.unread_count}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(conversation.last_message_time).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface MessageThreadProps {
  conversation: Conversation | null;
  onSendMessage: (data: {
    lead_id: string;
    content: string;
    channel: 'sms' | 'email';
  }) => Promise<void>;
  sending: boolean;
}

export function MessageThread({
  conversation,
  onSendMessage,
  sending,
}: MessageThreadProps) {
  const [messageContent, setMessageContent] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'sms' | 'email'>('sms');

  const handleSend = async () => {
    if (!conversation || !messageContent.trim()) return;

    try {
      await onSendMessage({
        lead_id: conversation.lead_id,
        content: messageContent,
        channel: selectedChannel,
      });
      setMessageContent('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Select a conversation to start messaging</p>
      </div>
    );
  }

  // Determine last channel used
  const lastMessage = conversation.messages[0];
  const lastChannelUsed = lastMessage?.channel || 'sms';

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Thread Header */}
      <div className="border-b bg-card p-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">{conversation.lead_name}</h2>
          <p className="text-sm text-muted-foreground">{conversation.lead_email}</p>
        </div>
        <Button variant="ghost" size="sm">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.messages.length === 0 ? (
          <div className="text-center text-muted-foreground">
            <p>No messages yet. Send the first message to start.</p>
          </div>
        ) : (
          conversation.messages
            .slice()
            .reverse()
            .map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
        )}
      </div>

      {/* Reply Input */}
      <div className="border-t bg-card p-4 space-y-3">
        <div className="flex gap-2">
          <Select value={selectedChannel} onValueChange={(value) => setSelectedChannel(value as 'sms' | 'email')}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sms">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  SMS
                </div>
              </SelectItem>
              <SelectItem value="email">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground self-center">
            {lastMessage && `Last: ${lastChannelUsed.toUpperCase()}`}
          </div>
        </div>

        <Textarea
          placeholder={
            selectedChannel === 'sms'
              ? 'Type SMS message (160 char limit)...'
              : 'Type email message...'
          }
          value={messageContent}
          onChange={(e) => setMessageContent(e.target.value)}
          maxLength={selectedChannel === 'sms' ? 160 : undefined}
          className="min-h-20"
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {selectedChannel === 'sms'
              ? `${messageContent.length}/160 characters`
              : `${messageContent.length} characters`}
          </p>
          <Button
            onClick={handleSend}
            disabled={!messageContent.trim() || sending}
            className="bg-primary hover:bg-primary/90 gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOutbound
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        <div className="space-y-1">
          {message.subject && (
            <p className="text-sm font-semibold">{message.subject}</p>
          )}
          <p className="text-sm break-words">{message.content}</p>
          <div className="flex items-center gap-2 text-xs opacity-70">
            {message.message_type === 'sms' ? (
              <MessageSquare className="w-3 h-3" />
            ) : (
              <Mail className="w-3 h-3" />
            )}
            <span>{new Date(message.created_at).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
