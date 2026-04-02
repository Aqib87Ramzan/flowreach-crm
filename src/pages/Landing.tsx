import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Users, MessageSquare, Mail, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const features = [
  { icon: Users, title: 'Lead Management', desc: 'Organize and track all your leads in one place' },
  { icon: MessageSquare, title: 'SMS Campaigns', desc: 'Send personalized SMS messages at scale' },
  { icon: Mail, title: 'Email Outreach', desc: 'Create and send beautiful email campaigns' },
  { icon: BarChart3, title: 'Analytics', desc: 'Track performance with real-time dashboards' },
];

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate('/dashboard');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard');
    });

    return () => subscription.unsubscribe();
  }, [navigate]);
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            <span className="text-primary">Flow</span><span className="text-foreground">Reach</span>
          </h1>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate('/login')}>Login</Button>
            <Button onClick={() => navigate('/register')}>Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 py-24 text-center">
        <h2 className="text-5xl font-bold tracking-tight text-foreground max-w-3xl mx-auto leading-tight">
          The CRM that helps you <span className="text-primary">close more deals</span>
        </h2>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
          Manage leads, send SMS & email campaigns, and grow your business — all from one simple platform.
        </p>
        <div className="mt-10 flex gap-4 justify-center">
          <Button size="lg" onClick={() => navigate('/register')}>
            Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
            Login
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-card border rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-primary/10 rounded-lg p-3 w-fit mx-auto mb-4">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-card-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 FlowReach. All rights reserved.
      </footer>
    </div>
  );
}
