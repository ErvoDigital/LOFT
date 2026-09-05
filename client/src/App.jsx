import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import AppShell from "./components/layout/AppShell.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import WorkspaceCalendar from "./pages/WorkspaceCalendar.jsx";
import WorkspaceTasks from "./pages/WorkspaceTasks.jsx";
import WorkspaceChat from "./pages/WorkspaceChat.jsx";
import WorkspaceMeeting from "./pages/WorkspaceMeeting.jsx";
import WorkspaceStorage from "./pages/WorkspaceStorage.jsx";
import WorkspaceDocuments from "./pages/WorkspaceDocuments.jsx";
import DocumentEditor from "./pages/DocumentEditor.jsx";
import WorkspaceSettings from "./pages/WorkspaceSettings.jsx";
import Chat from "./pages/Chat.jsx";
import Profile from "./pages/Profile.jsx";

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/reset-password" element={<PublicOnly><ResetPassword /></PublicOnly>} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/workspaces/:workspaceId/calendar" element={<WorkspaceCalendar />} />
        <Route path="/workspaces/:workspaceId/tasks" element={<WorkspaceTasks />} />
        <Route path="/workspaces/:workspaceId/chat" element={<WorkspaceChat />} />
        <Route path="/workspaces/:workspaceId/meeting" element={<WorkspaceMeeting />} />
        <Route path="/workspaces/:workspaceId/storage" element={<WorkspaceStorage />} />
        <Route path="/workspaces/:workspaceId/docs" element={<WorkspaceDocuments />} />
        <Route path="/workspaces/:workspaceId/docs/:docId" element={<DocumentEditor />} />
        <Route path="/workspaces/:workspaceId/settings" element={<WorkspaceSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
