export default function FilterPanel({
  filters,
  onChange,
  onApply,
  onReset,
  resultCount,
  currentLocationValue,
  onUseCurrentLocation,
  geoLoading,
  geoError,
  currentLocationLabel,
}) {
  const isDistanceEnabled = filters.location !== "Any";
  const usingCurrentLocation = filters.location === currentLocationValue;
  const currentLocationOptionLabel = currentLocationLabel
    ? `My current location (${currentLocationLabel})`
    : "My current location";

  return (
    <div className="filter-panel">
      <div className="filter-head">
        <div>
          <h3>Find Your Perfect Spot</h3>
          <p className="filter-subtitle">Filter by location, budget, rating, and distance</p>
        </div>
        <span className="result-pill">{resultCount} Results</span>
      </div>

      <div className="filter-grid">
        <label className="filter-field">
          <span>🔍 Search</span>
          <div className="field-control icon-search">
            <span className="field-icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search restaurants, bakeries, coffee..."
              value={filters.search}
              onChange={(e) => onChange("search", e.target.value)}
            />
          </div>
        </label>

        <label className="filter-field">
          <span>📍 Location</span>
          <div className="location-inline">
            <div className="field-control icon-location">
              <span className="field-icon" aria-hidden="true">
                📍
              </span>
              <select
                value={filters.location}
                onChange={(e) => onChange("location", e.target.value)}
              >
                <option value="Any">Anywhere</option>
                <option value="Ahangama">Ahangama</option>
                <option value="Galle">Galle</option>
                <option value="Galle Fort">Galle Fort</option>
                <option value="Unawatuna">Unawatuna</option>
                <option value="Weligama">Weligama</option>
                <option value="Mirissa">Mirissa</option>
                <option value="Tangalle">Tangalle</option>
                <option value={currentLocationValue}>{currentLocationOptionLabel}</option>
              </select>
            </div>
            <button
              className="location-helper-btn"
              type="button"
              onClick={onUseCurrentLocation}
              disabled={geoLoading}
            >
              {geoLoading ? "Locating..." : "Use my current location"}
            </button>
          </div>
          {geoError ? <span className="location-helper-error">{geoError}</span> : null}
        </label>

        <label className="filter-field">
          <span>💰 Budget</span>
          <div className="field-control icon-price">
            <span className="field-icon" aria-hidden="true">
              💰
            </span>
            <select
              value={filters.price}
              onChange={(e) => onChange("price", e.target.value)}
            >
              <option value="Any">Any budget</option>
              <option value="Budget">Budget</option>
              <option value="Moderate">Moderate</option>
              <option value="Expensive">Expensive</option>
              <option value="Luxury">Luxury</option>
            </select>
          </div>
        </label>

        <label className="filter-field">
          <span>⭐ Rating</span>
          <div className="field-control icon-rating">
            <span className="field-icon" aria-hidden="true">
              ⭐
            </span>
            <select
              value={String(filters.minRating)}
              onChange={(e) => onChange("minRating", Number(e.target.value))}
            >
              <option value="0">Any rating</option>
              <option value="4">4.0+</option>
              <option value="4.3">4.3+</option>
              <option value="4.5">4.5+</option>
            </select>
          </div>
        </label>
      </div>

      <div className="distance-row">
        <div className="distance-head">
          <label className="distance-label" htmlFor="distance-range">
            {usingCurrentLocation
              ? "📍 Distance from your current location"
              : "📍 Distance from selected location"}
          </label>
          <span className="distance-value">
            Distance: {isDistanceEnabled ? `${filters.maxDistanceKm} km` : "--"}
          </span>
        </div>
        <div className="distance-controls">
          <input
            id="distance-range"
            type="range"
            min="1"
            max="30"
            step="1"
            value={filters.maxDistanceKm}
            onChange={(e) => onChange("maxDistanceKm", Number(e.target.value))}
            disabled={!isDistanceEnabled}
          />
          <span className="distance-badge">
            {isDistanceEnabled
              ? `${filters.maxDistanceKm} km`
              : "Choose location or current location"}
          </span>
        </div>
      </div>

      <div className="filter-actions">
        <button className="filter-btn ghost" type="button" onClick={onReset}>
          Reset
        </button>
        <button className="filter-btn solid" type="button" onClick={onApply}>
          Apply Filters
        </button>
      </div>
    </div>
  );
}

