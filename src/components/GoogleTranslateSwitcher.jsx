import { useEffect, useMemo, useRef, useState } from "react";
import "./GoogleTranslateSwitcher.css";

const GOOGLE_TRANSLATE_SRC =
  "//translate.google.com/translate_a/element.js?cb=__googleTranslateInit";

let googleTranslateScriptPromise = null;

function loadGoogleTranslateOnce() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.google?.translate?.TranslateElement) return Promise.resolve(true);

  if (!googleTranslateScriptPromise) {
    googleTranslateScriptPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-google-translate="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = GOOGLE_TRANSLATE_SRC;
      script.async = true;
      script.defer = true;
      script.dataset.googleTranslate = "true";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  return googleTranslateScriptPromise;
}

function setGoogTransCookie(languageCode) {
  // Google Translate uses this cookie to remember the selected language.
  // Format: /<source>/<target> where source can be "auto".
  const value = `/auto/${languageCode}`;
  const base = `googtrans=${encodeURIComponent(value)}; path=/;`;
  document.cookie = base;
  document.cookie = `${base} domain=${window.location.hostname};`;
}

function getGoogTransCookie() {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function setGoogleComboLanguage(languageCode) {
  const combo = document.querySelector("select.goog-te-combo");
  if (!combo) return false;

  combo.value = languageCode;
  combo.dispatchEvent(new Event("change"));
  combo.dispatchEvent(new Event("input"));
  return true;
}

const DEFAULT_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "zh-CN", label: "中文" },
  { code: "ja", label: "日本語" },
];

export default function GoogleTranslateSwitcher({
  languages = DEFAULT_LANGUAGES,
  storageKey = "language",
  defaultLanguage = "en",
  className = "",
  label = "Language",
  hideLabel = false,
}) {
  const [ready, setReady] = useState(false);
  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") return defaultLanguage;
    return window.localStorage.getItem(storageKey) || defaultLanguage;
  });

  const widgetContainerRef = useRef(null);
  const initCalledRef = useRef(false);
  const langCodesCsv = useMemo(
    () => languages.map((l) => l.code).join(","),
    [languages]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cancelled = false;
    let observer = null;
    let retryTimer = 0;

    const cleanup = () => {
      cancelled = true;
      if (observer) observer.disconnect();
      if (retryTimer) window.clearTimeout(retryTimer);
      observer = null;
      retryTimer = 0;
    };

    // Global callback required by Google Translate script `cb=...`
    window.__googleTranslateInit = () => {
      if (cancelled) return;
      if (initCalledRef.current) return;
      initCalledRef.current = true;

      const containerId = "google_translate_element";
      if (!document.getElementById(containerId)) {
        const div = document.createElement("div");
        div.id = containerId;
        div.style.display = "none";
        document.body.appendChild(div);
        widgetContainerRef.current = div;
      }

      try {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: defaultLanguage,
            includedLanguages: langCodesCsv,
            autoDisplay: false,
          },
          containerId
        );
      } catch {
        // If init fails, allow retry via mutation observer below.
      }

      setReady(true);

      // Apply persisted language once the combo appears.
      const apply = () => {
        if (cancelled) return;
        const next = window.localStorage.getItem(storageKey) || defaultLanguage;
        if (next) {
          setGoogTransCookie(next);
          setGoogleComboLanguage(next);
        }
      };

      // Combo is inserted async; observe DOM until it exists, then apply once.
      observer = new MutationObserver(() => {
        if (document.querySelector("select.goog-te-combo")) {
          apply();
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { subtree: true, childList: true });

      // Fallback: apply after a brief delay too.
      retryTimer = window.setTimeout(apply, 400);
    };

    loadGoogleTranslateOnce().then((ok) => {
      if (cancelled) return;
      if (!ok) return;

      // If script loaded but callback didn't fire for some reason, run it.
      if (!initCalledRef.current && window.google?.translate?.TranslateElement) {
        window.__googleTranslateInit();
      }
    });

    return () => {
      cleanup();
      // Best-effort cleanup: remove hidden container we created.
      if (widgetContainerRef.current?.parentNode) {
        widgetContainerRef.current.parentNode.removeChild(widgetContainerRef.current);
      }
      widgetContainerRef.current = null;

      // Avoid retaining references.
      try {
        delete window.__googleTranslateInit;
      } catch {
        window.__googleTranslateInit = undefined;
      }
    };
  }, [defaultLanguage, langCodesCsv, storageKey]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language || defaultLanguage;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, language || defaultLanguage);
    }
  }, [defaultLanguage, language, storageKey]);

  const handleChange = (nextLanguage) => {
    setLanguage(nextLanguage);

    // Persist + hint Google Translate via cookie.
    setGoogTransCookie(nextLanguage);

    // If the widget combo exists, use it (no full reload).
    const applied = setGoogleComboLanguage(nextLanguage);
    if (!applied) {
      // If widget isn't ready yet, it will be applied once it appears.
      // As a fallback, keep cookie so a refresh keeps the selected language.
    }
  };

  // If user is already translated, try to reflect it in dropdown on first paint.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cookie = getGoogTransCookie();
    if (!cookie) return;
    const parts = cookie.split("/");
    const target = parts[2];
    if (target && target !== language) setLanguage(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`gt-switcher ${className}`.trim()}>
      {!hideLabel ? (
        <label className="gt-label" htmlFor="gt-lang-select">
          {label}
        </label>
      ) : null}
      <select
        id="gt-lang-select"
        className="gt-select"
        value={language}
        onChange={(e) => handleChange(e.target.value)}
        disabled={!ready}
        aria-label={hideLabel ? label : undefined}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
