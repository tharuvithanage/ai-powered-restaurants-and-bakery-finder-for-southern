const { getOpenAIClient } = require('../lib/openaiClient');
const { normalizePriceRange } = require("../utils/priceRange");

const DEFAULT_MODEL = process.env.OPENAI_ASSISTANT_MODEL || 'gpt-4.1-mini';

const CONVERSATION_RULES = [
  'Stay focused on Sri Lankan restaurant discovery within Galle, Galle Fort, Unawatuna, Ahangama, Weligama, Mirissa, or Tangalle.',
  'Use only the restaurant data supplied in the current request (names, dishes, vibes, pricing) and never invent venues.',
  'If the user asks for anything unrelated to these restaurants or food discovery, politely refuse and steer them back on topic.',
  'Do not promise bookings, deliveries, or guarantees - share suggestions and next steps only.',
  'Keep replies concise (two sentences max) and highlight one or two standout venues with factual reasons.',
];

const buildFallbackMessage = (queryText, restaurants, summary, parsedSummaryText) => {
  if (!restaurants || restaurants.length === 0) {
    return parsedSummaryText || "I couldn't find any restaurants that matched your request.";
  }

  const top = restaurants.slice(0, 3);
  const highlight = top
    .map((item, idx) => {
      const price = normalizePriceRange(item.price) || item.price || "Moderate";
      return `${idx + 1}. ${item.name} (rating ${item.rating}/5, ${price})`;
    })
    .join('; ');

  return (
    parsedSummaryText ||
    `Found ${summary?.totalResults || restaurants.length} options for "${queryText}". Top picks: ${highlight}.`
  );
};

const safeStringify = (value, maxLength = 1200) => {
  try {
    const text = JSON.stringify(value);
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  } catch (error) {
    return '';
  }
};

const flattenOutputText = (response) => {
  if (response?.output_text) {
    return response.output_text.trim();
  }

  if (!Array.isArray(response?.output)) return '';

  return response.output
    .flatMap((segment) => segment?.content || [])
    .filter((part) => part && (part.type === 'output_text' || part.type === 'text'))
    .map((part) => part.text || '')
    .join('\n')
    .trim();
};

exports.buildAssistantMessage = async ({ queryText, restaurants, summary, parsedSummaryText }) => {
  const fallback = buildFallbackMessage(queryText, restaurants, summary, parsedSummaryText);

  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }

  try {
    const client = getOpenAIClient();
    const topOptions = restaurants.slice(0, 5).map((item) => ({
      name: item.name,
      location: item.location,
      rating: item.rating,
      aiScore: item.aiScore,
      rankingScore: item.rankingScore ?? item.aiScore,
      price: item.price,
      vibe: item.vibe,
    }));

    const instructionPreamble =
      'You are a concise Sri Lankan food concierge for down-south Sri Lanka (Galle, Galle Fort, Unawatuna, Ahangama, Weligama, Mirissa, Tangalle).';
    const instructionRules = `Follow these rules: ${CONVERSATION_RULES.map(
      (rule, idx) => `${idx + 1}. ${rule}`
    ).join(' ')}`;

    const response = await client.responses.create({
      model: DEFAULT_MODEL,
      instructions: `${instructionPreamble} ${instructionRules}`,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text:
                `User query: ${queryText}\n` +
                `Parsed summary: ${parsedSummaryText || 'n/a'}\n` +
                `Result summary: ${safeStringify(summary)}\n` +
                `Top matches: ${safeStringify(topOptions)}`,
            },
          ],
        },
      ],
      max_output_tokens: 300,
    });

    const aiText = flattenOutputText(response);
    return aiText || fallback;
  } catch (error) {
    console.warn('OpenAI assistant message failed:', error.message);
    return fallback;
  }
};
