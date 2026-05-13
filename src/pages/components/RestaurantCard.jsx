import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { normalizePriceRange } from "../../utils/priceRange";

export default function RestaurantCard({ data }) {
  const navigate = useNavigate();
  const breakdown = data.scoreBreakdown;
  const rating = typeof data.rating === "number" ? data.rating : Number(data.rating || 0);
  const reviews = typeof data.reviews === "number" ? data.reviews : Number(data.reviews || 0);
  const rankingScore =
    typeof data.rankingScore === "number"
      ? data.rankingScore
      : typeof data.aiScore === "number"
        ? data.aiScore
        : Number(data.rankingScore ?? data.aiScore ?? 0);
  const distanceKm =
    typeof data.distanceKm === "number" ? data.distanceKm : Number(data.distanceKm ?? NaN);

  const scoreItems = breakdown
    ? [
        { label: "Rating quality", value: breakdown.ratingScore },
        { label: "Review confidence", value: breakdown.reviewConfidenceScore },
        { label: "Distance fit", value: breakdown.distanceScore },
        { label: "Budget match", value: breakdown.priceMatchScore },
        { label: "Preference match", value: breakdown.preferenceMatchScore },
      ]
    : [];

  const handleViewDetails = useCallback(() => {
    navigate(`/restaurant/${data.id}`);
  }, [data.id, navigate]);

  const handleKeyDown = (event) => {
    const target = event.target;
    if (target && typeof target.closest === "function") {
      const isInteractive = target.closest(
        "details,summary,button,a,input,select,textarea,[role='button']"
      );
      if (isInteractive) return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleViewDetails();
    }
  };

  const stopCardClick = (event) => {
    event.stopPropagation();
  };

  return (
    <article
      className="restaurant-card"
      role="link"
      tabIndex={0}
      onClick={handleViewDetails}
      onKeyDown={handleKeyDown}
      aria-label={`View details for ${data.name}`}
    >
      {data.image ? (
        <img src={data.image} alt={data.name} loading="lazy" decoding="async" />
      ) : (
        <div className="restaurant-card-image-fallback" aria-hidden="true">
          {String(data.name || "?").trim().charAt(0).toUpperCase() || "?"}
        </div>
      )}

      <header className="restaurant-card-head">
        <h4>{data.name}</h4>
        <span
          className="restaurant-card-price"
          aria-label={`Price: ${normalizePriceRange(data.price) || "N/A"}`}
        >
          {normalizePriceRange(data.price) || "--"}
        </span>
      </header>

      <div className="restaurant-card-meta">
        <span className="restaurant-card-meta-item">📍 {data.location || "—"}</span>
        <span className="restaurant-card-meta-item">
          ⭐ {Number.isFinite(rating) ? rating.toFixed(1) : "--"} (
          {Number.isFinite(reviews) ? reviews : 0} reviews)
        </span>
        {Number.isFinite(distanceKm) ? (
          <span className="restaurant-card-meta-item">🧭 {distanceKm.toFixed(1)} km</span>
        ) : null}
      </div>

      <div className="restaurant-card-ai">
        <span>Ranking score</span>
        <b>{Number.isFinite(rankingScore) ? rankingScore.toFixed(1) : "--"}</b>
      </div>

      {scoreItems.length > 0 ? (
        <details className="ai-breakdown" onClick={stopCardClick} onKeyDown={stopCardClick}>
          <summary onClick={stopCardClick} onKeyDown={stopCardClick}>
            <span>Why recommended</span>
            {data.whyRecommended ? (
              <span className="ai-breakdown-summary-inline">{data.whyRecommended}</span>
            ) : null}
          </summary>
          <div className="ai-breakdown-grid">
            {scoreItems.map((item) => (
              <div key={item.label} className="ai-breakdown-item">
                <span>{item.label}</span>
                <b>{Number(item.value || 0).toFixed(1)}</b>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <div className="restaurant-card-cta" aria-hidden="true">
        View details →
      </div>
    </article>
  );
}
