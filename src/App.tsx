import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { workflowAutomationService } from "@/services/WorkflowAutomationService";
import { supabase } from "@/integrations/supabase/client";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Inbox from "./pages/Inbox";
import SendSMS from "./pages/SendSMS";
import SendEmail from "./pages/SendEmail";
import Tasks from "./pages/Tasks";
import Workflows from "./pages/Workflows";
import WorkflowBuilder from "./pages/WorkflowBuilder";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  useEffect(() => {
    // Start workflow automation service when user is authenticated
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        workflowAutomationService.start();
        return () => {
          workflowAutomationService.stop();
        };
      }
    };

    checkAuth();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/leads" element={<Leads />} />
      <Route path="/inbox" element={<Inbox />} />
      <Route path="/workflows" element={<Workflows />} />
      <Route path="/workflow-builder" element={<WorkflowBuilder />} />
      <Route path="/workflow-builder/:id" element={<WorkflowBuilder />} />
      <Route path="/send-sms" element={<SendSMS />} />
      <Route path="/send-email" element={<SendEmail />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
