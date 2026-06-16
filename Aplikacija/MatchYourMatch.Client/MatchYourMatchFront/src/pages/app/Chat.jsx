import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Check, CheckCheck, Clock, MoreHorizontal, Paperclip, Search, Send, ShieldCheck, UserPlus, X } from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal";
import { useChat } from "../../context/ChatContext";
import "./Chat.css";

function Chat() {
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [peopleResults, setPeopleResults] = useState([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [messageMenu, setMessageMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const typingTimeoutRef = useRef(null);
  const startedFromUrlRef = useRef("");
  const messagesViewportRef = useRef(null);
  const messagesEndRef = useRef(null);
  const previousConversationIdRef = useRef(null);
  const isNearBottomRef = useRef(true);

  const {
    auth,
    canSendMessages,
    conversations,
    messagesByConversation,
    activeConversationId,
    loadingConversations,
    loadingMessages,
    error,
    apiFetch,
    setActiveConversationId,
    loadConversations,
    loadMessages,
    startConversation,
    sendMessage,
    editMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    hideConversation,
    setTyping,
    getTypingState,
    setError,
  } = useChat();

  const requestedUser = useMemo(
    () => ({
      userId: Number(searchParams.get("userId")),
      username: searchParams.get("username") || "",
    }),
    [searchParams],
  );

  useEffect(() => {
    if (!requestedUser.userId || !canSendMessages) return;

    const requestKey = `${requestedUser.userId}:${requestedUser.username}`;
    if (startedFromUrlRef.current === requestKey) return;
    startedFromUrlRef.current = requestKey;

    let cancelled = false;

    const startFromUrl = async () => {
      try {
        const started = await startConversation(requestedUser.userId);
        if (!cancelled && started?.conversationId) {
          setActiveConversationId(started.conversationId);
          await loadMessages(started.conversationId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Conversation could not be started.");
        }
      }
    };

    startFromUrl();

    return () => {
      cancelled = true;
    };
  }, [
    canSendMessages,
    loadMessages,
    requestedUser.userId,
    requestedUser.username,
    setActiveConversationId,
    setError,
    startConversation,
  ]);

  useEffect(() => {
    if (!activeConversationId) return;
    loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    if (!activeConversationId) return;

    const intervalId = window.setInterval(() => {
      loadMessages(activeConversationId, { silent: true }).catch(() => {});
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    if (!activeConversationId) return;

    let cancelled = false;

    const pollTyping = async () => {
      try {
        const result = await getTypingState(activeConversationId);
        if (!cancelled) {
          setOtherUserTyping(result);
        }
      } catch {
        if (!cancelled) {
          setOtherUserTyping(false);
        }
      }
    };

    pollTyping();
    const intervalId = window.setInterval(pollTyping, 1400);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeConversationId, getTypingState]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const query = filter.trim();

    if (query.length < 2) {
      setPeopleResults([]);
      setSearchingPeople(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchingPeople(true);

      try {
        const result = await apiFetch(`/api/Search?query=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });

        setPeopleResults(result?.people || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setPeopleResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchingPeople(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [apiFetch, filter]);

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        const query = filter.trim().toLowerCase();
        if (!query) return true;

        return (
          conversation.otherDisplayName?.toLowerCase().includes(query) ||
          conversation.otherUsername.toLowerCase().includes(query)
        );
      }),
    [conversations, filter],
  );

  const conversationUserIds = useMemo(
    () => new Set(conversations.map((conversation) => Number(conversation.otherUserId))),
    [conversations],
  );

  const filteredPeopleResults = useMemo(
    () =>
      peopleResults.filter(
        (person) =>
          Number(person.id) !== Number(auth.userId) &&
          !conversationUserIds.has(Number(person.id)),
      ),
    [auth.userId, conversationUserIds, peopleResults],
  );

  const activeConversation =
    conversations.find((conversation) => conversation.conversationId === activeConversationId) ||
    filteredConversations[0] ||
    conversations[0] ||
    null;
  const messages = messagesByConversation[activeConversation?.conversationId] || [];

  const scrollMessagesToBottom = useCallback((behavior = "auto") => {
    const element = messagesViewportRef.current;
    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior,
    });
  }, []);

  useEffect(() => {
    const conversationId = activeConversation?.conversationId || null;
    const conversationChanged = previousConversationIdRef.current !== conversationId;
    const lastMessage = messages[messages.length - 1];
    const lastMessageIsMine = isMessageMine(lastMessage, auth.userId);

    if (conversationChanged || lastMessageIsMine || isNearBottomRef.current) {
      window.requestAnimationFrame(() => scrollMessagesToBottom(conversationChanged ? "auto" : "smooth"));
    }

    previousConversationIdRef.current = conversationId;
  }, [activeConversation?.conversationId, auth.userId, messages, scrollMessagesToBottom]);

  const handleMessagesScroll = () => {
    const element = messagesViewportRef.current;
    if (!element) return;

    isNearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const text = draft.trim();

    if (!text || !activeConversation || sending || !canSendMessages) {
      return;
    }

    setSending(true);
    setError("");

    try {
      if (editingMessage) {
        await editMessage(editingMessage, text);
        setEditingMessage(null);
      } else {
        await sendMessage(activeConversation.conversationId, text);
      }
      setDraft("");
      notifyTyping(false);
    } catch (err) {
      setError(err.message || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const notifyTyping = useCallback(
    (isTyping) => {
      if (!activeConversation || !canSendMessages) return;
      setTyping(activeConversation.conversationId, isTyping);
    },
    [activeConversation, canSendMessages, setTyping],
  );

  const handleDraftChange = (event) => {
    const value = event.target.value;
    setDraft(value);

    if (!value.trim()) {
      notifyTyping(false);
      return;
    }

    notifyTyping(true);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      notifyTyping(false);
    }, 2200);
  };

  useEffect(() => {
    if (!messageMenu) return undefined;

    const closeMenu = () => setMessageMenu(null);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMessageMenu(null);
        if (editingMessage) {
          setEditingMessage(null);
          setDraft("");
        }
      }
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editingMessage, messageMenu]);

  const openMessageMenu = (event, message) => {
    event.preventDefault();
    const width = 190;
    const height = 132;
    setMessageMenu({
      message,
      x: Math.min(event.clientX, window.innerWidth - width - 8),
      y: Math.min(event.clientY, window.innerHeight - height - 8),
    });
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setDraft(message.displayBody ?? message.body ?? "");
    setMessageMenu(null);
  };

  const handleDeleteForMe = (message) => {
    setMessageMenu(null);
    setConfirmDialog({
      action: "forMe",
      message,
      title: "Delete message?",
      body: "This message will be removed only for you.",
      confirmText: "Delete",
    });
  };

  const handleDeleteForEveryone = (message) => {
    setMessageMenu(null);
    setConfirmDialog({
      action: "forEveryone",
      message,
      title: "Delete message for everyone?",
      body: "This action will remove the message for all conversation participants.",
      confirmText: "Delete for everyone",
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDialog || confirmLoading) return;

    setConfirmLoading(true);

    try {
      if (confirmDialog.action === "forEveryone") {
        await deleteMessageForEveryone(confirmDialog.message);
      } else {
        await deleteMessageForMe(confirmDialog.message);
      }
      setConfirmDialog(null);
    } catch (err) {
      setError(err.message || "Message could not be deleted.");
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancelConfirm = () => {
    if (confirmLoading) return;
    setConfirmDialog(null);
  };

  const handleStartWithPerson = async (person) => {
    if (!canSendMessages) return;

    setError("");

    try {
      const started = await startConversation(person.id);
      if (started?.conversationId) {
        setActiveConversationId(started.conversationId);
        await loadMessages(started.conversationId);
      }
      setFilter("");
      setPeopleResults([]);
    } catch (err) {
      setError(err.message || "Conversation could not be started.");
    }
  };

  const handleHideConversation = async (conversationId) => {
    try {
      await hideConversation(conversationId);
    } catch (err) {
      setError(err.message || "Conversation could not be hidden.");
    }
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
            {loadingConversations && conversations.length === 0 && (
              <div className="chat-state">Loading conversations...</div>
            )}
            {!loadingConversations && error && conversations.length === 0 && (
              <div className="chat-state chat-state--error">
                <span>{error}</span>
                <button type="button" onClick={() => loadConversations({ retryNow: true })}>
                  Retry
                </button>
              </div>
            )}
            {!loadingConversations && !error && filteredConversations.length === 0 && (
              <div className="chat-state">
                {conversations.length === 0 ? "No conversations to show." : "No matching chats."}
              </div>
            )}
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.conversationId}
                className={`chat-list__row${
                  conversation.conversationId === activeConversation?.conversationId
                    ? " chat-list__row--active"
                    : ""
                }`}
                role="button"
                tabIndex={0}
                onClick={() => setActiveConversationId(conversation.conversationId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveConversationId(conversation.conversationId);
                  }
                }}
              >
                <div className="chat-list__item">
                  <span className="chat-avatar">
                    {conversation.otherAvatar ? (
                      <img src={conversation.otherAvatar} alt="" />
                    ) : (
                      conversation.otherInitials || getInitials(conversation.otherUsername)
                    )}
                  </span>
                  <span className="chat-list__copy">
                    <strong>{conversation.otherDisplayName || conversation.otherUsername}</strong>
                    <small>{conversation.lastMessagePreview || "No messages yet"}</small>
                  </span>
                  {conversation.unreadCount > 0 && <b>{conversation.unreadCount}</b>}
                </div>
                <button
                  type="button"
                  className="chat-list__dismiss"
                  title="Hide conversation"
                  aria-label="Hide conversation"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleHideConversation(conversation.conversationId);
                  }}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
            {filter.trim().length >= 2 && (
              <div className="chat-list__section">
                <span>People</span>
              </div>
            )}
            {searchingPeople && <div className="chat-state">Searching people...</div>}
            {!searchingPeople &&
              filter.trim().length >= 2 &&
              filteredPeopleResults.length === 0 && (
                <div className="chat-state">No new people found.</div>
              )}
            {!searchingPeople &&
              filteredPeopleResults.map((person) => (
                <button
                  key={`person-${person.id}`}
                  type="button"
                  className="chat-list__item chat-list__item--person"
                  onClick={() => handleStartWithPerson(person)}
                >
                  <span className="chat-avatar">
                    {getInitials(person.displayName || person.username)}
                  </span>
                  <span className="chat-list__copy">
                    <strong>{person.displayName || person.username}</strong>
                    <small>
                      {person.locationDisplayName ||
                        person.tags?.slice(0, 2).join(", ") ||
                        "Start a new chat"}
                    </small>
                  </span>
                  <UserPlus size={16} aria-hidden="true" />
                </button>
              ))}
          </div>
        </aside>

        <section className="chat-panel">
          {activeConversation ? (
            <>
              <header className="chat-panel__head">
                <div className="chat-avatar chat-avatar--large">
                  {activeConversation.otherAvatar ? (
                    <img src={activeConversation.otherAvatar} alt="" />
                  ) : (
                    activeConversation.otherInitials ||
                    getInitials(activeConversation.otherUsername)
                  )}
                </div>
                <div>
                  <h2>{activeConversation.otherDisplayName || activeConversation.otherUsername}</h2>
                  <p>{formatDateTime(activeConversation.lastMessageAt) || "New conversation"}</p>
                </div>
                <button type="button" className="chat-icon-btn" aria-label="More chat options">
                  <MoreHorizontal size={20} />
                </button>
              </header>

              {error && <div className="chat-error">{error}</div>}

              <div className="chat-messages" ref={messagesViewportRef} onScroll={handleMessagesScroll}>
                {loadingMessages && messages.length === 0 && (
                  <div className="chat-state">Loading messages...</div>
                )}
                {!loadingMessages && messages.length === 0 && (
                  <div className="chat-message chat-message--system">
                    <span className="chat-safety chat-safety--empty">
                      <ShieldCheck size={16} />
                      <span>
                        Messages use browser-side privacy protection before storage. This is a privacy MVP, not full E2EE.
                      </span>
                    </span>
                    <p>Start the conversation with a thoughtful first message.</p>
                  </div>
                )}
                {!loadingMessages &&
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`chat-message chat-message--${
                        isMessageMine(message, auth.userId) ? "me" : "them"
                      }${message.isDeletedForEveryone ? " chat-message--deleted" : ""}`}
                      onContextMenu={(event) => openMessageMenu(event, message)}
                    >
                      <p>{message.isDeletedForEveryone ? "This message was deleted" : message.displayBody ?? message.body}</p>
                      <div className="chat-message__meta">
                        <span>{formatTime(message.createdAt)}</span>
                        {message.editedAt && !message.isDeletedForEveryone && <span title={formatDateTime(message.editedAt)}>edited</span>}
                        {isMessageMine(message, auth.userId) && (
                          <MessageStatusIcon message={message} />
                        )}
                      </div>
                    </div>
                  ))}
                {!loadingMessages && otherUserTyping && (
                  <TypingIndicator className="chat-message chat-message--them" />
                )}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>

              {canSendMessages ? (
                <form className="chat-composer" onSubmit={handleSend}>
                  {editingMessage && (
                    <div className="chat-composer__editing">
                      <span>Editing message</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessage(null);
                          setDraft("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  <button type="button" aria-label="Attach file" disabled>
                    <Paperclip size={18} />
                  </button>
                  <input
                    value={draft}
                    onChange={handleDraftChange}
                    placeholder={`Message ${
                      activeConversation.otherDisplayName || activeConversation.otherUsername
                    }...`}
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    className="chat-composer__send"
                    aria-label={editingMessage ? "Save message" : "Send message"}
                    disabled={sending || !draft.trim()}
                  >
                    <Send size={18} />
                  </button>
                </form>
              ) : (
                <div className="chat-composer chat-composer--disabled">
                  Chat sending is available only to ordinary users.
                </div>
              )}
            </>
          ) : (
            <div className="chat-empty-panel">
              <ShieldCheck size={24} />
              <h2>No chat selected</h2>
              <p>Open a user profile or suggested connection to start a conversation.</p>
              {error && <span>{error}</span>}
            </div>
          )}
        </section>
      </section>
      {messageMenu && (
        <MessageContextMenu
          menu={messageMenu}
          currentUserId={auth.userId}
          onEdit={handleEditMessage}
          onDeleteForMe={handleDeleteForMe}
          onDeleteForEveryone={handleDeleteForEveryone}
        />
      )}
      <ConfirmModal
        isOpen={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.body}
        confirmText={confirmDialog?.confirmText}
        cancelText="Cancel"
        variant="danger"
        isLoading={confirmLoading}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelConfirm}
      />
    </main>
  );
}

function MessageContextMenu({ menu, currentUserId, onEdit, onDeleteForMe, onDeleteForEveryone }) {
  const isMine = isMessageMine(menu.message, currentUserId);

  return createPortal(
    <div
      className="chat-message-menu"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
    >
      {isMine && !menu.message.isDeletedForEveryone && (
        <button type="button" onClick={() => onEdit(menu.message)}>
          Edit message
        </button>
      )}
      <button type="button" onClick={() => onDeleteForMe(menu.message)}>
        Delete for myself
      </button>
      {isMine && !menu.message.isDeletedForEveryone && (
        <button type="button" className="chat-message-menu__danger" onClick={() => onDeleteForEveryone(menu.message)}>
          Delete for everyone
        </button>
      )}
    </div>,
    document.body,
  );
}

function isMessageMine(message, currentUserId) {
  if (!message) return false;
  if (typeof message.isMine === "boolean") return message.isMine;
  return Number(message.senderId) === Number(currentUserId);
}

function TypingIndicator({ className }) {
  return (
    <div className={`${className} chat-typing`} aria-label="Typing">
      <p>
        <i />
        <i />
        <i />
      </p>
    </div>
  );
}

function MessageStatusIcon({ message }) {
  const status = getMessageStatus(message);
  const Icon = status === "Read" ? CheckCheck : status === "Delivered" ? CheckCheck : status === "Sent" ? Check : Clock;

  return (
    <span className="chat-message__status" title={status} aria-label={status}>
      <Icon size={13} strokeWidth={2.4} />
    </span>
  );
}

function getMessageStatus(message) {
  if (message.readAt) return "Read";
  if (message.id) return "Delivered";
  return "Sending";
}

function formatTime(value) {
  if (!value) return "";
  return parseServerDate(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value) {
  if (!value) return "";
  return parseServerDate(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseServerDate(value) {
  if (typeof value === "string" && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value}Z`);
  }

  return new Date(value);
}

function getInitials(value) {
  return (
    value
      ?.split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "MY"
  );
}

export default Chat;
