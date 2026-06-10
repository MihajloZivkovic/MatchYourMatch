import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Flag, Heart, MapPin, MessageCircle, Sparkles, UserPlus } from "lucide-react";
import "./PublicProfile.css";

function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [isReported, setIsReported] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      if (!id) {
        setError("Profile route is missing a user id.");
        setLoading(false);
        return;
      }

      const token = localStorage.getItem("token");
      const requestUrl = `/api/UserProfile/public/${id}`;
      setLoading(true);
      setError("");

      try {
        console.log("[PublicProfile] request", requestUrl);

        const response = await fetch(requestUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        console.log("[PublicProfile] status", response.status);

        if (response.status === 401 || response.status === 403) {
          setError("Please log in again.");
          return;
        }

        const body = await response.text();

        if (!response.ok) {
          console.error("[PublicProfile] failed", response.status, body);
          throw new Error(body || "Profile could not be loaded.");
        }

        const data = body ? JSON.parse(body) : null;

        if (!data || !data.id || !data.username) {
          console.error("[PublicProfile] invalid response", data);
          throw new Error("Profile response was empty or invalid.");
        }

        setProfile(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("[PublicProfile] request error", err);
          setError(err.message || "Profile could not be loaded. Make sure the backend is running.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfile();

    return () => controller.abort();
  }, [id]);

  const initials = useMemo(() => getInitials(profile?.username || ""), [profile?.username]);

  if (loading) {
    return <main className="public-profile"><div className="public-profile__state">Loading profile...</div></main>;
  }

  if (error) {
    return (
      <main className="public-profile">
        <button type="button" className="public-profile__back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="public-profile__state public-profile__state--error">{error}</div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="public-profile">
        <button type="button" className="public-profile__back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="public-profile__state public-profile__state--error">
          Profile could not be loaded. Make sure the backend is running.
        </div>
      </main>
    );
  }

  return (
    <main className="public-profile page-fade-in">
      <button type="button" className="public-profile__back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} />
        Back
      </button>

      <header className="public-profile__hero">
        <div className="public-profile__mesh" aria-hidden="true" />
        <div className="public-profile__hero-inner">
          <div className="public-profile__avatar">{initials}</div>
          <div className="public-profile__identity">
            <h1>{profile.username}</h1>
            <p>@{profile.username}</p>
            <span>
              <MapPin size={15} />
              {profile.locationDisplayName || "Location not shared"}
            </span>
          </div>
          <div className="public-profile__actions">
            <button
              type="button"
              className={`public-profile__follow${isFollowing ? " public-profile__follow--active" : ""}`}
              onClick={() => setIsFollowing((current) => !current)}
            >
              {isFollowing ? <Check size={16} /> : <UserPlus size={16} />}
              {isFollowing ? "Following" : "Follow"}
            </button>
            <button
              type="button"
              className={`public-profile__report${isReported ? " public-profile__report--active" : ""}`}
              onClick={() => setIsReported(true)}
            >
              <Flag size={15} />
              {isReported ? "Reported" : "Report"}
            </button>
          </div>
        </div>
      </header>

      <section className="public-profile__grid">
        <article className="public-profile__card public-profile__card--wide">
          <h2>
            <Heart size={17} />
            About
          </h2>
          <p>{profile.bio || "This user has not added a bio yet."}</p>
        </article>

        <article className="public-profile__card">
          <h2>
            <Sparkles size={17} />
            Interests
          </h2>
          {profile.interests?.length > 0 ? (
            <div className="public-profile__pills">
              {profile.interests.map((interest) => (
                <span key={interest.id}>{interest.name}</span>
              ))}
            </div>
          ) : (
            <p>No interests added yet.</p>
          )}
        </article>

        <article className="public-profile__card">
          <h2>
            <MessageCircle size={17} />
            Connect
          </h2>
          <p>Public profile preview. Messaging can be connected here later.</p>
          <button
            type="button"
            className="public-profile__cta"
            onClick={() =>
              navigate(`/app/chat?userId=${profile.id}&username=${encodeURIComponent(profile.username)}`)
            }
          >
            Say hello
          </button>
        </article>
      </section>
    </main>
  );
}

function getInitials(value) {
  return value
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "MY";
}

export default PublicProfile;
