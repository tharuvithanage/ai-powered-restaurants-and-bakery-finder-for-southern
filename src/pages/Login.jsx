import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import background from "../Images/Downsouth.jpg";
import "./css/Login.css";
import { isValidEmail, normalizeEmail } from "../utils/validation.js";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email), password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      const redirectTo = location.state?.from?.pathname || "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForgot = () => {
    setForgotOpen(true);
    setForgotMessage("");
    setForgotError("");
    setResetToken("");
    setNewPassword("");
    setResetEmail((prev) => prev || email);
  };

  const handleRequestReset = async () => {
    setForgotError("");
    setForgotMessage("");

    if (!resetEmail.trim()) {
      setForgotError("Please enter your email first.");
      return;
    }

    if (!isValidEmail(resetEmail)) {
      setForgotError("Please enter a valid email address.");
      return;
    }

    try {
      setForgotLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(resetEmail) }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Could not create reset code");
      }

      setForgotMessage(
        data.resetToken
          ? "Reset code created (dev mode). Paste it below to set a new password."
          : data.message || "If that account exists, a reset code has been created."
      );
      if (data.resetToken) {
        setResetToken(String(data.resetToken));
      }
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setForgotError("");
    setForgotMessage("");

    if (!resetToken.trim() || !newPassword) {
      setForgotError("Reset code and new password are required.");
      return;
    }

    try {
      setResetLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken.trim(), password: newPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Could not reset password");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      const redirectTo = location.state?.from?.pathname || "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ backgroundImage: `url(${background})` }}>
      <div className="overlay" />

      <div className="login-card">
        {forgotOpen ? (
          <>
            <h2 className="title">Reset password</h2>
            <p className="subtitle">We’ll create a reset code, then you can set a new password.</p>

            <div className="forgot-panel" role="region" aria-label="Reset password">
              <div className="forgot-panel-head">
                <div />
                <button
                  type="button"
                  className="forgot-close"
                  onClick={() => setForgotOpen(false)}
                  aria-label="Close reset password panel"
                  disabled={resetLoading || forgotLoading}
                >
                  ✕
                </button>
              </div>

              {forgotError ? <p className="auth-message auth-error">{forgotError}</p> : null}
              {forgotMessage ? <p className="auth-message auth-success">{forgotMessage}</p> : null}

              <div className="forgot-grid">
                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="Enter your account email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="forgot-action-btn forgot-action-secondary"
                  onClick={handleRequestReset}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Creating code..." : "Create reset code"}
                </button>

                <div className="input-group">
                  <label>Reset code</label>
                  <input
                    type="text"
                    placeholder="Paste reset code"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    autoComplete="one-time-code"
                  />
                </div>

                <div className="input-group">
                  <label>New password</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <div className="forgot-actions">
                  <button
                    type="button"
                    className="forgot-secondary"
                    onClick={() => setForgotOpen(false)}
                    disabled={resetLoading || forgotLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="forgot-primary"
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                  >
                    {resetLoading ? "Updating..." : "Update password"}
                  </button>
                </div>
              </div>
            </div>

            <button className="login-btn" type="button" onClick={() => setForgotOpen(false)}>
              Login
            </button>

            <p className="signup">
              Don&apos;t have an account?{" "}
              <Link to="/register" state={{ from: location.state?.from }}>
                Sign up
              </Link>
            </p>
          </>
        ) : (
          <>
            <h2 className="title">Welcome Back</h2>
            <p className="subtitle">Login to continue</p>
            {error ? <p className="auth-message auth-error">{error}</p> : null}

            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>Password</label>
                <div className="password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="forgot-row">
                <button type="button" className="forgot" onClick={handleOpenForgot}>
                  Forgot password?
                </button>
              </div>

              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>

            <p className="signup">
              Don&apos;t have an account?{" "}
              <Link to="/register" state={{ from: location.state?.from }}>
                Sign up
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
