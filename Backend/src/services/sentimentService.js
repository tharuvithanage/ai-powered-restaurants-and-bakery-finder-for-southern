const DEFAULT_SENTIMENT_API_URL = "http://127.0.0.1:5005";

const normalizeBaseUrl = (url) => String(url || "").replace(/\/+$/, "");

exports.predictSentiment = async (text, { timeoutMs = 4000 } = {}) => {
  const apiBaseUrl = normalizeBaseUrl(process.env.SENTIMENT_API_URL || DEFAULT_SENTIMENT_API_URL);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiBaseUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error || data?.message || "Sentiment service error";
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }

    return {
      label: data?.label,
      score: Number(data?.score ?? 0),
      probabilities: data?.probabilities || null,
    };
  } finally {
    clearTimeout(timeout);
  }
};

