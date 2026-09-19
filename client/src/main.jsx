import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import { PresenceProvider } from "./context/PresenceContext.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";
import { NotificationsProvider } from "./context/NotificationsContext.jsx";
import { MeetingProvider } from "./context/MeetingContext.jsx";
import { ConfirmProvider } from "./context/ConfirmContext.jsx";
import { MemberProfileProvider } from "./context/MemberProfileContext.jsx";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
        <BrowserRouter>
          <AuthProvider>
            <SocketProvider>
              <PresenceProvider>
                <WorkspaceProvider>
                  <NotificationsProvider>
                    <MeetingProvider>
                      <ConfirmProvider>
                        <MemberProfileProvider>
                          <App />
                        </MemberProfileProvider>
                      </ConfirmProvider>
                    </MeetingProvider>
                  </NotificationsProvider>
                </WorkspaceProvider>
              </PresenceProvider>
            </SocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
