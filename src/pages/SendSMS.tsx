import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getLeads, getSMSHistory, addSMS } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function SendSMS() {
  const leads = getLeads();
  const [history, setHistory] = useState(getSMSHistory());
  const [selectedLead, setSelectedLead] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !message) {
      toast.error('Please select a lead and type a message');
      return;
    }
    setLoading(true);
    const lead = leads.find(l => l.id === selectedLead)!;
    const finalMessage = message.replace(/\{\{name\}\}/g, lead.name);

    await new Promise(r => setTimeout(r, 1000));
    addSMS({
      leadName: lead.name,
      message: finalMessage,
      status: 'Sent',
      timeSent: new Date().toLocaleString(),
    });
    setHistory(getSMSHistory());
    setMessage('');
    setSelectedLead('');
    setLoading(false);
    toast.success(`SMS sent to ${lead.name}`);
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
                {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name} — {l.phone}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Hi {{name}}, ..." rows={4} />
            <p className="text-xs text-muted-foreground">Use {"{{name}}"} for personalization</p>
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
                    <td className="p-4 font-medium text-card-foreground">{r.leadName}</td>
                    <td className="p-4 text-muted-foreground max-w-xs truncate">{r.message}</td>
                    <td className="p-4"><Badge variant="secondary" className="bg-success/10 text-success">{r.status}</Badge></td>
                    <td className="p-4 text-muted-foreground">{r.timeSent}</td>
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
