import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./css/Favorites.css";
import { withRestaurantImage } from "../data/restaurantImages";

export default function Favorites() {
  const navigate = useNavigate();
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const token = localStorage.getItem("token");

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${apiBaseUrl}/api/users/favorites`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load favorites");
        }

        setRestaurants((data.restaurants || []).map(withRestaurantImage));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [apiBaseUrl, token]);

  const handleRemoveFavorite = async (restaurantId) => {
    try {
      setRemovingId(restaurantId);
      setError("");

      const response = await fetch(`${apiBaseUrl}/api/users/favorites/${restaurantId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to remove favorite");
      }

      setRestaurants((prev) => prev.filter((item) => item.id !== restaurantId));
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId("");
    }
  };

  return (
    <div className="favorites-page">
      <div className="favorites-header">
        <div>
          <h2>My Favorites</h2>
          <p>{restaurants.length} saved places</p>
        </div>
        <button type="button" onClick={() => navigate(-1)} className="back-btn">
          Back
        </button>
      </div>

      {loading ? <p className="favorites-note">Loading favorites...</p> : null}
      {error ? <p className="favorites-error">{error}</p> : null}
      {!loading && !error && restaurants.length === 0 ? (
        <div className="favorites-empty">
          <h3>No favorites yet</h3>
          <p>Save restaurants from the details page and they will appear here.</p>
          <button type="button" onClick={() => navigate("/")}>
            Explore restaurants
          </button>
        </div>
      ) : null}

      <div className="favorites-grid">
        {restaurants.map((restaurant) => (
          <article className="favorite-card" key={restaurant.id}>
            <div className="favorite-image-wrap">
              <img src={restaurant.image} alt={restaurant.name} />
              <span className="favorite-badge">Saved</span>
            </div>

            <div className="favorite-content">
              <h3>{restaurant.name}</h3>
              <p className="favorite-location">{restaurant.location}</p>

              <div className="favorite-meta">
                <span>* {restaurant.rating}</span>
                <span>{restaurant.reviews} reviews</span>
                <span>Ranking {restaurant.rankingScore ?? restaurant.aiScore ?? 0}</span>
              </div>

              <div className="favorite-actions">
                <button
                  type="button"
                  className="details-btn"
                  onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                >
                  View Details
                </button>
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => handleRemoveFavorite(restaurant.id)}
                  disabled={removingId === restaurant.id}
                >
                  {removingId === restaurant.id ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

