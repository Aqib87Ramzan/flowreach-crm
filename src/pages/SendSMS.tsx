import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface SMSRecord {
  id: string;
  lead_name: string;
  content: string;
  status: string | null;
  created_at: string;
}

export default function SendSMS() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [history, setHistory] = useState<SMSRecord[]>([]);
  const [selectedLead, setSelectedLead] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLeads();
    fetchSMSHistory();
  }, []);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, email')
      .order('created_at', { ascending: false });
    if (data) setLeads(data);
  };

  const fetchSMSHistory = async () => {
    const { data } = await supabase
      .from('messages')
      .select('id, lead_id, content, status, created_at')
      .eq('message_type', 'sms')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      // Get lead names for each message
      const leadIds = [...new Set(data.map(m => m.lead_id).filter(Boolean))];
      const { data: leadData } = await supabase
        .from('leads')
        .select('id, name')
        .in('id', leadIds);

      const leadMap = new Map(leadData?.map(l => [l.id, l.name]) || []);

      setHistory(data.map(m => ({
        id: m.id,
        lead_name: leadMap.get(m.lead_id || '') || 'Unknown',
        content: m.content,
        status: m.status,
        created_at: m.created_at,
      })));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !message) {
      toast.error('Please select a lead and type a message');
      return;
    }
    setLoading(true);

    try {
      const lead = leads.find(l => l.id === selectedLead)!;
      const finalMessage = message.replace(/\{\{name\}\}/g, lead.name);

      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          phone: lead.phone,
          message: finalMessage,
          lead_id: lead.id,
        },
      });

      if (error) throw error;

      setMessage('');
      setSelectedLead('');
      toast.success(`SMS sent to ${lead.name}`);
      fetchSMSHistory();
    } catch (error) {
      console.error('SMS send error:', error);
      toast.error('Failed to send SMS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Send SMS</h2>
          <p className="text-muted-foreground">Send personalized SMS messages to your leads</p>
        </div>

        <form onSubmit={handleSend} className="bg-card border rounded-xl p-6 shadow-sm space-y-5 max-w-2xl">
          <div className="space-y-2">
            <Label>Select Lead</Label>
            <Select value={selectedLead} onValueChange={setSelectedLead}>
              <SelectTrigger><SelectValue placeholder="Choose a lead..." /></SelectTrigger>
              <SelectContent>
                {leads.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} — {l.phone || 'No phone'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Hi {{name}}, ..." rows={4} maxLength={160} />
            <p className="text-xs text-muted-foreground">{message.length}/160 characters. Use {"{{name}}"} for personalization</p>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send SMS'}
          </Button>
        </form>

        <div className="bg-card border rounded-xl shadow-sm">
          <div className="p-6 border-b">
            <h3 className="font-semibold text-card-foreground">SMS History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium text-muted-foreground">Lead</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Message</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Time Sent</th>
                </tr>
              </thead>
              <tbody>
                {history.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium text-card-foreground">{r.lead_name}</td>
                    <td className="p-4 text-muted-foreground max-w-xs truncate">{r.content}</td>
                    <td className="p-4">
                      <Badge variant="secondary" className="bg-primary/10 text-primary">
                        {r.status || 'sent'}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No SMS sent yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
