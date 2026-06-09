import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, User, CalendarDays, Sparkles, Hash } from "lucide-react";
import "./GlobalSearch.css";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

const emptyResults = {
  people: [],
  events: [],
  activities: [],
  interests: [],
};

function GlobalSearch({ onNavigate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(emptyResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  const trimmedQuery = query.trim();
  const hasResults = useMemo(
    () =>
      results.people.length > 0 ||
      results.events.length > 0 ||
      results.activities.length > 0 ||
      results.interests.length > 0,
    [results],
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      setLoading(false);
      setError("");
      setResults(emptyResults);
      setOpen(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const requestUrl = `/api/Search?query=${encodeURIComponent(trimmedQuery)}`;
      const token = localStorage.getItem("token");

      setLoading(true);
      setError("");
      setOpen(true);

      try {
        const response = await fetch(requestUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (response.status === 401 || response.status === 403) {
          setResults(emptyResults);
          setError("Please log in again");
          return;
        }

        if (!response.ok) {
          const body = await response.text();
          console.error("[GlobalSearch] failed", {
            requestUrl,
            status: response.status,
            body,
          });
          setResults(emptyResults);
          setError("Search could not be loaded");
          return;
        }

        const body = await response.json();
        setResults({
          people: Array.isArray(body.people) ? body.people : [],
          events: Array.isArray(body.events) ? body.events : [],
          activities: Array.isArray(body.activities) ? body.activities : [],
          interests: Array.isArray(body.interests) ? body.interests : [],
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("[GlobalSearch] request error", err);
          setResults(emptyResults);
          setError("Search could not be loaded");
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [trimmedQuery]);

  const handleNavigate = (path) => {
    setOpen(false);
    setQuery("");
    onNavigate?.();
    navigate(path);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      return;
    }

    handleNavigate(`/app/search?q=${encodeURIComponent(trimmedQuery)}`);
  };

  const renderSection = (title, items, icon, renderItem) => {
    if (!items.length) {
      return null;
    }

    return (
      <section className="global-search__section">
        <div className="global-search__section-title">
          {icon}
          <span>{title}</span>
        </div>
        <div className="global-search__items">{items.map(renderItem)}</div>
      </section>
    );
  };

  return (
    <form className="global-search" ref={searchRef} onSubmit={handleSubmit}>
      <label className="global-search__field">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder="Search people, events, coffee..."
          aria-label="Global search"
          onFocus={() => {
            if (trimmedQuery.length >= MIN_QUERY_LENGTH) {
              setOpen(true);
            }
          }}
          onChange={(event) => setQuery(event.target.value)}
        />
        {loading && <Loader2 className="global-search__loader" size={15} aria-hidden="true" />}
      </label>

      {open && (
        <div className="global-search__dropdown" role="listbox">
          {loading && <div className="global-search__state">Searching...</div>}

          {!loading && error && <div className="global-search__state global-search__state--error">{error}</div>}

          {!loading && !error && !hasResults && (
            <div className="global-search__state">No results found</div>
          )}

          {!loading &&
            !error &&
            renderSection("People", results.people, <User size={14} />, (person) => (
              <button
                type="button"
                className="global-search__item"
                key={`person-${person.id}`}
                onClick={() => handleNavigate(`/app/users/${person.id}`)}
              >
                <span className="global-search__item-main">{person.displayName || person.username}</span>
                <span className="global-search__item-meta">
                  @{person.username}
                  {person.locationDisplayName ? ` - ${person.locationDisplayName}` : ""}
                </span>
                {person.tags?.length > 0 && (
                  <span className="global-search__tags">{person.tags.join(" - ")}</span>
                )}
              </button>
            ))}

          {!loading &&
            !error &&
            renderSection("Events", results.events, <CalendarDays size={14} />, (event) => (
              <button
                type="button"
                className="global-search__item"
                key={`event-${event.id}`}
                onClick={() => handleNavigate("/app/events")}
              >
                <span className="global-search__item-main">{event.title}</span>
                <span className="global-search__item-meta">
                  {formatEventDate(event.dateTime)} - {event.categoryName || "Event"} - {event.location}
                </span>
              </button>
            ))}

          {!loading &&
            !error &&
            renderSection("Activities", results.activities, <Sparkles size={14} />, (activity) => (
              <button
                type="button"
                className="global-search__item"
                key={`activity-${activity.id}`}
                onClick={() => handleNavigate("/app/quick-match")}
              >
                <span className="global-search__item-main">{activity.displayName}</span>
                <span className="global-search__item-meta">{activity.categoryName}</span>
              </button>
            ))}

          {!loading &&
            !error &&
            renderSection("Interests", results.interests, <Hash size={14} />, (interest) => (
              <button
                type="button"
                className="global-search__item global-search__item--static"
                key={`interest-${interest.id}`}
                onClick={() => setQuery(interest.name)}
              >
                <span className="global-search__item-main">{interest.name}</span>
                <span className="global-search__item-meta">
                  {interest.category || "Interest"} - {interest.count} people
                </span>
              </button>
            ))}
        </div>
      )}
    </form>
  );
}

function formatEventDate(value) {
  if (!value) {
    return "Event";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Event";
  }

  return date.toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default GlobalSearch;
