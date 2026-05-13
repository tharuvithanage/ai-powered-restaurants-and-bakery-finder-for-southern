import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function AdminRoute() {
  const [state, setState] = useState("checking");
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const token = localStorage.getItem("token");
  const location = useLocation();

  useEffect(() => {
    const verifyAdmin = async () => {
      if (!token) {
        setState("unauthorized");
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

        if (data.user?.role !== "admin") {
          setState("forbidden");
          return;
        }

        setState("authorized");
      } catch (_error) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setState("unauthorized");
      }
    };

    verifyAdmin();
  }, [apiBaseUrl, token]);

  if (state === "checking") {
    return <div style={{ padding: 24 }}>Checking admin access...</div>;
  }

  if (state === "unauthorized") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (state === "forbidden") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

