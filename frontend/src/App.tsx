import React, { useState } from "react";
import { LoginPage }     from "./pages/LoginPage";
import { SuperAdminApp } from "./pages/SuperAdminApp";
import { TenantApp }     from "./pages/TenantApp";
import { setAuthToken, SessionInfo } from "./api";

export function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);

  const handleLogin = (s: SessionInfo) => {
    setAuthToken(s.token);
    setSession(s);
  };

  const handleLogout = () => {
    setAuthToken("");
    setSession(null);
  };

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (session.is_superadmin) {
    return (
      <div className="h-screen overflow-hidden">
        <SuperAdminApp session={session} onLogout={handleLogout} />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <TenantApp session={session} onLogout={handleLogout} />
    </div>
  );
}
