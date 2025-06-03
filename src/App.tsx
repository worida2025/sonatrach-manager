
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/components/Login";
import Dashboard from "./pages/Dashboard";
import PID from "./pages/PID";
import PIDHistory from "./pages/PIDHistory";
import Datasheets from "./pages/Datasheets";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/*" element={              <ProtectedRoute>
                <SidebarProvider>
                  <div className="min-h-screen flex w-full overflow-hidden">
                    <AppSidebar />
                    <main className="flex-1 flex flex-col overflow-hidden min-h-screen">
                      <div className="flex-shrink-0 p-2 border-b bg-background">
                        <SidebarTrigger />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/pid" element={
                            <ProtectedRoute requiredRole="admin">
                              <PID />
                            </ProtectedRoute>
                          } />
                          <Route path="/pid/history" element={
                            <ProtectedRoute requiredRole="admin">
                              <PIDHistory />
                            </ProtectedRoute>
                          } />
                          <Route path="/pid/document/:id" element={
                            <ProtectedRoute requiredRole="admin">
                              <PID />
                            </ProtectedRoute>
                          } />
                          <Route path="/datasheets" element={
                            <ProtectedRoute requiredRole="admin">
                              <Datasheets />
                            </ProtectedRoute>
                          } />
                          <Route path="/settings" element={
                            <ProtectedRoute requiredRole="admin">
                              <Settings />
                            </ProtectedRoute>
                          } />
                          <Route path="/chat" element={<Chat />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </div>
                    </main>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
