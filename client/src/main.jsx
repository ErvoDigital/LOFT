import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";
import { NotificationsProvider } from "./context/NotificationsContext.jsx";
import { MeetingProvider } from "./context/MeetingContext.jsx";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
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
  </React.StrictMode>
);
