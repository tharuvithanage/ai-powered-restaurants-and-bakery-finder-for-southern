import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./css/RestaurantDetails.css";
import { withRestaurantImage } from "../data/restaurantImages";
import { normalizePriceRange } from "../utils/priceRange";

const parsePriceValue = (priceText = "") => {
  const match = String(priceText).match(/(\d[\d.,]*)/);
  if (!match) return null;
  const normalized = match[0].replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const buildGoogleMapsQuery = (restaurant) => {
  const lat = restaurant?.coordinates?.lat;
  const lng = restaurant?.coordinates?.lng;
  if (typeof lat === "number" && typeof lng === "number") return `${lat},${lng}`;

  return restaurant?.mapQuery || restaurant?.address || restaurant?.name || "";
};

export default function RestaurantDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const token = localStorage.getItem("token");

  const [restaurant, setRestaurant] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [maxMenuPrice, setMaxMenuPrice] = useState(0);
  const [isMenuFilterActive, setIsMenuFilterActive] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewSubmitLoading, setReviewSubmitLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: "",
  });

  const loadReviews = useCallback(async () => {
    try {
      setReviewLoading(true);
      setReviewError("");
      const response = await fetch(`${apiBaseUrl}/api/restaurants/${id}/reviews`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load reviews");
      }

      setReviews(data.reviews || []);
      setReviewSummary(data.summary || null);
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewLoading(false);
    }
  }, [apiBaseUrl, id]);

  useEffect(() => {
    let isMounted = true;

    const loadRestaurant = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${apiBaseUrl}/api/restaurants/${id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load restaurant");
        }

        if (!isMounted) return;
        setRestaurant(withRestaurantImage(data.restaurant));
      } catch (err) {
        if (!isMounted) return;
        setError(err.message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRestaurant();

    const loadSecondaryData = async () => {
      try {
        const weatherResponse = await fetch(`${apiBaseUrl}/api/restaurants/${id}/weather`);
        const weatherData = await weatherResponse.json();
        if (!isMounted) return;
        if (weatherResponse.ok && weatherData.weather) {
          setWeather(weatherData.weather);
        } else {
          setWeather(null);
        }
      } catch {
        if (isMounted) {
          setWeather(null);
        }
      }

      if (token) {
        try {
          const favoritesResponse = await fetch(`${apiBaseUrl}/api/users/favorites`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const favoritesData = await favoritesResponse.json();
          if (!isMounted) return;
          if (favoritesResponse.ok) {
            setIsFavorite((favoritesData.favorites || []).includes(id));
          }
        } catch {
          // Ignore favorites fetch errors on initial load to keep page responsive.
        }
      }
    };

    loadSecondaryData();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, id, token]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleToggleFavorite = async () => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setFavoriteLoading(true);
      const method = isFavorite ? "DELETE" : "POST";
      const response = await fetch(`${apiBaseUrl}/api/users/favorites/${id}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update favorites");
      }

      setIsFavorite((data.favorites || []).includes(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const googleMapsUrl = useMemo(() => {
    const query = buildGoogleMapsQuery(restaurant);
    if (!query) return "";
    return `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
  }, [restaurant]);

  const handleSubmitReview = async (event) => {
    event.preventDefault();

    if (!token) {
      navigate("/login");
      return;
    }

    const trimmedComment = reviewForm.comment.trim();
    if (trimmedComment.length < 5) {
      setReviewError("Please add at least 5 characters in your review.");
      return;
    }

    try {
      setReviewSubmitLoading(true);
      setReviewError("");

      const response = await fetch(`${apiBaseUrl}/api/restaurants/${id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: Number(reviewForm.rating),
          comment: trimmedComment,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to submit review");
      }

      setReviewForm({ rating: 5, comment: "" });
      loadReviews();
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewSubmitLoading(false);
    }
  };

  const isSweetShop = useMemo(() => {
    if (!restaurant) return false;

    const searchableText = [
      restaurant.name,
      restaurant.vibe,
      ...(restaurant.dietaryTags || []),
      ...(restaurant.goodFor || []),
    ]
      .join(" ")
      .toLowerCase();

    return (
      searchableText.includes("dessert") ||
      searchableText.includes("sweet") ||
      searchableText.includes("watalappan")
    );
  }, [restaurant]);

  const menuSections = useMemo(() => {
    if (!restaurant) {
      return [
        { key: "breakfast", label: "Breakfast", items: [] },
        { key: "main", label: "Main", items: [] },
        { key: "drinks", label: "Drinks", items: [] },
      ];
    }

    const fromBackend = restaurant.menuCategories || {};
    const backendBreakfast = Array.isArray(fromBackend.breakfast) ? fromBackend.breakfast : [];
    const backendMain = Array.isArray(fromBackend.main) ? fromBackend.main : [];
    const backendDrinks = Array.isArray(fromBackend.drinks) ? fromBackend.drinks : [];

    const budgetMenu = Array.isArray(restaurant.budget) ? restaurant.budget : [];
    const premiumMenu = Array.isArray(restaurant.premium) ? restaurant.premium : [];

    const mergeMenuItems = (primaryItems, fallbackItems) => {
      if (primaryItems.length === 0) return fallbackItems;
      if (fallbackItems.length === 0) return primaryItems;

      const seen = new Set();
      return [...fallbackItems, ...primaryItems].filter((item) => {
        const key = `${item?.name || ""}|${item?.price || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const drinkKeywords = [
      "coffee",
      "latte",
      "tea",
      "juice",
      "smoothie",
      "iced",
      "milo",
      "soda",
      "cocktail",
      "mocktail",
      "beer",
      "wine",
      "martini",
    ];

    const budgetDrinks = [];
    const budgetFoods = [];
    budgetMenu.forEach((item) => {
      const name = String(item?.name || "").toLowerCase();
      const isDrink = drinkKeywords.some((keyword) => name.includes(keyword));
      if (isDrink) {
        budgetDrinks.push(item);
      } else {
        budgetFoods.push(item);
      }
    });

    return [
      {
        key: "breakfast",
        label: isSweetShop ? "Popular Sweets" : "Breakfast",
        items: mergeMenuItems(backendBreakfast, budgetFoods),
      },
      {
        key: "main",
        label: isSweetShop ? "Watalappan Sizes" : "Main",
        items: mergeMenuItems(backendMain, premiumMenu),
      },
      {
        key: "drinks",
        label: "Drinks",
        items: mergeMenuItems(backendDrinks, budgetDrinks),
      },
    ];
  }, [isSweetShop, restaurant]);

  const allMenuItems = useMemo(
    () =>
      menuSections
        .flatMap((section) => section.items || [])
        .filter((item) => item?.name && item?.price),
    [menuSections]
  );

  const priceStats = useMemo(() => {
    const values = allMenuItems
      .map((item) => parsePriceValue(item.price))
      .filter((value) => typeof value === "number")
      .sort((a, b) => a - b);

    if (values.length === 0) return null;

    const min = values[0];
    const max = values[values.length - 1];
    const median = values[Math.floor(values.length / 2)];
    const lowerIndex = Math.floor(values.length / 3);
    const upperIndex = Math.floor((values.length * 2) / 3);

    return {
      min,
      median,
      max,
      lowCutoff: values[lowerIndex] ?? min,
      highCutoff: values[upperIndex] ?? median,
    };
  }, [allMenuItems]);

  const getPriceBadge = useCallback(
    (value) => {
      if (!priceStats || typeof value !== "number") return null;
      if (value <= priceStats.lowCutoff) return { key: "budget", label: "Budget pick" };
      if (value <= priceStats.highCutoff) return { key: "mid", label: "Mid-range" };
      return { key: "premium", label: "Premium treat" };
    },
    [priceStats]
  );

  const priceRangeLabel = useMemo(() => {
    if (!priceStats) return "Price data coming soon";

    const formatValue = (value) => `Rs. ${Number(value).toLocaleString()}`;

    return `${formatValue(priceStats.min)} – ${formatValue(priceStats.max)} (median ${formatValue(
      priceStats.median
    )})`;
  }, [priceStats]);

  const sentimentSummary = useMemo(() => {
    if (!reviewSummary || !reviewSummary.totalReviews) return null;

    const { sentimentCounts = {}, topicMentions = {} } = reviewSummary;
    const total = Number(reviewSummary.totalReviews) || 0;
    if (total === 0) return null;

    const positive = Number(sentimentCounts.positive || 0);
    const neutral = Number(sentimentCounts.neutral || 0);

    const toPercent = (value) => Math.round((value / total) * 100);
    const positivePercent = toPercent(positive);
    const neutralPercent = toPercent(neutral);
    const negativePercent = Math.max(0, 100 - positivePercent - neutralPercent);

    let headline = "Generally well-reviewed";
    if (positivePercent >= 75) headline = "Guests rave about this place";
    else if (negativePercent >= 35) headline = "Recent feedback is mixed";
    else if (positivePercent >= 55) headline = "Mostly positive experiences";

    const topicEntries = Object.entries(topicMentions || {})
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]));

    const topicLabels = {
      food: "food quality",
      service: "service",
      price: "value for money",
      ambience: "ambience",
    };

    const topTopic = topicEntries.length > 0 ? topicEntries[0][0] : null;
    const topicText = topTopic
      ? `Most mentions focus on ${topicLabels[topTopic] || topTopic}.`
      : "";

    const description = `${positivePercent}% positive (${total} reviews). ${topicText}`.trim();

    return {
      headline,
      description,
      stats: [
        { label: "Positive", value: `${positivePercent}%`, tone: "positive" },
        { label: "Neutral", value: `${neutralPercent}%`, tone: "neutral" },
        { label: "Negative", value: `${negativePercent}%`, tone: "negative" },
      ],
      averageRating: Number(reviewSummary.averageRating || 0).toFixed(1),
    };
  }, [reviewSummary]);

  const maxDetectedMenuPrice = useMemo(() => {
    const values = allMenuItems
      .map((item) => parsePriceValue(item.price))
      .filter((value) => typeof value === "number");

    return values.length > 0 ? Math.max(...values) : 5000;
  }, [allMenuItems]);

  useEffect(() => {
    if (!restaurant) return;
    setMaxMenuPrice(maxDetectedMenuPrice);
    setIsMenuFilterActive(false);
  }, [maxDetectedMenuPrice, restaurant]);

  const filteredSections = useMemo(() => {
    if (!isMenuFilterActive) {
      return menuSections;
    }

    const priceLimit = maxMenuPrice || maxDetectedMenuPrice;
    return menuSections.map((section) => ({
      ...section,
      items: (section.items || []).filter((item) => {
        const value = parsePriceValue(item.price);
        return value === null || value <= priceLimit;
      }),
    }));
  }, [isMenuFilterActive, maxDetectedMenuPrice, maxMenuPrice, menuSections]);

  const quickFacts = useMemo(
    () => [
      {
        icon: "🕒",
        label: "Best Time",
        value: restaurant?.bestTime || "Anytime",
      },
      {
        icon: "🎯",
        label: "Good For",
        value:
          Array.isArray(restaurant?.goodFor) && restaurant.goodFor.length > 0
            ? restaurant.goodFor.slice(0, 3).join(" • ")
            : "Casual visits",
      },
      {
        icon: "⭐",
        label: "Rating",
        value: `${Number(restaurant?.rating || 0).toFixed(1)} (${restaurant?.reviews || 0} reviews)`,
      },
      {
        icon: "💸",
        label: "Price",
        value: normalizePriceRange(restaurant?.price) || "-",
      },
      {
        icon: "📍",
        label: "Address",
        value: restaurant?.address || restaurant?.location || "-",
      },
      {
        icon: "🌤",
        label: "Today",
        value: weather ? `${weather.temperatureC}°C • ${weather.description}` : "Weather unavailable",
      },
    ],
    [restaurant, weather]
  );

  const galleryItems = useMemo(() => {
    if (!restaurant) return [];

    const placeholder = {
      type: "placeholder",
      title: restaurant.location || "South Coast",
      subtitle: restaurant.vibe || "Coastal vibes",
    };

    const sourceList = Array.isArray(restaurant.galleryImages) && restaurant.galleryImages.length > 0
      ? restaurant.galleryImages
      : (restaurant.image ? [restaurant.image] : []);

    const uniqueSources = Array.from(new Set(sourceList));

    const images = uniqueSources.slice(0, 4).map((src, index) => ({
      type: "image",
      src,
      alt: `${restaurant.name} view ${index + 1}`,
    }));

    return [...images, placeholder].slice(0, 5);
  }, [restaurant]);

  useEffect(() => {
    if (galleryIndex === null) return;
    if (galleryItems.length === 0) {
      setGalleryIndex(null);
      return;
    }
    if (galleryIndex > galleryItems.length - 1) {
      setGalleryIndex(0);
    }
  }, [galleryIndex, galleryItems.length]);

  const handleGalleryClose = () => setGalleryIndex(null);
  const handleGalleryPrev = () => {
    if (!galleryItems.length) return;
    setGalleryIndex((prev) => {
      if (prev === null) return 0;
      return (prev - 1 + galleryItems.length) % galleryItems.length;
    });
  };
  const handleGalleryNext = () => {
    if (!galleryItems.length) return;
    setGalleryIndex((prev) => {
      if (prev === null) return 0;
      return (prev + 1) % galleryItems.length;
    });
  };
  const canNavigateGallery = galleryItems.length > 1;
  const activeGalleryItem =
    galleryIndex !== null && galleryItems[galleryIndex] ? galleryItems[galleryIndex] : null;
  const galleryCounterLabel =
    galleryIndex !== null && galleryItems.length > 0
      ? `${galleryIndex + 1} / ${galleryItems.length}`
      : "";
  const galleryCaptionSubtitle =
    activeGalleryItem?.type === "image"
      ? restaurant?.location || restaurant?.vibe || ""
      : activeGalleryItem?.subtitle || restaurant?.location || "";

  const menuHighlights = useMemo(() => {
    const items = allMenuItems.map((item) => ({
      ...item,
      parsedPrice: parsePriceValue(item.price),
    }));
    const priced = items.filter((item) => typeof item.parsedPrice === "number");

    const chefPicks = (priced.length > 0
      ? [...priced].sort((a, b) => b.parsedPrice - a.parsedPrice)
      : items
    ).slice(0, 3);

    const bestValue = (priced.length > 0
      ? [...priced].sort((a, b) => a.parsedPrice - b.parsedPrice)
      : items
    ).slice(0, 3);

    return { chefPicks, bestValue };
  }, [allMenuItems]);

  const aiFactors = useMemo(
    () => [
      {
        label: "Rating quality",
        weight: 40,
        value: Number(restaurant?.scoreBreakdown?.ratingScore || 0),
      },
      {
        label: "Review confidence",
        weight: 20,
        value: Number(restaurant?.scoreBreakdown?.reviewConfidenceScore || 0),
      },
      {
        label: "Distance fit",
        weight: 20,
        value: Number(restaurant?.scoreBreakdown?.distanceScore || 0),
      },
      {
        label: "Budget match",
        weight: 10,
        value: Number(restaurant?.scoreBreakdown?.priceMatchScore || 0),
      },
      {
        label: "Preference match",
        weight: 10,
        value: Number(restaurant?.scoreBreakdown?.preferenceMatchScore || 0),
      },
    ],
    [restaurant]
  );

  const formatReviewDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString();
  };

  if (loading) return <h2 style={{ padding: 40 }}>Loading restaurant...</h2>;
  if (error) return <h2 style={{ padding: 40 }}>{error}</h2>;
  if (!restaurant) return <h2 style={{ padding: 40 }}>Restaurant not found</h2>;

  return (
    <div className="details-wrapper">
      <div className="details-page split-layout">
        <div className="details-left">
          <div className="details-hero">
            <img src={restaurant.image} alt={restaurant.name} className="details-img" />
            <div className="hero-text">
              <h1>{restaurant.name}</h1>
              <span>{restaurant.location}</span>
            </div>
          </div>

          <div className="details-content">
            <button className="back-btn" onClick={() => navigate(-1)}>
              Back
            </button>

            <div className="badge-row">
              <span className="badge">{restaurant.rating}</span>
              <span className="badge">
                Ranking {restaurant.rankingScore ?? restaurant.aiScore ?? 0}
              </span>
              <span className="badge">{normalizePriceRange(restaurant.price) || restaurant.price}</span>
            </div>

            <button type="button" className="ai-formula-btn" onClick={() => setShowAiModal(true)}>
              Explain ranking score
            </button>

            <section className="quick-facts-grid">
              {quickFacts.map((fact) => (
                <div key={fact.label} className="quick-fact-card">
                  <span className="quick-fact-icon" aria-hidden="true">
                    {fact.icon}
                  </span>
                  <small>{fact.label}</small>
                  <b>{fact.value}</b>
                </div>
              ))}
            </section>

            <section className="gallery-strip">
              <h4>Gallery</h4>
              <div className="gallery-row">
                {galleryItems.map((item, index) => (
                  <button
                    key={`${item.type}-${index}`}
                    type="button"
                    className={`gallery-thumb ${item.type === "placeholder" ? "placeholder" : ""}`}
                    onClick={() => setGalleryIndex(index)}
                  >
                    {item.type === "image" ? (
                      <img
                        src={item.src}
                        alt={item.alt}
                        className={`gallery-tone-${index % 4}`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="gallery-fallback">
                        <b>{item.title}</b>
                        <span>{item.subtitle}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <p className="vibe">{restaurant.vibe}</p>

            <div className="vibe-box">
              <h4>Why you&apos;ll love this place</h4>
              <p>{restaurant.desc}</p>
            </div>

            <p>
              <b>Best time to visit:</b> {restaurant.bestTime}
            </p>

            <div className="good-for">
              {(restaurant.goodFor || []).map((item) => (
                <span key={item} className="good-tag">
                  #{item}
                </span>
              ))}
            </div>

            <div className="dietary-section">
              <h4>Dietary tags</h4>
              <div className="dietary-tags">
                {(restaurant.dietaryTags || []).length > 0 ? (
                  (restaurant.dietaryTags || []).map((tag) => (
                    <span key={tag} className="dietary-tag">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="dietary-empty">No dietary tags available yet.</span>
                )}
              </div>
            </div>

            <div className="vibe-meter">
              <small>Coastal vibe level</small>
              <div className="vibe-bar"></div>
            </div>

            <section className="menu-highlights">
              <div className="highlight-box">
                <h4>Chef picks</h4>
                <ul>
                  {menuHighlights.chefPicks.map((item, index) => {
                    const badge = getPriceBadge(parsePriceValue(item.price));
                    return (
                      <li key={`chef-${item.name}-${index}`}>
                        <span>{item.name}</span>
                        <div className="price-right">
                          <b>{item.price}</b>
                          {badge ? <span className={`price-badge ${badge.key}`}>{badge.label}</span> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="highlight-box">
                <h4>Best value</h4>
                <ul>
                  {menuHighlights.bestValue.map((item, index) => {
                    const badge = getPriceBadge(parsePriceValue(item.price));
                    return (
                      <li key={`value-${item.name}-${index}`}>
                        <span>{item.name}</span>
                        <div className="price-right">
                          <b>{item.price}</b>
                          {badge ? <span className={`price-badge ${badge.key}`}>{badge.label}</span> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            <div className="menu-filter-box">
              <div className="menu-filter-head">
                <h4>Menu explorer</h4>
                <span>
                  {isMenuFilterActive
                    ? `Up to Rs. ${maxMenuPrice.toLocaleString()}`
                    : "Showing all prices"}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max={maxDetectedMenuPrice}
                step="50"
                value={isMenuFilterActive ? maxMenuPrice : maxDetectedMenuPrice}
                onChange={(e) => {
                  setIsMenuFilterActive(true);
                  setMaxMenuPrice(Number(e.target.value));
                }}
              />
              <p className="price-range-hint">
                <strong>Sample price spread:</strong> {priceRangeLabel}
              </p>
            </div>

            <div className="food-sections">
              {filteredSections.map((section) => (
                <div
                  key={section.key}
                  className={`food-box ${section.key === "main" ? "premium" : "budget"}`}
                >
                  <h4>{section.label}</h4>
                  <ul>
                    {(section.items || []).map((item, index) => {
                      const badge = getPriceBadge(parsePriceValue(item.price));
                      return (
                        <li key={`${item.name}-${index}`}>
                          <span>{item.name}</span>
                          <div className="price-right">
                            <b>{item.price}</b>
                            {badge ? <span className={`price-badge ${badge.key}`}>{badge.label}</span> : null}
                          </div>
                        </li>
                      );
                    })}
                    {(section.items || []).length === 0 ? (
                      <li className="menu-empty">No items in this price range.</li>
                    ) : null}
                  </ul>
                </div>
              ))}
            </div>

            <div className="details-actions">
              <button
                type="button"
                className={`save-btn ${isFavorite ? "saved" : ""}`}
                onClick={handleToggleFavorite}
                disabled={favoriteLoading}
              >
                {favoriteLoading ? "Saving..." : isFavorite ? "Saved" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => (googleMapsUrl ? window.open(googleMapsUrl) : null)}
                disabled={!googleMapsUrl}
              >
                Open in Maps
              </button>
            </div>

            <section className="reviews-section">
              <div className="reviews-head">
                <h4>User reviews</h4>
                <span>{reviewSummary?.totalReviews || 0} total</span>
              </div>

              {sentimentSummary ? (
                <div className="sentiment-summary-card">
                  <div className="sentiment-summary-main">
                    <small>Overall mood</small>
                    <h5>{sentimentSummary.headline}</h5>
                    <p>{sentimentSummary.description}</p>
                    <span className="sentiment-average">
                      Avg rating {sentimentSummary.averageRating}/5
                    </span>
                  </div>
                  <div className="sentiment-summary-stats">
                    {sentimentSummary.stats.map((stat) => (
                      <div key={stat.label} className={`sentiment-stat ${stat.tone}`}>
                        <small>{stat.label}</small>
                        <strong>{stat.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {token ? (
                <form className="review-form" onSubmit={handleSubmitReview}>
                  <label>
                    Rating
                    <select
                      value={reviewForm.rating}
                      onChange={(e) =>
                        setReviewForm((prev) => ({ ...prev, rating: Number(e.target.value) }))
                      }
                    >
                      <option value={5}>5 - Excellent</option>
                      <option value={4}>4 - Good</option>
                      <option value={3}>3 - Average</option>
                      <option value={2}>2 - Poor</option>
                      <option value={1}>1 - Bad</option>
                    </select>
                  </label>

                  <label>
                    Review
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={reviewForm.comment}
                      onChange={(e) =>
                        setReviewForm((prev) => ({ ...prev, comment: e.target.value }))
                      }
                      placeholder="Share your experience..."
                    />
                  </label>

                  <button type="submit" disabled={reviewSubmitLoading}>
                    {reviewSubmitLoading ? "Submitting..." : "Submit review"}
                  </button>
                </form>
              ) : (
                <p className="review-login-note">
                  Login to add your review and help improve sentiment insights.
                </p>
              )}

              {reviewError ? <p className="reviews-error">{reviewError}</p> : null}

              {reviewSummary ? (
                <div className="review-stats">
                  <span>Avg rating: {Number(reviewSummary.averageRating || 0).toFixed(1)}</span>
                  <span>Positive: {reviewSummary.sentimentCounts?.positive || 0}</span>
                  <span>Neutral: {reviewSummary.sentimentCounts?.neutral || 0}</span>
                  <span>Negative: {reviewSummary.sentimentCounts?.negative || 0}</span>
                </div>
              ) : null}

              {reviewLoading ? (
                <p className="reviews-empty">Loading reviews...</p>
              ) : reviews.length === 0 ? (
                <p className="reviews-empty">No user reviews yet.</p>
              ) : (
                <div className="reviews-list">
                  {reviews.map((review) => (
                    <article key={review.id} className="review-item">
                      <div className="review-item-head">
                        <strong>{review.userName}</strong>
                        <span>
                          {review.rating}/5 • {review.sentimentLabel}
                        </span>
                      </div>
                      <p>{review.comment}</p>
                      <small>{formatReviewDate(review.createdAt)}</small>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <aside className="details-right">
          <iframe
            title="Map"
            src={googleMapsUrl ? `${googleMapsUrl}&output=embed` : "about:blank"}
            loading="lazy"
          />

          <div className="side-card">
            <h4>Location</h4>
            <p>{restaurant.address}</p>
            <p>{restaurant.hours}</p>
          </div>

          <div className="side-card spotlight-card">
            <h4>At a glance</h4>
            <p>
              <b>Best time:</b> {restaurant.bestTime}
            </p>
            <p>
              <b>Price:</b> {normalizePriceRange(restaurant.price) || restaurant.price}
            </p>
            <div className="spot-tags">
              {(restaurant.goodFor || []).slice(0, 4).map((item) => (
                <span key={item} className="spot-tag">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="side-card weather-card">
            <h4>Current weather</h4>
            {weather ? (
              <>
                <p className="weather-temp">{weather.temperatureC}°C</p>
                <p>{weather.description}</p>
                <p>Feels like: {weather.feelsLikeC}°C</p>
                <p>Humidity: {weather.humidity}%</p>
                <p>Wind: {weather.windSpeedKmh} km/h</p>
              </>
            ) : (
              <p>Weather not available right now.</p>
            )}
          </div>

          <div className="side-card">
            <h4>What people say</h4>
            {(restaurant.reviewsPreview || []).map((review, index) => (
              <p key={`${review}-${index}`}>{review}</p>
            ))}
          </div>

          <div className="side-card">
            <h4>Nearby places</h4>
            <ul>
              {(restaurant.nearby || []).map((near, index) => (
                <li key={`${near}-${index}`}>{near}</li>
              ))}
            </ul>
          </div>

          <div className="side-card coastal-note-card">
            <h4>Island notes</h4>
            <ul>
              <li>
                <b>Golden hour</b>
                <span>{restaurant.bestTime || "5:30 PM - 6:30 PM"}</span>
              </li>
              <li>
                <b>Signature vibe</b>
                <span>{restaurant.vibe || "Coastal evening mood"}</span>
              </li>
              <li>
                <b>Dietary option</b>
                <span>{restaurant.dietaryTags?.[0] || "Vegetarian-friendly"}</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {showAiModal ? (
        <div className="ai-modal-overlay" onClick={() => setShowAiModal(false)}>
          <div
            className="ai-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Ranking score explanation"
          >
            <div className="ai-modal-head">
              <h3>Ranking score formula</h3>
              <button type="button" onClick={() => setShowAiModal(false)}>
                Close
              </button>
            </div>

            <p>
              Final ranking score = 40% Rating + 20% Review Confidence + 20% Distance Fit + 10%
              Budget Match + 10% Preference Match
            </p>

            <div className="ai-modal-grid">
              {aiFactors.map((factor) => (
                <div key={factor.label} className="ai-factor-card">
                  <div className="ai-factor-row">
                    <span>
                      {factor.label} ({factor.weight}%)
                    </span>
                    <b>{factor.value.toFixed(1)}</b>
                  </div>
                  <div className="ai-factor-bar">
                    <span style={{ width: `${Math.max(0, Math.min(100, factor.value * 10))}%` }} />
                  </div>
                  <small>Weighted: {((factor.value * factor.weight) / 100).toFixed(2)}</small>
                </div>
              ))}

              <div className="ai-factor-card ai-final-score">
                <span>Final score</span>
                <b>{Number(restaurant.rankingScore ?? restaurant.aiScore ?? 0).toFixed(1)}</b>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {galleryIndex !== null ? (
        <div className="gallery-modal-overlay" onClick={handleGalleryClose}>
          <div
            className="gallery-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${restaurant.name} gallery viewer`}
          >
            <div className="gallery-modal-head">
              <span className="gallery-modal-counter">{galleryCounterLabel}</span>
              <button
                type="button"
                className="gallery-modal-close"
                onClick={handleGalleryClose}
              >
                Close
              </button>
            </div>

            <div className="gallery-modal-main">
              {canNavigateGallery ? (
                <button
                  type="button"
                  className="gallery-modal-nav-btn gallery-nav-prev"
                  onClick={handleGalleryPrev}
                  aria-label="View previous image"
                >
                  &#10094;
                </button>
              ) : null}

              <div className="gallery-modal-media">
                {activeGalleryItem?.type === "image" ? (
                  <img src={activeGalleryItem.src} alt={activeGalleryItem.alt} />
                ) : (
                  <div className="gallery-modal-fallback">
                    <b>{activeGalleryItem?.title}</b>
                    <span>{activeGalleryItem?.subtitle}</span>
                  </div>
                )}
              </div>

              {canNavigateGallery ? (
                <button
                  type="button"
                  className="gallery-modal-nav-btn gallery-nav-next"
                  onClick={handleGalleryNext}
                  aria-label="View next image"
                >
                  &#10095;
                </button>
              ) : null}
            </div>

            {galleryItems.length > 1 ? (
              <div className="gallery-modal-dots" role="tablist" aria-label="Gallery navigation dots">
                {galleryItems.map((item, index) => {
                  const isActive = index === galleryIndex;
                  const label =
                    item.type === "image"
                      ? item.alt || `${restaurant.name} image ${index + 1}`
                      : item.title || `Slide ${index + 1}`;
                  return (
                    <button
                      key={`gallery-dot-${index}`}
                      type="button"
                      role="tab"
                      aria-label={label}
                      aria-selected={isActive}
                      className={`gallery-modal-dot ${isActive ? "active" : ""}`}
                      onClick={() => setGalleryIndex(index)}
                    />
                  );
                })}
              </div>
            ) : null}

            <div className="gallery-modal-caption">
              <b>{restaurant.name}</b>
              <span>{galleryCaptionSubtitle}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
