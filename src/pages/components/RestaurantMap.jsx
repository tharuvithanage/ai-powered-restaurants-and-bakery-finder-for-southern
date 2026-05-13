import { useEffect, useMemo, useRef, useState } from "react";

const locationCenters = {
  Ahangama: { lat: 5.973, lng: 80.358 },
  Galle: { lat: 6.0535, lng: 80.221 },
  "Galle Fort": { lat: 6.026, lng: 80.217 },
  Unawatuna: { lat: 6.0108, lng: 80.249 },
  Weligama: { lat: 5.975, lng: 80.429 },
  Mirissa: { lat: 5.946, lng: 80.458 },
  Tangalle: { lat: 6.024, lng: 80.797 },
};

const leafletCssUrl = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const leafletJsUrl = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

const ensureLeaflet = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet requires a browser environment"));
  }

  if (window.L) {
    return Promise.resolve(window.L);
  }

  if (!document.querySelector(`link[href="${leafletCssUrl}"]`)) {
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = leafletCssUrl;
    cssLink.crossOrigin = "";
    document.head.appendChild(cssLink);
  }

  if (!window.__leafletLoadingPromise) {
    window.__leafletLoadingPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${leafletJsUrl}"]`);
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.L));
        existingScript.addEventListener("error", () =>
          reject(new Error("Leaflet script failed to load"))
        );
        return;
      }

      const script = document.createElement("script");
      script.src = leafletJsUrl;
      script.async = true;
      script.crossOrigin = "";
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error("Leaflet script failed to load"));
      document.body.appendChild(script);
    });
  }

  return window.__leafletLoadingPromise;
};

const computeFallbackCenter = (restaurants) => {
  const validCoords = restaurants
    .map((item) => item.coordinates)
    .filter((coords) => typeof coords?.lat === "number" && typeof coords?.lng === "number");

  if (validCoords.length === 0) {
    return { lat: 5.973, lng: 80.358 };
  }

  const total = validCoords.reduce(
    (acc, coords) => ({ lat: acc.lat + coords.lat, lng: acc.lng + coords.lng }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: total.lat / validCoords.length,
    lng: total.lng / validCoords.length,
  };
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getVenueType = (restaurant) => {
  const text = [
    restaurant.name,
    restaurant.desc,
    restaurant.vibe,
    ...(restaurant.dietaryTags || []),
  ]
    .join(" ")
    .toLowerCase();

  if (text.includes("bakery") || text.includes("bake")) return "bakery";
  if (text.includes("cafe") || text.includes("coffee") || text.includes("brunch")) return "cafe";
  return "restaurant";
};

const buildMarkerIcon = (leaflet, venueType, isTopPick) => {
  const emojiMap = {
    restaurant: "🍕",
    bakery: "🧁",
    cafe: "☕",
  };

  const emoji = emojiMap[venueType] || emojiMap.restaurant;
  const topClass = isTopPick ? "top" : "";

  return leaflet.divIcon({
    className: "map-emoji-marker-wrap",
    html: `<div class="map-emoji-marker ${topClass}" aria-label="${venueType} marker">${emoji}</div>`,
    iconSize: isTopPick ? [36, 36] : [30, 30],
    iconAnchor: isTopPick ? [18, 18] : [15, 15],
  });
};

const buildPopupMarkup = (restaurant, isTopPick) => {
  const name = escapeHtml(restaurant.name);
  const location = escapeHtml(restaurant.location || "");
  const shortDesc =
    typeof restaurant.desc === "string" && restaurant.desc.length > 96
      ? `${restaurant.desc.slice(0, 93)}...`
      : restaurant.desc || "";
  const description = escapeHtml(shortDesc);
  const image = restaurant.image ? `<img src="${escapeHtml(restaurant.image)}" alt="${name}" />` : "";
  const topTag = isTopPick ? `<span class="map-popup-tag">Top Pick</span>` : "";
  const rating = Number(restaurant.rating || 0).toFixed(1);
  const reviews = Number(restaurant.reviews || 0);
  const distanceLabel =
    typeof restaurant.distanceKm === "number"
      ? `${restaurant.distanceKm.toFixed(1)} km away`
      : "Distance not selected";
  const detailsHref = `/restaurant/${encodeURIComponent(restaurant.id)}`;

  return `
    <div class="map-popup-card">
      ${image}
      <div class="map-popup-content">
        <div class="map-popup-head">
          <strong>${name}</strong>
          ${topTag}
        </div>
        <p class="map-popup-meta">${location}</p>
        <p class="map-popup-rating">⭐ ${rating} (${reviews} reviews)</p>
        <p class="map-popup-distance">${escapeHtml(distanceLabel)}</p>
        <p class="map-popup-desc">${description}</p>
        <a class="map-popup-link" href="${detailsHref}">View Details</a>
      </div>
    </div>
  `;
};

export default function RestaurantMap({
  restaurants,
  topRecommendationId,
  filters,
  currentCoords,
  currentLocationValue,
}) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const distanceLayerRef = useRef(null);
  const centerMarkerRef = useRef(null);
  const [mapError, setMapError] = useState("");

  const activeCenter = useMemo(() => {
    if (filters.location === currentLocationValue && currentCoords) {
      return currentCoords;
    }

    if (filters.location && filters.location !== "Any" && locationCenters[filters.location]) {
      return locationCenters[filters.location];
    }

    return computeFallbackCenter(restaurants);
  }, [currentCoords, currentLocationValue, filters.location, restaurants]);

  useEffect(() => {
    let isCancelled = false;

    const initializeMap = async () => {
      try {
        const leaflet = await ensureLeaflet();
        if (isCancelled || !mapElementRef.current) return;

        if (!mapRef.current) {
          mapRef.current = leaflet.map(mapElementRef.current, {
            zoomControl: true,
            preferCanvas: true,
          });

          leaflet
            .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
              maxZoom: 19,
              attribution: "&copy; OpenStreetMap contributors",
            })
            .addTo(mapRef.current);

          markersLayerRef.current = leaflet.layerGroup().addTo(mapRef.current);
          distanceLayerRef.current = leaflet.layerGroup().addTo(mapRef.current);
          centerMarkerRef.current = leaflet.layerGroup().addTo(mapRef.current);

          window.requestAnimationFrame(() => {
            mapRef.current?.invalidateSize();
          });
        }

        setMapError("");
      } catch (error) {
        if (!isCancelled) {
          setMapError(error.message || "Map failed to load.");
        }
      }
    };

    initializeMap();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      mapRef.current?.invalidateSize();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const leaflet = window.L;
    const map = mapRef.current;
    if (!leaflet || !map || !markersLayerRef.current || !distanceLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    distanceLayerRef.current.clearLayers();
    centerMarkerRef.current?.clearLayers();

    const bounds = [];

    restaurants.forEach((restaurant) => {
      const coords = restaurant.coordinates;
      if (typeof coords?.lat !== "number" || typeof coords?.lng !== "number") return;

      const isTopPick = restaurant.id === topRecommendationId;
      const venueType = getVenueType(restaurant);
      const marker = leaflet.marker([coords.lat, coords.lng], {
        icon: buildMarkerIcon(leaflet, venueType, isTopPick),
      });

      marker.bindPopup(buildPopupMarkup(restaurant, isTopPick), {
        className: "map-preview-popup",
        closeButton: false,
        minWidth: 260,
        maxWidth: 300,
      });
      if (isTopPick) {
        marker.bindTooltip("Top Recommendation", {
          direction: "top",
          offset: [0, -8],
          opacity: 0.95,
        });
      }

      markersLayerRef.current.addLayer(marker);
      bounds.push([coords.lat, coords.lng]);
    });

    if (activeCenter && filters.location !== "Any" && filters.maxDistanceKm > 0) {
      const radiusMeters = Number(filters.maxDistanceKm) * 1000;
      const circle = leaflet.circle([activeCenter.lat, activeCenter.lng], {
        radius: radiusMeters,
        color: "#0ea5e9",
        fillColor: "#38bdf8",
        fillOpacity: 0.15,
        weight: 2,
        dashArray: "6 6",
      });
      distanceLayerRef.current.addLayer(circle);

      const centerMarker = leaflet.circleMarker([activeCenter.lat, activeCenter.lng], {
        radius: 6,
        color: "#0f172a",
        fillColor: "#0ea5e9",
        fillOpacity: 1,
        weight: 2,
      }).bindTooltip("Distance center", { direction: "right", offset: [10, 0] });
      centerMarkerRef.current?.addLayer(centerMarker);
      bounds.push([activeCenter.lat, activeCenter.lng]);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else if (activeCenter) {
      map.setView([activeCenter.lat, activeCenter.lng], 12);
    }
  }, [activeCenter, filters.location, filters.maxDistanceKm, restaurants, topRecommendationId]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (mapError) {
    return (
      <div className="map-fallback">
        <p>{mapError}</p>
      </div>
    );
  }

  return <div ref={mapElementRef} className="map-canvas" aria-label="Restaurant map" />;
}


