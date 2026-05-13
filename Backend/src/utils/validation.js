const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

// Practical email validation (not full RFC 5322).
// Rejects common invalid cases like double dots, missing TLD, and invalid domain labels.
const isValidEmail = (value) => {
  const email = normalizeEmail(value);
  if (!email) return false;

  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return false;
  if (email.indexOf("@", atIndex + 1) !== -1) return false;

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (domain.length > 255) return false;

  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (local.includes("..")) return false;

  // Allow common local-part characters.
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return false;

  // Domain must be dot-separated labels (no underscores).
  if (domain.includes("..")) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;

  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (label.startsWith("-") || label.endsWith("-")) return false;
    if (!/^[a-z0-9-]+$/.test(label)) return false;
  }

  const tld = labels[labels.length - 1];
  if (tld.length < 2) return false;

  return true;
};

module.exports = { isValidEmail, normalizeEmail };

