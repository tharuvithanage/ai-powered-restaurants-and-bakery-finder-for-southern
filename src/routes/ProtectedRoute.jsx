import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute() {
  const [authState, setAuthState] = useState("checking");
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const token = localStorage.getItem("token");
  const location = useLocation();

  useEffect(() => {
    const verifySession = async () => {
      if (!token) {
        setAuthState("unauthorized");
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const data = await response.json();
        localStorage.setItem("user", JSON.stringify(data.user));
        setAuthState("authorized");
      } catch (_error) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setAuthState("unauthorized");
      }
    };

    verifySession();
  }, [apiBaseUrl, token]);

  if (authState === "checking") {
    return (
      <div style={{ padding: 24, color: "#0f172a", background: "transparent" }}>
        Checking session...
      </div>
    );
  }

  if (authState === "unauthorized") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
