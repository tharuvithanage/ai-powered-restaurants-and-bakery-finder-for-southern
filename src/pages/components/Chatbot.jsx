import { useState } from "react";

export default function Chatbot({ restaurants, setFiltered, setSummary, apiBaseUrl }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hi! Ask me something like 'budget place in Galle within 5 km'" },
  ]);
  const [loading, setLoading] = useState(false);
  const floatingStyle = {
    position: "fixed",
    right: "20px",
    left: "auto",
    bottom: "20px",
    zIndex: 4000,
  };

  const focusLauncher = () => {
    window.setTimeout(() => {
      document.getElementById("chatbot-launcher")?.focus();
    }, 0);
  };

  const focusInput = () => {
    window.setTimeout(() => {
      document.getElementById("chatbot-query")?.focus();
    }, 0);
  };

  const scrollToBottom = () => {
    window.setTimeout(() => {
      const body = document.querySelector(".chatbot .chat-body");
      if (!body) return;
      body.scrollTop = body.scrollHeight;
    }, 0);
  };

  const quickPrompts = [
    "cheap places in Galle",
    "top rated in Ahangama",
    "galle fort within 6 km",
    "premium restaurants with good rating",
  ];

  const submitQuery = async (userText) => {
    if (!userText.trim()) return;

    const userMessage = { sender: "user", text: userText };
    setMessages((prev) => [...prev, userMessage]);
    scrollToBottom();
    setQuery("");

    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/restaurants/chatbot/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userText }),
      });

      const raw = await response.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          `Server returned invalid response (status ${response.status}). Check backend logs.`
        );
      }

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      const imageMap = new Map(restaurants.map((item) => [item.id, item.image]));
      const mapped = (data.restaurants || []).map((item) => ({
        ...item,
        image: imageMap.get(item.id) || item.image || "",
      }));

      setFiltered(mapped);
      if (setSummary && data.summary) {
        setSummary(data.summary);
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.assistantMessage || "I found some options for you.",
        },
      ]);
      scrollToBottom();
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: `Sorry, I couldn't process that. ${error.message}` },
      ]);
      scrollToBottom();
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleSend = async () => {
    await submitQuery(query);
  };

  if (!isOpen) {
    return (
      <div className="chatbot-launcher-wrap" style={floatingStyle}>
        <div className="chatbot-hint-bubble" role="status" aria-live="polite">
          Need help finding food? Ask me!
        </div>
        <button
          type="button"
          className="chatbot-launcher"
          id="chatbot-launcher"
          onClick={() => {
            setIsOpen(true);
            focusInput();
          }}
          aria-label="Open food assistant"
        >
          Food Assistant
        </button>
      </div>
    );
  }

  return (
    <div className="chatbot" style={floatingStyle}>
      <div className="chat-header">
        <span>Food Assistant</span>
        <button
          type="button"
          className="chat-close-btn"
          onClick={() => {
            setIsOpen(false);
            focusLauncher();
          }}
          aria-label="Close assistant"
        >
          Close
        </button>
      </div>

      <div className="chat-quick-prompts">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="chat-prompt-chip"
            onClick={() => submitQuery(prompt)}
            disabled={loading}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="chat-body">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.sender}`}>
            {m.text}
          </div>
        ))}
        {loading ? <div className="chat-msg bot">Typing…</div> : null}
      </div>

      <div className="chat-input">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask something..."
          id="chatbot-query"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setIsOpen(false);
              focusLauncher();
              return;
            }

            if (event.key !== "Enter") return;
            event.preventDefault();
            handleSend();
          }}
        />
        <button onClick={handleSend} disabled={loading || !query.trim()}>
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
