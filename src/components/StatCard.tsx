import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color?: string;
}

export default function StatCard({ title, value, icon: Icon, color = 'bg-primary' }: StatCardProps) {
  return (
    <div className="bg-card rounded-xl border p-6 flex items-center gap-4 shadow-sm">
      <div className={`${color} rounded-lg p-3 text-primary-foreground`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-card-foreground">{value}</p>
      </div>
    </div>
  );
}
