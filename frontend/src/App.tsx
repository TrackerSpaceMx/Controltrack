import React, { useState } from "react";
import { LoginPage }     from "./pages/LoginPage";
import { SuperAdminApp } from "./pages/SuperAdminApp";
import { TenantApp }     from "./pages/TenantApp";
import { setAuthToken, SessionInfo } from "./api";

const SESSION_KEY = "ct_session";

export function App() {
  const [session, setSession] = useState<SessionInfo | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const s: SessionInfo = JSON.parse(stored);
        setAuthToken(s.token);
        return s;
      }
    } catch {}
    return null;
  });

  const handleLogin = (s: SessionInfo) => {
    setAuthToken(s.token);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
  };

  const handleLogout = () => {
    setAuthToken("");
    sessionStorage.removeItem(SESSION_KEY);
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
