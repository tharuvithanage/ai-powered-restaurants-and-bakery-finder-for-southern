export default function StatsBar({ summary, loading }) {
  const score = summary?.overallScore ?? 0;
  const top = summary?.topRecommendation;

  return (
    <div className="ai-bar">
      <div className="ai-bar-main">
        <p className="ai-bar-kicker">🤖 Average Recommendation Score</p>
        <div className="ai-bar-score-row">
          <h3>Average Recommendation Score</h3>
          <span className="ai-bar-score-badge">{loading ? "..." : `${score} / 10`}</span>
        </div>
        <p className="ai-bar-note">
          Based on ratings, review confidence, distance, budget and preferences.
        </p>
      </div>

      {!loading && top ? (
        <div className="ai-bar-topmatch" aria-label="Top recommendation">
          <span className="ai-topmatch-label">⭐ Top Match</span>
          <b className="ai-topmatch-name">{top.name}</b>
          <span className="ai-topmatch-score">Score: {top.rankingScore ?? top.aiScore ?? 0}</span>
        </div>
      ) : null}
    </div>
  );
}
