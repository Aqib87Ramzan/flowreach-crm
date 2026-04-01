import { Users, MessageSquare, Mail, Megaphone } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import StatCard from '@/components/StatCard';
import { getLeads, getSMSHistory, getEmailHistory } from '@/lib/mockData';
import { Badge } from '@/components/ui/badge';

const statusColor: Record<string, string> = {
  New: 'bg-primary/10 text-primary',
  Contacted: 'bg-warning/10 text-warning',
  Replied: 'bg-success/10 text-success',
  Converted: 'bg-muted text-muted-foreground',
};

export default function Dashboard() {
  const leads = getLeads();
  const sms = getSMSHistory();
  const emails = getEmailHistory();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">Welcome back to FlowReach</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Leads" value={leads.length} icon={Users} />
          <StatCard title="SMS Sent" value={sms.length} icon={MessageSquare} color="bg-success" />
          <StatCard title="Emails Sent" value={emails.length} icon={Mail} color="bg-warning" />
          <StatCard title="Active Campaigns" value={2} icon={Megaphone} color="bg-destructive" />
        </div>

        <div className="bg-card border rounded-xl shadow-sm">
          <div className="p-6 border-b">
            <h3 className="font-semibold text-card-foreground">Recent Leads</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Phone</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Date Added</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 5).map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium text-card-foreground">{lead.name}</td>
                    <td className="p-4 text-muted-foreground">{lead.email}</td>
                    <td className="p-4 text-muted-foreground">{lead.phone}</td>
                    <td className="p-4">
                      <Badge variant="secondary" className={statusColor[lead.status]}>
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">{lead.dateAdded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
