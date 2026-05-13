import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./css/Admin.css";
import { normalizePriceRange, PRICE_RANGES } from "../utils/priceRange";

export default function AdminPage() {
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

  const [tab, setTab] = useState("users");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasFetchedUsers, setHasFetchedUsers] = useState(false);
  const [hasFetchedReviews, setHasFetchedReviews] = useState(false);
  const [hasFetchedRestaurants, setHasFetchedRestaurants] = useState(false);

  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState("");

  const [reviews, setReviews] = useState([]);
  const [reviewRestaurantId, setReviewRestaurantId] = useState("");

  const [restaurants, setRestaurants] = useState([]);
  const [restaurantQuery, setRestaurantQuery] = useState("");
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
  const [restaurantForm, setRestaurantForm] = useState({
    id: "",
    name: "",
    location: "",
    price: "Moderate",
    image: "",
    desc: "",
    budget: [],
    premium: [],
    menuCategories: {
      breakfast: [],
      main: [],
      drinks: [],
    },
    menuUpdatedAt: null,
  });
  const [editingRestaurantId, setEditingRestaurantId] = useState("");
  const [menuDirty, setMenuDirty] = useState(false);

  const fetchUsers = async () => {
    setError("");
    setLoading(true);
    try {
      const url = new URL(`${apiBaseUrl}/api/admin/users`);
      if (userQuery.trim()) url.searchParams.set("q", userQuery.trim());

      const response = await fetch(url.toString(), { headers: authHeaders });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to load users");
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setHasFetchedUsers(true);
    }
  };

  const fetchReviews = async () => {
    setError("");
    setLoading(true);
    try {
      const url = new URL(`${apiBaseUrl}/api/admin/reviews`);
      if (reviewRestaurantId.trim()) {
        url.searchParams.set("restaurantId", reviewRestaurantId.trim());
      }

      const response = await fetch(url.toString(), { headers: authHeaders });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to load reviews");
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setHasFetchedReviews(true);
    }
  };

  useEffect(() => {
    if (tab === "users") fetchUsers();
    if (tab === "reviews") fetchReviews();
    if (tab === "restaurants") fetchRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const setRole = async (userId, role, ownerRestaurantId = "") => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(
          role === "owner" ? { role, ownerRestaurantId } : { role }
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to update role");
      await fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId, email) => {
    if (!confirm(`Delete user ${email}? This will also delete their reviews.`)) return;

    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to delete user");
      await fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteReview = async (reviewId) => {
    if (!confirm("Delete this review?")) return;

    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/reviews/${reviewId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to delete review");
      await fetchReviews();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurants = async () => {
    setError("");
    setLoading(true);
    try {
      const url = new URL(`${apiBaseUrl}/api/admin/restaurants`);
      if (restaurantQuery.trim()) url.searchParams.set("q", restaurantQuery.trim());

      const response = await fetch(url.toString(), { headers: authHeaders });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to load restaurants");
      setRestaurants(Array.isArray(data.restaurants) ? data.restaurants : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setHasFetchedRestaurants(true);
    }
  };

  const startCreateRestaurant = () => {
    setEditingRestaurantId("");
    setRestaurantForm({
      id: "",
      name: "",
      location: "",
      price: "Moderate",
      image: "",
      desc: "",
      budget: [],
      premium: [],
      menuCategories: {
        breakfast: [],
        main: [],
        drinks: [],
      },
      menuUpdatedAt: null,
    });
    setMenuDirty(false);
  };

  const startEditRestaurant = async (restaurant) => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/restaurants/${restaurant.id}`, {
        headers: authHeaders,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to load restaurant details");

      const details = data.restaurant || {};
      setEditingRestaurantId(details.id);
      setRestaurantForm({
        id: details.id || restaurant.id || "",
        name: details.name || "",
        location: details.location || "",
        price: normalizePriceRange(details.price) || "Moderate",
        image: details.image || "",
        desc: details.desc || "",
        budget: normalizeMenuList(details.budget),
        premium: normalizeMenuList(details.premium),
        menuCategories: normalizeMenuCategories(details.menuCategories || {}),
        menuUpdatedAt: details.menuUpdatedAt || null,
      });
      setMenuDirty(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateMenuListItem = (listKey, index, field, value) => {
    setRestaurantForm((prev) => {
      const nextList = [...(prev[listKey] || [])];
      const existing = nextList[index] || emptyMenuItem;
      nextList[index] = { ...existing, [field]: value };
      return { ...prev, [listKey]: nextList };
    });
    setMenuDirty(true);
  };

  const addMenuListItem = (listKey) => {
    setRestaurantForm((prev) => ({ ...prev, [listKey]: [...(prev[listKey] || []), emptyMenuItem] }));
    setMenuDirty(true);
  };

  const removeMenuListItem = (listKey, index) => {
    setRestaurantForm((prev) => {
      const nextList = [...(prev[listKey] || [])];
      nextList.splice(index, 1);
      return { ...prev, [listKey]: nextList };
    });
    setMenuDirty(true);
  };

  const updateCategoryItem = (categoryKey, index, field, value) => {
    setRestaurantForm((prev) => {
      const nextCategories = { ...(prev.menuCategories || {}) };
      const nextList = [...(nextCategories[categoryKey] || [])];
      const existing = nextList[index] || emptyMenuItem;
      nextList[index] = { ...existing, [field]: value };
      nextCategories[categoryKey] = nextList;
      return { ...prev, menuCategories: nextCategories };
    });
    setMenuDirty(true);
  };

  const addCategoryItem = (categoryKey) => {
    setRestaurantForm((prev) => {
      const nextCategories = { ...(prev.menuCategories || {}) };
      nextCategories[categoryKey] = [...(nextCategories[categoryKey] || []), emptyMenuItem];
      return { ...prev, menuCategories: nextCategories };
    });
    setMenuDirty(true);
  };

  const removeCategoryItem = (categoryKey, index) => {
    setRestaurantForm((prev) => {
      const nextCategories = { ...(prev.menuCategories || {}) };
      const nextList = [...(nextCategories[categoryKey] || [])];
      nextList.splice(index, 1);
      nextCategories[categoryKey] = nextList;
      return { ...prev, menuCategories: nextCategories };
    });
    setMenuDirty(true);
  };

  const saveRestaurant = async () => {
    setError("");
    setLoading(true);
    try {
      const isEditing = Boolean(editingRestaurantId);
      const endpoint = isEditing
        ? `${apiBaseUrl}/api/admin/restaurants/${editingRestaurantId}`
        : `${apiBaseUrl}/api/admin/restaurants`;

      const method = isEditing ? "PATCH" : "POST";
      const payload = {
        id: restaurantForm.id,
        name: restaurantForm.name,
        location: restaurantForm.location,
        price: restaurantForm.price,
        image: restaurantForm.image,
        desc: restaurantForm.desc,
      };

      if (!isEditing || menuDirty) {
        payload.budget = normalizeMenuList(restaurantForm.budget);
        payload.premium = normalizeMenuList(restaurantForm.premium);
        payload.menuCategories = normalizeMenuCategories(restaurantForm.menuCategories);

        const allMenuItems = [
          ...(restaurantForm.budget || []),
          ...(restaurantForm.premium || []),
          ...(restaurantForm.menuCategories?.breakfast || []),
          ...(restaurantForm.menuCategories?.main || []),
          ...(restaurantForm.menuCategories?.drinks || []),
        ];
        const incomplete = allMenuItems.find(
          (item) =>
            (String(item?.name || "").trim() && !String(item?.price || "").trim()) ||
            (!String(item?.name || "").trim() && String(item?.price || "").trim())
        );
        if (incomplete) {
          throw new Error("Each menu item needs both name and price (or leave both empty).");
        }
      }

      const response = await fetch(endpoint, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to save restaurant");

      await fetchRestaurants();
      if (!isEditing) startCreateRestaurant();
      setMenuDirty(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeRestaurant = async (restaurantId) => {
    if (!confirm(`Delete restaurant '${restaurantId}'? This will delete its reviews too.`)) return;

    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/restaurants/${restaurantId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to delete restaurant");
      await fetchRestaurants();
      if (editingRestaurantId === restaurantId) startCreateRestaurant();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <div className="admin-hero">
          <div className="admin-top">
            <div>
              <h2 style={{ margin: 0 }}>Admin Control Center</h2>
              <div className="admin-subtitle">
                Signed in as: {me?.email || "Unknown"} ({me?.role || "user"})
              </div>
            </div>
            <Link to="/" className="admin-home-btn" aria-label="Back to Home">
              <span aria-hidden="true">←</span>
              <span>Back to Home</span>
            </Link>
          </div>

          <div className="admin-stats" aria-label="Admin overview">
            <div className="admin-stat">
              <div className="admin-stat-label">Users</div>
              <div className="admin-stat-value">{hasFetchedUsers ? users.length : "—"}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-label">Reviews</div>
              <div className="admin-stat-value">{hasFetchedReviews ? reviews.length : "—"}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-label">Restaurants</div>
              <div className="admin-stat-value">{hasFetchedRestaurants ? restaurants.length : "—"}</div>
            </div>
          </div>

          {loading ? <div className="admin-loadingbar" aria-hidden="true" /> : null}
        </div>

        <div className="admin-tabs">
          <button
            type="button"
            className="admin-tab-btn"
            aria-pressed={tab === "users"}
            onClick={() => setTab("users")}
            disabled={loading}
          >
            Users
          </button>
          <button
            type="button"
            className="admin-tab-btn"
            aria-pressed={tab === "reviews"}
            onClick={() => setTab("reviews")}
            disabled={loading}
          >
            Reviews
          </button>
          <button
            type="button"
            className="admin-tab-btn"
            aria-pressed={tab === "restaurants"}
            onClick={() => setTab("restaurants")}
            disabled={loading}
          >
            Restaurants
          </button>
        </div>

        {error ? <div className="admin-error">{error}</div> : null}

      {tab === "users" ? (
        <div style={{ marginTop: 16 }}>
          <div className="admin-toolbar">
            <input
              className="admin-input"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search name/email..."
            />
            <button type="button" className="admin-btn primary" onClick={fetchUsers} disabled={loading}>
              {loading ? "Loading..." : "Search"}
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Owner restaurant</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`role-pill ${u.role}`}>{u.role}</span>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {u.role === "owner" ? u.ownerRestaurantId || "—" : "—"}
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => setRole(u.id, "admin")}
                          disabled={loading || u.id === me?.id || u.role === "admin"}
                          title={u.id === me?.id ? "You cannot change your own role here" : ""}
                        >
                          Make admin
                        </button>
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => {
                            const restaurantId = prompt(
                              "Enter restaurant id for this owner (example: kai-ahangama)"
                            );
                            if (!restaurantId) return;
                            setRole(u.id, "owner", String(restaurantId).trim());
                          }}
                          disabled={loading || u.id === me?.id}
                          title={u.id === me?.id ? "You cannot change your own role here" : ""}
                        >
                          {u.role === "owner" ? "Change owner" : "Make owner"}
                        </button>
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => setRole(u.id, "user")}
                          disabled={loading || u.id === me?.id || u.role === "user"}
                          title={u.id === me?.id ? "You cannot change your own role here" : ""}
                        >
                          Make user
                        </button>
                        <button
                          type="button"
                          className="admin-btn danger"
                          onClick={() => deleteUser(u.id, u.email)}
                          disabled={loading || u.id === me?.id}
                          title={u.id === me?.id ? "You cannot delete your own account" : ""}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 12, opacity: 0.7 }}>
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "reviews" ? (
        <div style={{ marginTop: 16 }}>
          <div className="admin-toolbar">
            <input
              className="admin-input"
              value={reviewRestaurantId}
              onChange={(e) => setReviewRestaurantId(e.target.value)}
              placeholder="Filter by restaurantId (optional)"
            />
            <button type="button" className="admin-btn primary" onClick={fetchReviews} disabled={loading}>
              {loading ? "Loading..." : "Load"}
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            {reviews.map((r) => (
              <div
                key={r._id}
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.35)",
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 10,
                  background: "rgba(255, 255, 255, 0.88)",
                  boxShadow: "0 12px 26px rgba(7, 20, 36, 0.12)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 600 }}>
                    {r.restaurantId} • {r.userName} • {r.rating}/5
                  </div>
                  <button
                    type="button"
                    className="admin-btn danger"
                    onClick={() => deleteReview(r._id)}
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{r.comment}</div>
                <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
                  {r.sentimentLabel} ({r.sentimentScore}) • {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
            {reviews.length === 0 ? <div style={{ opacity: 0.7 }}>No reviews found.</div> : null}
          </div>
        </div>
      ) : null}

      {tab === "restaurants" ? (
        <div style={{ marginTop: 16 }}>
          <div className="admin-toolbar">
            <input
              className="admin-input"
              value={restaurantQuery}
              onChange={(e) => setRestaurantQuery(e.target.value)}
              placeholder="Search id/name/location..."
            />
            <button type="button" className="admin-btn primary" onClick={fetchRestaurants} disabled={loading}>
              {loading ? "Loading..." : "Search"}
            </button>
            <button type="button" className="admin-btn" onClick={startCreateRestaurant} disabled={loading}>
              New
            </button>
          </div>

          <div className="admin-split">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.name}</td>
                      <td>{r.location}</td>
                      <td>
                        <div className="admin-actions">
                          <button type="button" className="admin-btn" onClick={() => startEditRestaurant(r)} disabled={loading}>
                            Edit
                          </button>
                          <button type="button" className="admin-btn danger" onClick={() => removeRestaurant(r.id)} disabled={loading}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {restaurants.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 12, opacity: 0.7 }}>
                        No restaurants found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="admin-card">
              <div className="admin-card-title">
                {editingRestaurantId ? `Edit: ${editingRestaurantId}` : "Create restaurant"}
              </div>

              <div className="admin-field">
                <div className="admin-label">Id (slug)</div>
                <input
                  className="admin-input"
                  value={restaurantForm.id}
                  onChange={(e) => setRestaurantForm((p) => ({ ...p, id: e.target.value }))}
                  placeholder="my-restaurant"
                  disabled={Boolean(editingRestaurantId)}
                />
              </div>

              <div className="admin-field">
                <div className="admin-label">Name</div>
                <input
                  className="admin-input"
                  value={restaurantForm.name}
                  onChange={(e) => setRestaurantForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Restaurant name"
                />
              </div>

              <div className="admin-field">
                <div className="admin-label">Location</div>
                <input
                  className="admin-input"
                  value={restaurantForm.location}
                  onChange={(e) => setRestaurantForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Ahangama / Galle / ..."
                />
              </div>

              <div className="admin-field">
                <div className="admin-label">Price</div>
                <select
                  className="admin-input"
                  value={restaurantForm.price}
                  onChange={(e) => setRestaurantForm((p) => ({ ...p, price: e.target.value }))}
                >
                  {PRICE_RANGES.map((range) => (
                    <option key={range} value={range}>
                      {range}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <div className="admin-label">Image URL</div>
                <input
                  className="admin-input"
                  value={restaurantForm.image}
                  onChange={(e) => setRestaurantForm((p) => ({ ...p, image: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              <div className="admin-field">
                <div className="admin-label">Description</div>
                <textarea
                  className="admin-textarea"
                  value={restaurantForm.desc}
                  onChange={(e) => setRestaurantForm((p) => ({ ...p, desc: e.target.value }))}
                  placeholder="Short description..."
                  rows={4}
                />
              </div>

              <details className="admin-details" open={Boolean(editingRestaurantId)}>
                <summary className="admin-details-summary">Menus & prices</summary>
                {restaurantForm.menuUpdatedAt ? (
                  <div className="admin-hint">
                    Last menu update: {new Date(restaurantForm.menuUpdatedAt).toLocaleString()}
                  </div>
                ) : (
                  <div className="admin-hint">Tip: add items here so Restaurant Details shows up-to-date prices.</div>
                )}

                <div className="admin-menu-grid">
                  <div className="admin-menu-box">
                    <div className="admin-menu-title">Budget (fallback)</div>
                    {(restaurantForm.budget || []).map((item, index) => (
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
                    {(restaurantForm.premium || []).map((item, index) => (
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
                      {(restaurantForm.menuCategories?.[categoryKey] || []).map((item, index) => (
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

              <button type="button" className="admin-btn primary" onClick={saveRestaurant} disabled={loading}>
                {loading ? "Saving..." : editingRestaurantId ? "Save changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
