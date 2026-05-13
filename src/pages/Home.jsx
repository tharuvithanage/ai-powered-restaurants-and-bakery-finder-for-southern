import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./css/Home.css";
import FilterPanel from "./components/FilterPanel";
import RestaurantCard from "./components/RestaurantCard";
import StatsBar from "./components/StatsBar";
import Chatbot from "./components/Chatbot";
import RestaurantMap from "./components/RestaurantMap";
import { withRestaurantImage } from "../data/restaurantImages";
import GoogleTranslateSwitcher from "../components/GoogleTranslateSwitcher";
import ProfileMenu from "./components/ProfileMenu";
import { Globe } from "../components/icons/Lucide";

const CURRENT_LOCATION_VALUE = "__CURRENT__";

const initialFilters = {
  search: "",
  location: "Any",
  price: "Any",
  minRating: 0,
  maxDistanceKm: 10,
};

export default function Home() {
  const navigate = useNavigate();
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const token = localStorage.getItem("token");
  const isLoggedIn = Boolean(token);

  const [restaurants, setRestaurants] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [summary, setSummary] = useState({
    overallScore: 0,
    totalResults: 0,
    topRecommendation: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [currentCoords, setCurrentCoords] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  });
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const userName = useMemo(() => currentUser.name || "User", [currentUser]);
  const avatarUrl = useMemo(() => currentUser.avatarUrl || "", [currentUser]);
  const userInitials = useMemo(() => {
    const parts = userName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, [userName]);

  const cardsPerSlide = useMemo(() => {
    if (viewportWidth < 700) return 1;
    if (viewportWidth < 1100) return 2;
    return 4;
  }, [viewportWidth]);

  const carouselPages = useMemo(() => {
    if (!filtered.length) return [];

    const pages = [];
    for (let index = 0; index < filtered.length; index += cardsPerSlide) {
      const pageItems = filtered.slice(index, index + cardsPerSlide);

      // Keep every slide visually full like a classic carousel row.
      if (pageItems.length < cardsPerSlide && filtered.length > cardsPerSlide) {
        const remainingSlots = cardsPerSlide - pageItems.length;
        pageItems.push(...filtered.slice(0, remainingSlots));
      }

      pages.push(pageItems);
    }

    return pages;
  }, [cardsPerSlide, filtered]);

  const refreshUserProfile = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${apiBaseUrl}/api/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return;
      const data = await response.json();
      if (!data?.user) return;

      localStorage.setItem("user", JSON.stringify(data.user));
      setCurrentUser(data.user);
      setAvatarBroken(false);
    } catch {
      // Keep current UI state if profile refresh fails.
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    const syncUserFromStorage = () => {
      try {
        setCurrentUser(JSON.parse(localStorage.getItem("user") || "{}"));
        setAvatarBroken(false);
      } catch {
        setCurrentUser({});
        setAvatarBroken(false);
      }
    };
    const handleFocus = () => {
      syncUserFromStorage();
      refreshUserProfile();
    };

    window.addEventListener("storage", syncUserFromStorage);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", syncUserFromStorage);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshUserProfile]);

  useEffect(() => {
    refreshUserProfile();
  }, [refreshUserProfile]);

  const loadRestaurants = useCallback(
    async (currentFilters = initialFilters, locationCoords = null) => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();

        if (currentFilters.search.trim()) {
          params.set("search", currentFilters.search.trim());
        }

        if (currentFilters.location !== "Any") {
          if (currentFilters.location === CURRENT_LOCATION_VALUE) {
            if (locationCoords) {
              params.set("fromLat", String(locationCoords.lat));
              params.set("fromLng", String(locationCoords.lng));
            }
          } else {
            params.set("location", currentFilters.location);
            params.set("fromLocation", currentFilters.location);
          }
          params.set("maxDistanceKm", String(currentFilters.maxDistanceKm));
        }

        if (currentFilters.price !== "Any") {
          params.set("price", currentFilters.price);
        }

        if (currentFilters.minRating > 0) {
          params.set("minRating", String(currentFilters.minRating));
        }

        const queryString = params.toString();
        const url = queryString
          ? `${apiBaseUrl}/api/restaurants?${queryString}`
          : `${apiBaseUrl}/api/restaurants`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load restaurants");
        }

        const normalized = (data.restaurants || []).map(withRestaurantImage);
        setRestaurants(normalized);
        setFiltered(normalized);
        setSummary(
          data.summary || {
            overallScore: 0,
            totalResults: normalized.length,
            topRecommendation: null,
          }
        );
      } catch (err) {
        setError(err.message);
        setSummary({ overallScore: 0, totalResults: 0, topRecommendation: null });
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const handleFilterChange = (field, value) => {
    if (field === "location" && value !== CURRENT_LOCATION_VALUE) {
      setGeoError("");
    }
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const requestCurrentLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported in this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: Number(position.coords.latitude),
            lng: Number(position.coords.longitude),
          });
        },
        (geoPermissionError) => {
          reject(
            new Error(
              geoPermissionError?.message ||
                "Unable to access your location. Please select a location manually."
            )
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported in this browser.");
      return;
    }

    setGeoLoading(true);
    setGeoError("");

    try {
      const nextCoords = await requestCurrentLocation();
      setCurrentCoords(nextCoords);
      setFilters((prev) => ({ ...prev, location: CURRENT_LOCATION_VALUE }));
    } catch (geoPermissionError) {
      setGeoError(geoPermissionError.message);
    } finally {
      setGeoLoading(false);
    }
  };

  const handleApplyFilters = async () => {
    if (filters.location === CURRENT_LOCATION_VALUE && !currentCoords) {
      setGeoLoading(true);
      setGeoError("");
      try {
        const nextCoords = await requestCurrentLocation();
        setCurrentCoords(nextCoords);
        loadRestaurants(filters, nextCoords);
        return;
      } catch (geoPermissionError) {
        setGeoError(
          geoPermissionError.message ||
            "Tap 'Use my current location' first, or choose a manual location."
        );
        return;
      } finally {
        setGeoLoading(false);
      }
    }

    loadRestaurants(filters, currentCoords);
  };

  const handleResetFilters = () => {
    setGeoError("");
    setFilters(initialFilters);
    loadRestaurants(initialFilters, null);
  };

  const goToSlide = (index) => {
    if (carouselPages.length === 0) return;
    if (index < 0) {
      setCurrentSlide(carouselPages.length - 1);
      return;
    }
    if (index >= carouselPages.length) {
      setCurrentSlide(0);
      return;
    }
    setCurrentSlide(index);
  };

  const handleNextSlide = () => {
    goToSlide(currentSlide + 1);
  };

  const handlePrevSlide = () => {
    goToSlide(currentSlide - 1);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser({});
    navigate("/login");
  };

  useEffect(() => {
    loadRestaurants(initialFilters, null);
  }, [loadRestaurants]);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (carouselPages.length === 0) {
      setCurrentSlide(0);
      return;
    }

    if (currentSlide > carouselPages.length - 1) {
      setCurrentSlide(0);
    }
  }, [carouselPages.length, currentSlide]);
  useEffect(() => {
    if (carouselPages.length <= 1 || loading) return undefined;

    const autoSlide = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselPages.length);
    }, 5000);

    return () => window.clearInterval(autoSlide);
  }, [carouselPages.length, loading]);

  return (
    <div className="home-container">
      <div className="ambient-bg" aria-hidden="true">
        <span className="ambient-blob blob-a" />
        <span className="ambient-blob blob-b" />
        <span className="ambient-blob blob-c" />
      </div>
      <header className="navbar">
        <div className="nav-left">
          <h2 className="dynamic-title">Restaurant & Bakery Finder</h2>
          <span className="tagline">South Coast, Sri Lanka</span>
        </div>

        <div className="nav-right">
          <div className="nav-control home-lang-switcher" aria-label="Language selector">
            <Globe className="nav-icon" size={18} />
            <GoogleTranslateSwitcher hideLabel label="Language" className="lang-inline" />
          </div>
          {!isLoggedIn ? (
            <>
              <button className="nav-btn outline" onClick={() => navigate("/login")}>
                Login
              </button>
              <button className="nav-btn primary" onClick={() => navigate("/register")}>
                Sign Up
              </button>
            </>
          ) : (
            <div className="user-box">
              <ProfileMenu
                userName={userName}
                avatarUrl={avatarUrl}
                userInitials={userInitials}
                avatarBroken={avatarBroken}
                onAvatarBroken={() => setAvatarBroken(true)}
                onOpenProfile={() => navigate("/profile")}
                onGoFavorites={() => navigate("/favorites")}
                showAdminPanel={Boolean(currentUser?.role === "admin" || currentUser?.role === "owner")}
                adminLabel={currentUser?.role === "owner" ? "Owner Panel" : "Admin Panel"}
                onGoAdminPanel={() =>
                  navigate(currentUser?.role === "owner" ? "/owner" : "/admin")
                }
                onLogout={handleLogout}
              />
            </div>
          )}
        </div>
      </header>

      <div className="map-section reveal-lift">
          <div className="map-overlay">
            <div className="map-overlay-title">
              <h3>Coastal Food Map</h3>
              <p>Explore South Coast spots with distance-aware recommendations</p>
              <div className="map-legend" aria-label="Map marker legend">
                <span>🍕 Restaurant</span>
                <span>🧁 Bakery</span>
                <span>☕ Cafe</span>
              </div>
            </div>
          <div className="map-overlay-pills">
            <span className="map-pill">{filtered.length} Spots</span>
            {summary?.topRecommendation?.name ? (
              <span className="map-pill top-pick">Top: {summary.topRecommendation.name}</span>
            ) : null}
          </div>
        </div>
        <RestaurantMap
          restaurants={filtered}
          topRecommendationId={summary?.topRecommendation?.id || ""}
          filters={filters}
          currentCoords={currentCoords}
          currentLocationValue={CURRENT_LOCATION_VALUE}
        />
      </div>

      <FilterPanel
        filters={filters}
        onChange={handleFilterChange}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        resultCount={filtered.length}
        currentLocationValue={CURRENT_LOCATION_VALUE}
        onUseCurrentLocation={handleUseCurrentLocation}
        geoLoading={geoLoading}
        geoError={geoError}
        currentLocationLabel={
          currentCoords
            ? `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}`
            : ""
        }
      />
      <StatsBar summary={summary} loading={loading} />

      {!loading && !error && filtered.length === 0 ? (
        <div className="home-status home-status-empty" role="status" aria-live="polite">
          <h3>No matches yet</h3>
          <p>Try loosening filters (or reset to see all restaurants and bakeries).</p>
          <div className="home-status-actions">
            <button type="button" className="home-status-btn" onClick={handleResetFilters}>
              Reset filters
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="home-status" role="status" aria-live="polite">
          Loading restaurants…
        </div>
      ) : null}
      {error ? (
        <div className="home-status home-status-error" role="status" aria-live="polite">
          {error}
        </div>
      ) : null}

      <section className="carousel-section reveal-lift" aria-label="Restaurant and bakery carousel">
        <div className="carousel-head">
          <h3>Restaurants & Bakeries</h3>
        </div>

        {!loading && !error && carouselPages.length > 0 ? (
          <>
            <div className="carousel-shell">
              <button
                type="button"
                className="carousel-arrow"
                aria-label="Previous slide"
                onClick={handlePrevSlide}
              >
                &#10094;
              </button>

              <div className="carousel-viewport">
                <div
                  className="carousel-track"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {carouselPages.map((page, pageIndex) => (
                    <div
                      className="carousel-page"
                      style={{ "--cards-per-slide": cardsPerSlide }}
                      key={`page-${pageIndex}`}
                    >
                      {page.map((restaurant, cardIndex) => (
                        <div
                          className="card-slide"
                          key={`${restaurant.id}-${pageIndex}-${cardIndex}`}
                          style={{ "--card-delay": `${cardIndex * 90}ms` }}
                        >
                          <RestaurantCard data={restaurant} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="carousel-arrow"
                aria-label="Next slide"
                onClick={handleNextSlide}
              >
                &#10095;
              </button>
            </div>

            {carouselPages.length > 1 ? (
              <div className="carousel-dots" aria-label="Carousel pagination">
                {carouselPages.map((_, index) => (
                  <button
                    type="button"
                    key={`dot-${index}`}
                    className={`carousel-dot ${index === currentSlide ? "active" : ""}`}
                    onClick={() => goToSlide(index)}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <Chatbot
        restaurants={restaurants}
        setFiltered={setFiltered}
        setSummary={setSummary}
        apiBaseUrl={apiBaseUrl}
      />
    </div>
  );
}
