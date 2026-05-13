import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./css/Profile.css";

const initialForm = {
  name: "",
  avatarUrl: "",
  bio: "",
  phone: "",
  email: "",
};

export default function Profile() {
  const navigate = useNavigate();
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const token = localStorage.getItem("token");
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(initialForm);
  const [originalForm, setOriginalForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [photoProcessing, setPhotoProcessing] = useState(false);

  const parseApiResponse = async (response, fallbackMessage) => {
    const raw = await response.text();
    let data = null;

    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      if (!response.ok) {
        throw new Error(
          `${fallbackMessage} (server returned non-JSON response, status ${response.status})`
        );
      }
      throw new Error("Server returned an invalid response format.");
    }

    if (!response.ok) {
      throw new Error(data?.error || data?.message || fallbackMessage);
    }

    return data;
  };

  const initials = useMemo(() => {
    const parts = form.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    return parts
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  }, [form.name]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${apiBaseUrl}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await parseApiResponse(response, "Failed to load profile");

        setForm({
          name: data.user.name || "",
          email: data.user.email || "",
          avatarUrl: data.user.avatarUrl || "",
          bio: data.user.bio || "",
          phone: data.user.phone || "",
        });
        setOriginalForm({
          name: data.user.name || "",
          email: data.user.email || "",
          avatarUrl: data.user.avatarUrl || "",
          bio: data.user.bio || "",
          phone: data.user.phone || "",
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [apiBaseUrl, token]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoPick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    const maxBytes = 1.5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError("Image is too large. Please choose a file under 1.5MB.");
      return;
    }

    try {
      setPhotoProcessing(true);
      setError("");
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read image."));
        reader.readAsDataURL(file);
      });

      setForm((prev) => ({ ...prev, avatarUrl: dataUrl }));
    } catch (err) {
      setError(err.message || "Failed to load image.");
    } finally {
      setPhotoProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = () => {
    setForm((prev) => ({ ...prev, avatarUrl: "" }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        name: form.name,
        avatarUrl: form.avatarUrl,
        bio: form.bio,
        phone: form.phone,
      };

      const response = await fetch(`${apiBaseUrl}/api/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await parseApiResponse(response, "Failed to update profile");

      localStorage.setItem("user", JSON.stringify(data.user));
      setForm((prev) => ({ ...prev, ...data.user }));
      setOriginalForm((prev) => ({ ...prev, ...data.user }));
      setMessage("Saved just now");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const completion = useMemo(() => {
    const checks = [form.name, form.phone, form.bio, form.avatarUrl];
    const complete = checks.filter((item) => String(item || "").trim().length > 0).length;
    return Math.round((complete / checks.length) * 100);
  }, [form]);

  const hasChanges = useMemo(() => {
    return (
      form.name !== originalForm.name ||
      form.phone !== originalForm.phone ||
      form.bio !== originalForm.bio ||
      form.avatarUrl !== originalForm.avatarUrl
    );
  }, [form, originalForm]);

  if (loading) {
    return <div className="profile-page">Loading profile...</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-head">
          <button type="button" className="profile-back-btn" onClick={() => navigate(-1)}>
            Back
          </button>
          <h2>My Profile</h2>
        </div>

        <div className="profile-top">
          <div className="avatar-preview">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="avatar" />
            ) : (
              <div className="avatar-fallback">{initials}</div>
            )}
            <div className="avatar-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoPick}
                hidden
              />
              <button
                type="button"
                className="avatar-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoProcessing}
              >
                {photoProcessing ? "Processing..." : "Add Photo"}
              </button>
              <button type="button" className="avatar-remove-btn" onClick={handleRemovePhoto}>
                Remove
              </button>
            </div>
          </div>

          <div className="profile-summary">
            <h3>{form.name || "Your Profile"}</h3>
            <p>{form.email}</p>
            <div className="completion-row">
              <span>Profile completion</span>
              <b>{completion}%</b>
            </div>
            <div className="completion-track">
              <span style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>

        {error ? <p className="profile-error">{error}</p> : null}
        {message ? <p className="profile-success">{message}</p> : null}

        <form className="profile-form" onSubmit={handleSave}>
          <div className="form-grid">
            <label>
              Name
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </label>

            <label>
              Phone
              <input
                type="text"
                value={form.phone}
                placeholder="+94 77 123 4567"
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </label>
          </div>

          <label>
            Email (read-only)
            <input type="email" value={form.email} disabled />
          </label>

          <label>
            Bio
            <textarea
              value={form.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              rows={4}
              maxLength={200}
              placeholder="Tell others what kind of places you love..."
            />
            <small>{form.bio.length}/200</small>
          </label>

          <div className="profile-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setForm(originalForm)}
              disabled={!hasChanges || saving}
            >
              Reset
            </button>
            <button type="submit" disabled={saving || !hasChanges}>
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
