const PRICE_RANGES = ["Budget", "Moderate", "Expensive", "Luxury"];

const legacyToCanonical = {
  $: "Budget",
  $$: "Moderate",
  $$$: "Expensive",
  $$$$: "Luxury",
};

const canonicalLevels = {
  Budget: 1,
  Moderate: 2,
  Expensive: 3,
  Luxury: 4,
};

const normalizePriceRange = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw === "Any") return "Any";
  if (legacyToCanonical[raw]) return legacyToCanonical[raw];

  const match = PRICE_RANGES.find((label) => label.toLowerCase() === raw.toLowerCase());
  return match || raw;
};

const getPriceRangeLevel = (value) => {
  const canonical = normalizePriceRange(value);
  return canonicalLevels[canonical] || null;
};

const getPriceRangeAliases = (value) => {
  const canonical = normalizePriceRange(value);
  if (!canonical || canonical === "Any") return [];

  const legacy = Object.entries(legacyToCanonical).find(([, label]) => label === canonical)?.[0];
  return legacy ? [canonical, legacy] : [canonical];
};

module.exports = {
  PRICE_RANGES,
  normalizePriceRange,
  getPriceRangeLevel,
  getPriceRangeAliases,
};

