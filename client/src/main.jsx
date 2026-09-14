import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";
import { NotificationsProvider } from "./context/NotificationsContext.jsx";
import { MeetingProvider } from "./context/MeetingContext.jsx";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <WorkspaceProvider>
              <NotificationsProvider>
                <MeetingProvider>
                  <App />
                </MeetingProvider>
              </NotificationsProvider>
            </WorkspaceProvider>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
