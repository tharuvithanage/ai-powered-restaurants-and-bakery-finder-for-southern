import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./css/Admin.css";
import { normalizePriceRange, PRICE_RANGES } from "../utils/priceRange";

export default function OwnerPage() {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const token = localStorage.getItem("token");

  const me = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const emptyMenuItem = useMemo(() => ({ name: "", price: "" }), []);
  const normalizeMenuList = useCallback(
    (value) =>
      Array.isArray(value)
        ? value
            .map((item) => ({
              name: String(item?.name || ""),
              price: String(item?.price || ""),
            }))
            .filter((item) => item.name || item.price)
        : [],
    []
  );
  const normalizeMenuCategories = useCallback(
    (value) => ({
      breakfast: normalizeMenuList(value?.breakfast),
      main: normalizeMenuList(value?.main),
      drinks: normalizeMenuList(value?.drinks),
    }),
    [normalizeMenuList]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState({
    price: "Moderate",
    budget: [],
    premium: [],
    menuCategories: { breakfast: [], main: [], drinks: [] },
    menuUpdatedAt: null,
  });

  const loadRestaurant = useCallback(async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/owner/restaurant`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to load restaurant");

      const details = data.restaurant || null;
      setRestaurant(details);
      setForm({
        price: normalizePriceRange(details?.price) || "Moderate",
        budget: normalizeMenuList(details?.budget),
        premium: normalizeMenuList(details?.premium),
        menuCategories: normalizeMenuCategories(details?.menuCategories || {}),
        menuUpdatedAt: details?.menuUpdatedAt || null,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, normalizeMenuCategories, normalizeMenuList, token]);

  useEffect(() => {
    loadRestaurant();
  }, [loadRestaurant]);

  const updateMenuListItem = (field, index, key, value) => {
    setForm((prev) => {
      const nextList = Array.isArray(prev[field]) ? [...prev[field]] : [];
      const row = nextList[index] || { ...emptyMenuItem };
      nextList[index] = { ...row, [key]: value };
      return { ...prev, [field]: nextList };
    });
  };

  const addMenuListItem = (field) => {
    setForm((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), { ...emptyMenuItem }],
    }));
  };

  const removeMenuListItem = (field, index) => {
    setForm((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, idx) => idx !== index),
    }));
  };

  const updateCategoryItem = (categoryKey, index, key, value) => {
    setForm((prev) => {
      const nextCategories = { ...(prev.menuCategories || {}) };
      const list = Array.isArray(nextCategories[categoryKey]) ? [...nextCategories[categoryKey]] : [];
      const row = list[index] || { ...emptyMenuItem };
      list[index] = { ...row, [key]: value };
      nextCategories[categoryKey] = list;
      return { ...prev, menuCategories: nextCategories };
    });
  };

  const addCategoryItem = (categoryKey) => {
    setForm((prev) => {
      const nextCategories = { ...(prev.menuCategories || {}) };
      nextCategories[categoryKey] = [...(nextCategories[categoryKey] || []), { ...emptyMenuItem }];
      return { ...prev, menuCategories: nextCategories };
    });
  };

  const removeCategoryItem = (categoryKey, index) => {
    setForm((prev) => {
      const nextCategories = { ...(prev.menuCategories || {}) };
      nextCategories[categoryKey] = (nextCategories[categoryKey] || []).filter((_, idx) => idx !== index);
      return { ...prev, menuCategories: nextCategories };
    });
  };

  const saveMenu = async () => {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const payload = {
        price: form.price,
        budget: normalizeMenuList(form.budget),
        premium: normalizeMenuList(form.premium),
        menuCategories: normalizeMenuCategories(form.menuCategories),
      };

      const response = await fetch(`${apiBaseUrl}/api/owner/restaurant/menu`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to save menu");

      setMessage("Saved.");
      if (data.restaurant) {
        setRestaurant(data.restaurant);
        setForm((prev) => ({ ...prev, menuUpdatedAt: data.restaurant.menuUpdatedAt || prev.menuUpdatedAt }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <div className="admin-hero">
          <div className="admin-top">
            <div>
              <h2 style={{ margin: 0 }}>Owner Panel</h2>
              <div className="admin-subtitle">
                Signed in as: {me?.email || "Unknown"} ({me?.role || "user"})
              </div>
            </div>
            <Link to="/" className="admin-home-btn">
              ← Back to Home
            </Link>
          </div>
        </div>

        {error ? <div className="admin-error">{error}</div> : null}
        {message ? (
          <div style={{ marginTop: 12, padding: 12, border: "1px solid rgba(34,197,94,0.35)", borderRadius: 12, background: "rgba(240,253,244,0.8)" }}>
            {message}
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ padding: 12, opacity: 0.8 }}>Loading...</div>
          ) : !restaurant ? (
            <div style={{ padding: 12, opacity: 0.8 }}>No restaurant assigned.</div>
          ) : (
            <div className="admin-card">
              <div className="admin-card-head">
                <div>
                  <h3 style={{ margin: 0 }}>{restaurant.name}</h3>
                  <div className="admin-subtitle">
                    {restaurant.location} • id: <span style={{ fontFamily: "monospace" }}>{restaurant.id}</span>
                  </div>
                </div>
              </div>

              <details className="admin-details" open>
                <summary className="admin-details-summary">Menus & prices</summary>
                {form.menuUpdatedAt ? (
                  <div className="admin-hint">
                    Last menu update: {new Date(form.menuUpdatedAt).toLocaleString()}
                  </div>
                ) : (
                  <div className="admin-hint">Tip: update menus here so customers see the latest prices.</div>
                )}

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Price level</span>
                    <select
                      className="admin-input"
                      value={form.price}
                      onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                    >
                      {PRICE_RANGES.map((range) => (
                        <option key={range} value={range}>
                          {range}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="admin-menu-grid">
                  <div className="admin-menu-box">
                    <div className="admin-menu-title">Budget (fallback)</div>
                    {(form.budget || []).map((item, index) => (
                      <div className="admin-menu-row" key={`budget-${index}`}>
                        <input
                          className="admin-input admin-menu-input admin-menu-name"
                          value={item.name}
                          onChange={(e) => updateMenuListItem("budget", index, "name", e.target.value)}
                          placeholder="Item name"
                        />
                        <input
                          className="admin-input admin-menu-input admin-menu-price"
                          value={item.price}
                          onChange={(e) => updateMenuListItem("budget", index, "price", e.target.value)}
                          placeholder="Price (e.g. Rs. 1200)"
                        />
                        <button type="button" className="admin-btn danger" onClick={() => removeMenuListItem("budget", index)}>
                          Remove
                        </button>
                      </div>
                    ))}
                    <button type="button" className="admin-btn" onClick={() => addMenuListItem("budget")}>
                      Add budget item
                    </button>
                  </div>

                  <div className="admin-menu-box">
                    <div className="admin-menu-title">Premium (fallback)</div>
                    {(form.premium || []).map((item, index) => (
                      <div className="admin-menu-row" key={`premium-${index}`}>
                        <input
                          className="admin-input admin-menu-input admin-menu-name"
                          value={item.name}
                          onChange={(e) => updateMenuListItem("premium", index, "name", e.target.value)}
                          placeholder="Item name"
                        />
                        <input
                          className="admin-input admin-menu-input admin-menu-price"
                          value={item.price}
                          onChange={(e) => updateMenuListItem("premium", index, "price", e.target.value)}
                          placeholder="Price (e.g. Rs. 3500)"
                        />
                        <button type="button" className="admin-btn danger" onClick={() => removeMenuListItem("premium", index)}>
                          Remove
                        </button>
                      </div>
                    ))}
                    <button type="button" className="admin-btn" onClick={() => addMenuListItem("premium")}>
                      Add premium item
                    </button>
                  </div>

                  {["breakfast", "main", "drinks"].map((categoryKey) => (
                    <div className="admin-menu-box" key={categoryKey}>
                      <div className="admin-menu-title">
                        {categoryKey === "breakfast" ? "Breakfast" : categoryKey === "main" ? "Main" : "Drinks"}
                      </div>
                      {(form.menuCategories?.[categoryKey] || []).map((item, index) => (
                        <div className="admin-menu-row" key={`${categoryKey}-${index}`}>
                          <input
                            className="admin-input admin-menu-input admin-menu-name"
                            value={item.name}
                            onChange={(e) => updateCategoryItem(categoryKey, index, "name", e.target.value)}
                            placeholder="Item name"
                          />
                          <input
                            className="admin-input admin-menu-input admin-menu-price"
                            value={item.price}
                            onChange={(e) => updateCategoryItem(categoryKey, index, "price", e.target.value)}
                            placeholder="Price (e.g. Rs. 900)"
                          />
                          <button
                            type="button"
                            className="admin-btn danger"
                            onClick={() => removeCategoryItem(categoryKey, index)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button type="button" className="admin-btn" onClick={() => addCategoryItem(categoryKey)}>
                        Add item
                      </button>
                    </div>
                  ))}
                </div>
              </details>

              <button type="button" className="admin-btn primary" onClick={saveMenu} disabled={saving}>
                {saving ? "Saving..." : "Save menu"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
