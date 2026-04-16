import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { format, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Plus, UserCircle, ArrowRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Appointment {
  id: string;
  title: string;
  date: string;
  time: string;
  status: string;
  leads: { name: string; email: string; } | null;
}

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', lead_id: '', time: '10:00' });

  useEffect(() => {
    fetchAppointmentsAndLeads();
  }, []);

  const fetchAppointmentsAndLeads = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: appData, error: appError } = await supabase
        .from('appointments')
        .select('*, leads(name, email)')
        .eq('user_id', session.user.id)
        .order('date', { ascending: true })
        .order('time', { ascending: true });
        
      if (!appError && appData) {
        setAppointments(appData as any);
      }

      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, name')
        .eq('user_id', session.user.id)
        .order('name');
        
      if (leadsData) setLeads(leadsData);
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Appointment cancelled');
      await fetchAppointmentsAndLeads();
    } catch (e) {
      toast.error('Failed to cancel appointment');
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast.error('Please select a date on the calendar first');
      return;
    }
    if (!form.title || !form.time || !form.lead_id) {
      toast.error('Please fill out all fields');
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Extract raw YYYY-MM-DD from the selected Date object
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      // Ensure time has seconds for Postgres TIME type
      const formattedTime = form.time.includes(':') && form.time.length === 5 
        ? `${form.time}:00` 
        : form.time;

      const { error } = await supabase.from('appointments').insert([{
        user_id: session.user.id,
        lead_id: form.lead_id,
        title: form.title,
        date: formattedDate,
        time: formattedTime,
        status: 'scheduled'
      }]);

      if (error) throw error;

      // Increment Lead Score automatically
      if (form.lead_id) {
        const { data: leadData } = await supabase.from('leads').select('score').eq('id', form.lead_id).single();
        if (leadData) {
          const newScore = (leadData.score || 0) + 50;
          await supabase.from('leads').update({ score: newScore }).eq('id', form.lead_id);
        }
      }

      toast.success('Appointment scheduled and Lead Score increased!');
      setOpen(false);
      setForm({ title: '', lead_id: '', time: '10:00' });
      await fetchAppointmentsAndLeads();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to schedule appointment');
    } finally {
      setSaving(false);
    }
  };

  const selectedDayApps = appointments.filter(a => {
    if (!date) return false;
    return isSameDay(new Date(a.date), date);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CalendarIcon className="w-8 h-8 text-primary" />
              Calendar & Appointments
            </h2>
            <p className="text-muted-foreground mt-1 text-lg">
              Manage your upcoming meetings and demonstrations.
            </p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary">
                <Plus className="w-4 h-4" /> New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Appointment</DialogTitle>
                <CardDescription>
                  Scheduling for: <span className="font-medium text-foreground">{date ? format(date, 'MMMM do, yyyy') : 'No date selected'}</span>
                </CardDescription>
              </DialogHeader>
              <form onSubmit={handleCreateAppointment} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Event Title</Label>
                  <Input 
                    placeholder="e.g. Product Demo" 
                    value={form.title} 
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Associated Lead</Label>
                  <Select value={form.lead_id} onValueChange={v => setForm(f => ({ ...f, lead_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select a lead..." /></SelectTrigger>
                    <SelectContent>
                      {leads.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time (24h)</Label>
                  <Input 
                    type="time" 
                    value={form.time} 
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))} 
                  />
                </div>
                <Button type="submit" className="w-full" disabled={saving || !date}>
                  {saving ? 'Scheduling...' : 'Confirm Appointment'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Mini Calendar Card */}
          <Card className="col-span-1 shadow-sm h-fit">
            <CardHeader className="pb-4">
              <CardTitle>Date Navigation</CardTitle>
              <CardDescription>Select a day to view agenda</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <DayPicker
                mode="single"
                selected={date}
                onSelect={setDate}
                className="border rounded-lg p-3 bg-card"
                modifiers={{ booked: appointments.map(a => new Date(a.date)) }}
                modifiersStyles={{ booked: { fontWeight: 'bold', textDecoration: 'underline' } }}
              />
            </CardContent>
          </Card>

          {/* Agenda View */}
          <Card className="col-span-1 md:col-span-2 shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Agenda</CardTitle>
                  <CardDescription className="text-base mt-2">
                    {date ? format(date, 'EEEE, MMMM do, yyyy') : 'No date selected'}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm px-3 py-1 bg-primary/5 text-primary">
                  {selectedDayApps.length} Meetings
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Loading calendar sync...</div>
              ) : selectedDayApps.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                    <CalendarIcon className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">Your schedule is clear</h3>
                  <p className="text-muted-foreground mt-1">No appointments booked for this date.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {selectedDayApps.map(app => (
                    <div key={app.id} className="p-6 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center justify-center bg-primary/10 text-primary w-20 h-20 rounded-xl shrink-0">
                          <span className="text-xl font-bold">{app.time.substring(0, 5)}</span>
                          <span className="text-xs font-semibold uppercase">EST</span>
                        </div>
                        
                        <div className="flex flex-col justify-center">
                          <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            {app.title}
                            <Badge variant="secondary" className="text-xs uppercase bg-emerald-500/10 text-emerald-600 border-none">
                              {app.status}
                            </Badge>
                          </h4>
                          
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                              <UserCircle className="w-4 h-4" />
                              {app.leads?.name || 'Unknown Lead'}
                            </span>
                            <span className="hidden sm:inline text-muted-foreground/30">•</span>
                            <span className="flex items-center gap-1.5 opacity-80">
                              <Clock className="w-4 h-4" />
                              30 Min Sync
                            </span>
                          </div>
                        </div>
                      </div>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" className="shrink-0 text-primary hover:text-primary/80 gap-1 hover:bg-primary/10">
                            View Details <ArrowRight className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Appointment Details</DialogTitle>
                            <CardDescription>Review the scheduling info</CardDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="grid grid-cols-3 items-center gap-4">
                              <span className="text-sm font-medium text-muted-foreground">Title</span>
                              <span className="col-span-2 font-medium">{app.title}</span>
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                              <span className="text-sm font-medium text-muted-foreground">Lead</span>
                              <span className="col-span-2">{app.leads?.name || 'Unknown'} ({app.leads?.email})</span>
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                              <span className="text-sm font-medium text-muted-foreground">Date</span>
                              <span className="col-span-2">{format(new Date(app.date), 'MMMM do, yyyy')}</span>
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                              <span className="text-sm font-medium text-muted-foreground">Time</span>
                              <span className="col-span-2">{app.time.substring(0, 5)} EST</span>
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                              <span className="text-sm font-medium text-muted-foreground">Status</span>
                              <span className="col-span-2">
                                <Badge variant="secondary" className="uppercase bg-emerald-500/10 text-emerald-600 border-none">
                                  {app.status}
                                </Badge>
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-end pt-4 border-t">
                            <Button variant="destructive" onClick={() => handleDeleteAppointment(app.id)}>
                              Cancel Appointment
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
