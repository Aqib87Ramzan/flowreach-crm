import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface EmailRecord {
  id: string;
  lead_name: string;
  subject: string | null;
  status: string | null;
  created_at: string;
}

export default function SendEmail() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [history, setHistory] = useState<EmailRecord[]>([]);
  const [selectedLead, setSelectedLead] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const modules = useMemo(() => ({
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  }), []);

  useEffect(() => {
    fetchLeads();
    fetchEmailHistory();
  }, []);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('id, name, email, phone')
      .order('created_at', { ascending: false });
    if (data) setLeads(data);
  };

  const fetchEmailHistory = async () => {
    const { data } = await supabase
      .from('messages')
      .select('id, lead_id, subject, status, created_at')
      .eq('message_type', 'email')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      const leadIds = [...new Set(data.map(m => m.lead_id).filter(Boolean))];
      const { data: leadData } = await supabase
        .from('leads')
        .select('id, name')
        .in('id', leadIds);

      const leadMap = new Map(leadData?.map(l => [l.id, l.name]) || []);

      setHistory(data.map(m => ({
        id: m.id,
        lead_name: leadMap.get(m.lead_id || '') || 'Unknown',
        subject: m.subject,
        status: m.status,
        created_at: m.created_at,
      })));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !subject || !body) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    const lead = leads.find(l => l.id === selectedLead)!;
    const personalizedSubject = subject.replace(/\{\{name\}\}/g, lead.name).replace(/\{\{email\}\}/g, lead.email || '');
    const personalizedBody = body.replace(/\{\{name\}\}/g, lead.name).replace(/\{\{email\}\}/g, lead.email || '');

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: lead.email,
          subject: personalizedSubject,
          html: personalizedBody,
          lead_id: lead.id,
        },
      });

      if (error) throw error;

      setSubject('');
      setBody('');
      setSelectedLead('');
      toast.success(`Email sent to ${lead.name}`);
      fetchEmailHistory();
    } catch (err: any) {
      console.error('Email send error:', err);
      toast.error(`Failed to send email: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Send Email</h2>
          <p className="text-muted-foreground">Compose and send emails to your leads</p>
        </div>

        <form onSubmit={handleSend} className="bg-card border rounded-xl p-6 shadow-sm space-y-5 max-w-3xl">
          <div className="space-y-2">
            <Label>Select Lead</Label>
            <Select value={selectedLead} onValueChange={setSelectedLead}>
              <SelectTrigger><SelectValue placeholder="Choose a lead..." /></SelectTrigger>
              <SelectContent>
                {leads.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} — {l.email || 'No email'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Welcome {{name}}!" />
            <p className="text-xs text-muted-foreground">Use {"{{name}}"} or {"{{email}}"} for personalization</p>
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <ReactQuill theme="snow" value={body} onChange={setBody} modules={modules} placeholder="Write your email content..." />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Email'}
          </Button>
        </form>

        <div className="bg-card border rounded-xl shadow-sm">
          <div className="p-6 border-b">
            <h3 className="font-semibold text-card-foreground">Email History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium text-muted-foreground">Lead</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Subject</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Time Sent</th>
                </tr>
              </thead>
              <tbody>
                {history.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium text-card-foreground">{r.lead_name}</td>
                    <td className="p-4 text-muted-foreground">{r.subject || '(no subject)'}</td>
                    <td className="p-4">
                      <Badge variant="secondary" className="bg-primary/10 text-primary">
                        {r.status || 'sent'}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No emails sent yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
