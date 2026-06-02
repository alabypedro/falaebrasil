import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Courses from "@/pages/Courses";
import VoiceLab from "@/pages/VoiceLab";
import WritingLab from "@/pages/WritingLab";
import Library from "@/pages/Library";
import Profile from "@/pages/Profile";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Welcome from "@/pages/Welcome";
import NotFound from "@/pages/NotFound";
import QuizPlayer from "@/pages/QuizPlayer";
import CourseDetail from "@/pages/CourseDetail";
import Install from "@/pages/Install";
import Tutoriais from "@/pages/Tutoriais";
import Communities from "@/pages/Communities";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import CoursesManager from "@/pages/admin/CoursesManager";
import ModulesManager from "@/pages/admin/ModulesManager";
import LessonsManager from "@/pages/admin/LessonsManager";
import QuizzesManager from "@/pages/admin/QuizzesManager";
import LibraryManager from "@/pages/admin/LibraryManager";
import PromptsManager from "@/pages/admin/PromptsManager";
import AdminsManager from "@/pages/admin/AdminsManager";
import HublaProductsManager from "@/pages/admin/HublaProductsManager";
import TutorialsManager from "@/pages/admin/TutorialsManager";
import CommunitiesManager from "@/pages/admin/CommunitiesManager";
import InstallTutorialVideosManager from "@/pages/admin/InstallTutorialVideosManager";
import WelcomeEmailSender from "@/pages/admin/WelcomeEmailSender";
import ContractsManager from "@/pages/admin/ContractsManager";
import Contratos from "@/pages/Contratos";
import Success from "@/pages/Success";
import { useEffect } from "react";
import { registerPushNotification, updateLastActivity } from "@/services/pushNotifications";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAdmin();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/courses" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  // Hubla-onboarded users land on /welcome (separate route), so it's safe
  // to always redirect logged-in users away from /auth.
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => {
  useEffect(() => {
    const initNotifications = async () => {
      await registerPushNotification();
      await updateLastActivity();
    };
    
    initNotifications();

    const handleActivity = () => updateLastActivity();
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/install" element={<Install />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/courses" element={<Courses />} />
                        <Route path="/courses/:courseId" element={<CourseDetail />} />
                        <Route path="/voice-lab" element={<VoiceLab />} />
                        <Route path="/chat-lab" element={<WritingLab />} />
                        <Route path="/library" element={<Library />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/tutoriais" element={<Tutoriais />} />
                        <Route path="/communities" element={<Communities />} />
                        <Route path="/contratos" element={<Contratos />} />
                        <Route path="/quiz/:quizId" element={<QuizPlayer />} />
                        <Route path="/success" element={<Success />} />
                        <Route
                          path="/admin/*"
                          element={
                            <AdminRoute>
                              <AdminLayout />
                            </AdminRoute>
                          }
                        >
                          <Route index element={<AdminDashboard />} />
                          <Route path="courses" element={<CoursesManager />} />
                          <Route path="modules" element={<ModulesManager />} />
                          <Route path="lessons" element={<LessonsManager />} />
                          <Route path="quizzes" element={<QuizzesManager />} />
                          <Route path="library" element={<LibraryManager />} />
                          <Route path="prompts" element={<PromptsManager />} />
                          <Route path="tutorials" element={<TutorialsManager />} />
                          <Route path="install-videos" element={<InstallTutorialVideosManager />} />
                          <Route path="communities" element={<CommunitiesManager />} />
                          <Route path="contracts" element={<ContractsManager />} />
                          <Route path="admins" element={<AdminsManager />} />
                          <Route path="hubla" element={<HublaProductsManager />} />
                          <Route path="welcome-email" element={<WelcomeEmailSender />} />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
