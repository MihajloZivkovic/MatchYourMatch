import { useActionState, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Heart,
  Calendar,
  Star,
  MessageCircle,
  Music,
  Coffee,
  Moon,
} from "lucide-react";
import EventCard from "../../components/EventCard";
import { CURRENT_USER, matches, LITTLE_THINGS } from "../../data/matches";
import { events } from "../../data/events";
import "./Profile.css";

const TABS = ["ABOUT", "MATCHES", "EVENTS"];
const EVENT_SEGMENTS = ["Upcoming", "Past", "Saved"];

const ACTIVITIES = [
  "Live music",
  "Gallery nights",
  "Rooftop hangs",
  "Road trips",
];
const SOCIAL_ENERGY = 72;
const CONVERSATION = "Thoughtful & playful";

function Profile(props) {
  const [tab, setTab] = useState("ABOUT");
  const [eventSegment, setEventSegment] = useState("Upcoming");

  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("mym_authed");
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("tokenChanged"));
    navigate("/");
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/UserProfile/me", {
          headers: {
            accept: "*/*",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        props.setUserProfile((prev) => ({
          ...prev,
          bio: data.bio ?? prev.bio,
          location: data.location ?? prev.location,
          profilePicture: data.profilePicture ?? prev.profilePicture,
        }));
      } catch (error) {
        console.error("Failed to load profile:", error);
      }
    };

    fetchProfile();
  }, []);
  const sendImg = async (event) => {
    const img = event.target.files[0];
    if (!img) return;

    const convertToBase64 = (fileObj) => {
      return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.readAsDataURL(fileObj);
        fileReader.onload = () => resolve(fileReader.result);
        fileReader.onerror = (error) => reject(error);
      });
    };

    const convertedImage = await convertToBase64(img);

    const token = localStorage.getItem("token");
    const response = await fetch("/api/UserProfile/me", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        accept: "*/*",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        Bio: props.userProfile.bio,
        ProfilePicture: convertedImage,
        Location: props.userProfile.location,
      }),
    });

    if (response.ok) {
      props.setUserProfile((prev) => ({
        ...prev,
        profilePicture: convertedImage,
      }));
    }
  };

  const statCards = [
    { icon: Heart, label: "Matches", value: "24" },
    { icon: Calendar, label: "Events Joined", value: "7" },
    { icon: Star, label: "Profile Score", value: "91%" },
    { icon: MessageCircle, label: "Response Rate", value: "94%" },
  ];

  const eventLists = {
    Upcoming: events.slice(0, 2),
    Past: events.slice(2, 4),
    Saved: events.slice(4, 6),
  };

  const [saveButtonText, setSaveButtonText] = useState("Save")
  function styleButton(){
      setSaveButtonText("Saved!");
      const button = document.getElementById("saveBtn");
      button.classList.add("saveAnimation");

    setTimeout(() => {
      setSaveButtonText("Save"); 
      button.classList.remove("saveAnimation");
    }, 2000);
  }

  const [bio, setBio] = useState(props.userProfile.bio);

  // sync kada se refreshuje
  useEffect(() => {
    setBio(props.userProfile.bio);
  }, [props.userProfile.bio]);

  const [state, formAction] = useActionState(handleBioSave, {
      error: null,
      values: { biography:"" },
    });

  async function handleBioSave(prevState, formData){
    const bioText = formData.get("bio");
    
    const token = localStorage.getItem("token");
    try {
      const response = await fetch("/api/UserProfile/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          accept: "*/*",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          Bio: bioText,
          ProfilePicture: props.userProfile.profilePicture,
          Location: props.userProfile.location,
        }),
      });

      if (response.ok) {
        setBio(bioText);
        props.setUserProfile((prev) => ({
          ...prev,
          bio: bioText,
        }));

        styleButton();
      }
    } catch (error) {
      console.error("Failed to save bio:", error);
    }
  }

  return (
    <div className="page-fade-in profile">
      <header className="profile__header">
        <div className="profile__header-mesh" aria-hidden="true" />
        <div className="profile__header-inner">
          <div className="profile__identity">
            <div className="profile__avatar-wrap">
              <div className="profile__avatar">
                <input
                  id="imgInput"
                  type="file"
                  accept="image/*"
                  onChange={sendImg}
                />
                {props.userProfile.profilePicture ? (
                  <img src={props.userProfile.profilePicture} alt="Profile" />
                ) : (
                  "+"
                )}
              </div>
            </div>
            <div className="profile__identity-text">
              <h1>{props.currentUser.username}</h1>
              <p className="profile__username">@{props.currentUser.username}</p>
              <p className="profile__location">
                <MapPin size={14} />
                {/* make it display current device location */}
                {CURRENT_USER.location}
              </p>
              <div className="profile__badges-row">
                <span className="glass-pill glass-pill--online">
                  ACTIVE TODAY
                </span>
                <span className="profile__completion">
                  {CURRENT_USER.completion}% complete
                </span>
                <span className="profile__type-badge">
                  {CURRENT_USER.personalityType}
                </span>
              </div>
              <span className="profile__exploring">Currently Exploring</span>
              <div className="profile__trait-tags">
                {CURRENT_USER.badges.map((b) => (
                  <span key={b} className="profile__trait">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="profile__stat-grid">
            {statCards.map(({ icon: Icon, label, value }) => (
              <div key={label} className="profile__stat-card app-tilt-hover">
                <Icon size={18} />
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="profile__header-actions">
            <button
              type="button"
              className="app-btn-pill app-btn-pill--outline app-interactive"
            >
              EDIT PROFILE
            </button>
            <button
              type="button"
              className="profile__logout"
              onClick={handleLogout}
            >
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      <div className="profile__body">
        <div className="profile__tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`profile__tab${tab === t ? " profile__tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
              {tab === t && <span className="profile__tab-glow" />}
            </button>
          ))}
        </div>

        <div key={tab} className="profile__tab-panel">
          {tab === "ABOUT" && (
            <div className="profile__about">
              <form className="profile__block" action={formAction}>
                <h3>About Me</h3>
                <textarea name="bio" placeholder="Designer and music lover based in Brooklyn. Always up for a rooftop sunset, live jazz, or a spontaneous road trip. Looking for genuine connection and good conversation." value={bio} onChange={(e) => setBio(e.target.value)} />
                <button id="saveBtn" type="submit" className="saveButton">{saveButtonText}</button>
              </form>

              <section className="profile__block profile__little-things">
                <h3>LITTLE THINGS ABOUT ME</h3>
                <div className="profile__little-grid">
                  {LITTLE_THINGS.map((item) => (
                    <span
                      key={item}
                      className="profile__little-card app-tilt-hover"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>

              <div className="profile__mini-grid">
                <section className="profile__mini-card">
                  <h4>
                    <Music size={14} />
                    Favorite Activities
                  </h4>
                  <div className="profile__pills">
                    {ACTIVITIES.map((a) => (
                      <span key={a} className="profile__pill">
                        {a}
                      </span>
                    ))}
                  </div>
                </section>
                <section className="profile__mini-card">
                  <h4>Social Energy</h4>
                  <div className="profile__energy-ring">
                    <svg viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        className="profile__ring-bg"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        className="profile__ring-fill"
                        style={{
                          strokeDashoffset: 94 * (1 - SOCIAL_ENERGY / 100),
                        }}
                      />
                    </svg>
                    <span>{SOCIAL_ENERGY}%</span>
                  </div>
                </section>
                <section className="profile__mini-card">
                  <h4>
                    <Coffee size={14} />
                    Conversation Style
                  </h4>
                  <p>{CONVERSATION}</p>
                </section>
                <section className="profile__mini-card">
                  <h4>
                    <Moon size={14} />
                    Looking For
                  </h4>
                  <div className="profile__pills">
                    {[
                      "Meaningful connection",
                      "Adventure partner",
                      "Creative collaborator",
                    ].map((item) => (
                      <span key={item} className="profile__pill">
                        {item}
                      </span>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {tab === "MATCHES" && (
            <div className="profile__matches-grid">
              {matches.slice(0, 6).map((m) => (
                <article
                  key={m.id}
                  className="profile__match-card app-tilt-hover"
                >
                  <div className="profile__match-ring">
                    <div className="profile__match-avatar">{m.initials}</div>
                    <span className="profile__match-score">
                      {m.compatibility}%
                    </span>
                  </div>
                  <h4>{m.name}</h4>
                  <p className="profile__match-loc">{m.location}</p>
                  <div className="profile__match-interests">
                    {m.interests.slice(0, 2).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <span className="profile__match-online">Recently active</span>
                  <button
                    type="button"
                    className="app-btn-pill profile__match-view app-interactive"
                  >
                    VIEW
                  </button>
                </article>
              ))}
            </div>
          )}

          {tab === "EVENTS" && (
            <div className="profile__events-panel">
              <div className="profile__event-segment">
                {EVENT_SEGMENTS.map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    className={
                      eventSegment === seg ? "profile__event-seg--active" : ""
                    }
                    onClick={() => setEventSegment(seg)}
                  >
                    {seg}
                  </button>
                ))}
              </div>
              <div className="profile__events-list">
                {eventLists[eventSegment].map((e) => (
                  <EventCard key={e.id} event={e} mini />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
