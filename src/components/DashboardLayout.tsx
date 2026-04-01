import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from '@/lib/mockData';
import AppSidebar from './AppSidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!getAuth()) navigate('/login');
  }, [navigate]);

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="flex-1 bg-background p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
