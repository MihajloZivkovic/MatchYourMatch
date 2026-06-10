import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Minus, Send, X } from "lucide-react";
import "./FloatingChat.css";

const conversations = [
  {
    id: "demo03",
    name: "lena.demo03",
    initials: "LD",
    online: true,
    unread: 2,
    messages: [
      { id: 1, from: "them", text: "Saturday afternoon sounds good.", time: "18:08" },
      { id: 2, from: "me", text: "Perfect. Coffee first?", time: "18:09" },
    ],
  },
  {
    id: "demo15",
    name: "nina.demo15",
    initials: "ND",
    online: false,
    unread: 0,
    messages: [
      { id: 1, from: "them", text: "That live music event looks fun.", time: "16:20" },
    ],
  },
  {
    id: "demo18",
    name: "aleksandar.demo18",
    initials: "AD",
    online: true,
    unread: 0,
    messages: [
      { id: 1, from: "them", text: "Board games or coffee first?", time: "12:10" },
    ],
  },
];

function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [activeId, setActiveId] = useState(conversations[0].id);
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState({});

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) || conversations[0];

  const activeMessages = useMemo(
    () => [...activeConversation.messages, ...(localMessages[activeConversation.id] || [])],
    [activeConversation, localMessages],
  );

  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unread, 0);

  const handleSend = (event) => {
    event.preventDefault();
    const text = draft.trim();

    if (!text) {
      return;
    }

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setLocalMessages((current) => ({
      ...current,
      [activeConversation.id]: [
        ...(current[activeConversation.id] || []),
        {
          id: Date.now(),
          from: "me",
          text,
          time,
        },
      ],
    }));
    setDraft("");
  };

  if (!open) {
    return (
      <button
        type="button"
        className="floating-chat__launcher"
        aria-label="Open chat"
        onClick={() => {
          setOpen(true);
          setMinimized(false);
        }}
      >
        <MessageCircle size={22} />
        {unreadTotal > 0 && <span>{unreadTotal}</span>}
      </button>
    );
  }

  return (
    <aside className={`floating-chat${minimized ? " floating-chat--minimized" : ""}`}>
      <header className="floating-chat__head">
        <button type="button" className="floating-chat__person" onClick={() => setMinimized(false)}>
          <span className="floating-chat__avatar">
            {activeConversation.initials}
            {activeConversation.online && <i />}
          </span>
          <span>
            <strong>{activeConversation.name}</strong>
            <small>{activeConversation.online ? "Active now" : "Frontend preview"}</small>
          </span>
        </button>
        <div className="floating-chat__controls">
          <button type="button" aria-label="Minimize chat" onClick={() => setMinimized((value) => !value)}>
            <Minus size={17} />
          </button>
          <button type="button" aria-label="Close chat" onClick={() => setOpen(false)}>
            <X size={17} />
          </button>
        </div>
      </header>

      {!minimized && (
        <>
          <div className="floating-chat__body">
            <div className="floating-chat__threads">
              {conversations.map((conversation) => (
                <button
                  type="button"
                  key={conversation.id}
                  className={`floating-chat__thread${conversation.id === activeConversation.id ? " floating-chat__thread--active" : ""}`}
                  onClick={() => setActiveId(conversation.id)}
                  aria-label={`Open chat with ${conversation.name}`}
                >
                  <span className="floating-chat__avatar floating-chat__avatar--small">
                    {conversation.initials}
                    {conversation.online && <i />}
                  </span>
                  {conversation.unread > 0 && <b>{conversation.unread}</b>}
                </button>
              ))}
            </div>

            <div className="floating-chat__messages">
              {activeMessages.map((message) => (
                <div
                  key={message.id}
                  className={`floating-chat__message floating-chat__message--${message.from}`}
                >
                  <p>{message.text}</p>
                  <span>{message.time}</span>
                </div>
              ))}
            </div>
          </div>

          <form className="floating-chat__composer" onSubmit={handleSend}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Message..."
            />
            <button type="submit" aria-label="Send message">
              <Send size={16} />
            </button>
          </form>

          <Link className="floating-chat__full" to="/app/chat">
            View all messages
          </Link>
        </>
      )}
    </aside>
  );
}

export default FloatingChat;
