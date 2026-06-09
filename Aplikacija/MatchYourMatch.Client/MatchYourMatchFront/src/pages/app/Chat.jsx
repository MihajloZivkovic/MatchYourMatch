import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MoreHorizontal, Paperclip, Search, Send, ShieldCheck } from "lucide-react";
import "./Chat.css";

const baseConversations = [
  {
    id: "demo03",
    userId: 5,
    username: "lena.demo03",
    name: "lena.demo03",
    initials: "LD",
    location: "Novi Sad, Serbia",
    online: true,
    lastSeen: "Active now",
    unread: 2,
    messages: [
      { id: 1, from: "them", text: "Hey, saw coffee and book club in common. Strong start.", time: "18:04" },
      { id: 2, from: "me", text: "Absolutely. Cozy cafe plus good books is basically a personality test.", time: "18:06" },
      { id: 3, from: "them", text: "Then I vote Saturday afternoon if you are free.", time: "18:08" },
    ],
  },
  {
    id: "demo15",
    userId: 17,
    username: "nina.demo15",
    name: "nina.demo15",
    initials: "ND",
    location: "Belgrade, Serbia",
    online: false,
    lastSeen: "Last seen 1h ago",
    unread: 0,
    messages: [
      { id: 1, from: "them", text: "That live music event looks fun.", time: "16:20" },
      { id: 2, from: "me", text: "I was thinking the same. Want to check it out?", time: "16:23" },
    ],
  },
  {
    id: "demo18",
    userId: 20,
    username: "aleksandar.demo18",
    name: "aleksandar.demo18",
    initials: "AD",
    location: "Belgrade, Serbia",
    online: true,
    lastSeen: "Active now",
    unread: 0,
    messages: [
      { id: 1, from: "them", text: "Board games or coffee first?", time: "12:10" },
      { id: 2, from: "me", text: "Coffee first. It improves all strategy decisions.", time: "12:11" },
    ],
  },
];

function Chat() {
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState(baseConversations);
  const [activeId, setActiveId] = useState(baseConversations[0].id);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");

  const requestedUser = useMemo(
    () => ({
      userId: Number(searchParams.get("userId")),
      username: searchParams.get("username") || "",
    }),
    [searchParams],
  );

  useEffect(() => {
    if (!requestedUser.userId || !requestedUser.username) {
      return;
    }

    const id = `user-${requestedUser.userId}`;

    setConversations((current) => {
      if (current.some((conversation) => conversation.userId === requestedUser.userId)) {
        return current;
      }

      return [
        {
          id,
          userId: requestedUser.userId,
          username: requestedUser.username,
          name: requestedUser.username,
          initials: getInitials(requestedUser.username),
          location: "Public profile",
          online: false,
          lastSeen: "New chat",
          unread: 0,
          messages: [
            {
              id: 1,
              from: "system",
              text: "This is a frontend preview. Messages are stored only on this page for now.",
              time: "Now",
            },
          ],
        },
        ...current,
      ];
    });

    setActiveId(id);
  }, [requestedUser]);

  const filteredConversations = conversations.filter((conversation) => {
    const query = filter.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      conversation.name.toLowerCase().includes(query) ||
      conversation.username.toLowerCase().includes(query) ||
      conversation.location.toLowerCase().includes(query)
    );
  });

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) || conversations[0];

  const handleSend = (event) => {
    event.preventDefault();
    const text = draft.trim();

    if (!text || !activeConversation) {
      return;
    }

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversation.id
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                {
                  id: Date.now(),
                  from: "me",
                  text,
                  time,
                },
              ],
            }
          : conversation,
      ),
    );
    setDraft("");
  };

  return (
    <main className="chat-page page-fade-in">
      <section className="chat-shell">
        <aside className="chat-sidebar">
          <div className="chat-sidebar__head">
            <div>
              <p>Messages</p>
              <h1>Chat</h1>
            </div>
            <span>{conversations.length}</span>
          </div>

          <label className="chat-search">
            <Search size={16} aria-hidden="true" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search chats..."
            />
          </label>

          <div className="chat-list">
            {filteredConversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className={`chat-list__item${conversation.id === activeConversation.id ? " chat-list__item--active" : ""}`}
                onClick={() => setActiveId(conversation.id)}
              >
                <span className="chat-avatar">
                  {conversation.initials}
                  {conversation.online && <i aria-label="Online" />}
                </span>
                <span className="chat-list__copy">
                  <strong>{conversation.name}</strong>
                  <small>{conversation.messages.at(-1)?.text}</small>
                </span>
                {conversation.unread > 0 && <b>{conversation.unread}</b>}
              </button>
            ))}
          </div>
        </aside>

        <section className="chat-panel">
          <header className="chat-panel__head">
            <div className="chat-avatar chat-avatar--large">
              {activeConversation.initials}
              {activeConversation.online && <i aria-label="Online" />}
            </div>
            <div>
              <h2>{activeConversation.name}</h2>
              <p>{activeConversation.lastSeen} - {activeConversation.location}</p>
            </div>
            <button type="button" className="chat-icon-btn" aria-label="More chat options">
              <MoreHorizontal size={20} />
            </button>
          </header>

          <div className="chat-safety">
            <ShieldCheck size={16} />
            <span>Frontend preview only. Messages are not saved to backend yet.</span>
          </div>

          <div className="chat-messages">
            {activeConversation.messages.map((message) => (
              <div
                key={message.id}
                className={`chat-message chat-message--${message.from}`}
              >
                <p>{message.text}</p>
                <span>{message.time}</span>
              </div>
            ))}
          </div>

          <form className="chat-composer" onSubmit={handleSend}>
            <button type="button" aria-label="Attach file">
              <Paperclip size={18} />
            </button>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Message ${activeConversation.name}...`}
            />
            <button type="submit" className="chat-composer__send" aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
        </section>
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

export default Chat;
