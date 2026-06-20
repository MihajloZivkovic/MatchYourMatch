import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { decryptChatBody, encryptChatBody } from "../utils/chatCrypto";

const USER_ID_CLAIM =
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
const USER_ID_CLAIMS = [
  USER_ID_CLAIM,
  "nameid",
  "sub",
  "userId",
  "userid",
  "id",
];
const ROLE_CLAIMS = [ROLE_CLAIM, "role", "roles"];
const BACKEND_UNAVAILABLE_MESSAGE =
  "Backend is not available. Please start the API server and try again.";
const BACKEND_RETRY_COOLDOWN_MS = 30000;

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [auth, setAuth] = useState(() => getAuthInfo());
  const canSendMessages = auth.role?.toLowerCase() === "user";
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const conversationsRef = useRef([]);
  const hasLoadedConversationsRef = useRef(false);
  const backendUnavailableUntilRef = useRef(0);

  const resetChatState = useCallback(() => {
    conversationsRef.current = [];
    hasLoadedConversationsRef.current = false;
    backendUnavailableUntilRef.current = 0;
    setConversations([]);
    setMessagesByConversation({});
    setActiveConversationId(null);
    setLoadingConversations(false);
    setLoadingMessages(false);
    setError("");
  }, []);

  useEffect(() => {
    const refreshAuth = () => {
      const nextAuth = getAuthInfo();

      setAuth((current) => {
        if (current.userId !== nextAuth.userId || current.role !== nextAuth.role) {
          resetChatState();
        }

        return nextAuth;
      });
    };

    const handleStorage = (event) => {
      if (event.key === "token" || event.key === "mym_authed") {
        refreshAuth();
      }
    };

    window.addEventListener("tokenChanged", refreshAuth);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("tokenChanged", refreshAuth);
      window.removeEventListener("storage", handleStorage);
    };
  }, [resetChatState]);

  const apiFetch = useCallback(async (url, options = {}) => {
    const { skipBackendCooldown = false, silentNetworkError = false, ...fetchOptions } = options;
    const now = Date.now();

    if (!skipBackendCooldown && backendUnavailableUntilRef.current > now) {
      throw new Error(BACKEND_UNAVAILABLE_MESSAGE);
    }

    const token = localStorage.getItem("token");
    const method = fetchOptions.method || "GET";
    const requestBody = fetchOptions.body || null;
    let response;

    try {
      response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
          ...(fetchOptions.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      backendUnavailableUntilRef.current = Date.now() + BACKEND_RETRY_COOLDOWN_MS;

      if (!silentNetworkError) {
        console.debug("[Chat API] backend unavailable; pausing chat polling briefly", {
          url,
          method,
          body: requestBody,
          message: error.message,
          hasToken: Boolean(token),
        });
      }

      throw new Error(BACKEND_UNAVAILABLE_MESSAGE);
    }

    if (backendUnavailableUntilRef.current) {
      backendUnavailableUntilRef.current = 0;
    }

    if (!response.ok) {
      const message = await response.text();
      console.debug("[Chat API] request failed", {
        url,
        method,
        body: requestBody,
        status: response.status,
        responseBody: message,
        hasToken: Boolean(token),
        hasAuthorizationHeader: Boolean(token),
      });
      throw new Error(getFriendlyChatError(message, response.status, url));
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }, []);

  const loadConversations = useCallback(async ({ silent = false, retryNow = false } = {}) => {
    if (!silent && !hasLoadedConversationsRef.current) {
      setLoadingConversations(true);
    }

    try {
      const data = await apiFetch("/api/Chat/conversations", {
        silentNetworkError: silent,
        skipBackendCooldown: retryNow,
      });
      const decrypted = await Promise.all(
        data.map(async (conversation) => ({
          ...conversation,
          lastMessagePreview: conversation.lastMessagePreview
            ? await decryptChatBody(
                conversation.lastMessagePreview,
                auth.userId,
                getConversationPeerId(conversation),
              )
            : conversation.lastMessagePreview,
        })),
      );

      conversationsRef.current = decrypted;
      hasLoadedConversationsRef.current = true;
      setConversations(decrypted);
      setError("");
      setActiveConversationId((current) => {
        if (current && decrypted.some((conversation) => conversation.conversationId === current)) {
          return current;
        }

        return decrypted[0]?.conversationId || null;
      });
      return decrypted;
    } catch (err) {
      setError(err.message || "Chat could not be loaded.");
      if (!hasLoadedConversationsRef.current) {
        setConversations([]);
        conversationsRef.current = [];
      }
      return [];
    } finally {
      if (!silent || !hasLoadedConversationsRef.current) {
        setLoadingConversations(false);
      }
    }
  }, [apiFetch, auth.userId]);

  const loadMessages = useCallback(
    async (conversationId, { silent = false, markRead = true } = {}) => {
      if (!conversationId) return [];

      if (!silent) {
        setLoadingMessages(true);
      }

      try {
        const data = await apiFetch(`/api/Chat/conversations/${conversationId}/messages`, {
          silentNetworkError: silent,
        });
        const activeConversation =
          conversationsRef.current.find(
            (conversation) => conversation.conversationId === conversationId,
          ) || null;
        const decrypted = await Promise.all(
          data.map(async (message) =>
            normalizeChatMessage(
              {
                ...message,
                displayBody: await decryptChatBody(
                  message.body,
                  auth.userId,
                  getConversationPeerId(activeConversation) ||
                    (String(message.senderId) === String(auth.userId)
                      ? message.receiverId
                      : message.senderId),
                ),
              },
              auth.userId,
            ),
          ),
        );

        setMessagesByConversation((current) => ({
          ...current,
          [conversationId]: decrypted,
        }));

        if (markRead) {
          await apiFetch(`/api/Chat/conversations/${conversationId}/read`, {
            method: "PUT",
          });
          setConversations((current) => updateConversationList(current, conversationId, { unreadCount: 0 }));
          conversationsRef.current = updateConversationList(conversationsRef.current, conversationId, {
            unreadCount: 0,
          });
        }

        return decrypted;
      } catch (err) {
        setError(err.message || "Messages could not be loaded.");
        return [];
      } finally {
        if (!silent) {
          setLoadingMessages(false);
        }
      }
    },
    [apiFetch, auth.userId],
  );

  const startConversation = useCallback(
    async (otherUserId) => {
      if (!canSendMessages) return null;

      const started = await apiFetch("/api/Chat/conversations/start", {
        method: "POST",
        body: JSON.stringify({ otherUserId }),
      });
      await loadConversations({ silent: true });
      setActiveConversationId(started.conversationId);
      return started;
    },
    [apiFetch, canSendMessages, loadConversations],
  );

  const createGroupConversation = useCallback(
    async ({ groupName, memberUserIds }) => {
      if (!canSendMessages) return null;

      const created = await apiFetch("/api/Chat/groups", {
        method: "POST",
        body: JSON.stringify({ groupName, memberUserIds }),
      });
      await loadConversations({ silent: true });
      setActiveConversationId(created.conversationId);
      return created;
    },
    [apiFetch, canSendMessages, loadConversations],
  );

  const sendMessage = useCallback(
    async (conversationId, text) => {
      const conversation =
        conversationsRef.current.find((item) => item.conversationId === conversationId) || null;
      const body = text.trim();

      if (!body || !conversation || !canSendMessages) {
        return null;
      }

      const encryptedBody = await encryptChatBody(body, auth.userId, getConversationPeerId(conversation));
      const sent = await apiFetch("/api/Chat/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          body: encryptedBody,
        }),
      });
      const displayMessage = normalizeChatMessage({ ...sent, displayBody: body, isMine: true }, auth.userId);

      setMessagesByConversation((current) => ({
        ...current,
        [conversationId]: [...(current[conversationId] || []), displayMessage],
      }));
      await loadConversations({ silent: true });
      return displayMessage;
    },
    [apiFetch, auth.userId, canSendMessages, loadConversations],
  );

  const editMessage = useCallback(
    async (message, text) => {
      const conversation =
        conversationsRef.current.find((item) => item.conversationId === message.conversationId) || null;
      const body = text.trim();

      if (!body || !conversation || !canSendMessages) {
        return null;
      }

      const encryptedBody = await encryptChatBody(body, auth.userId, getConversationPeerId(conversation));
      const updated = await apiFetch(`/api/Chat/messages/${message.id}`, {
        method: "PATCH",
        body: JSON.stringify({ body: encryptedBody }),
      });
      const displayMessage = normalizeChatMessage({ ...updated, displayBody: body, isMine: true }, auth.userId);

      setMessagesByConversation((current) => ({
        ...current,
        [message.conversationId]: (current[message.conversationId] || []).map((item) =>
          item.id === message.id ? displayMessage : item,
        ),
      }));
      await loadConversations({ silent: true });
      return displayMessage;
    },
    [apiFetch, auth.userId, canSendMessages, loadConversations],
  );

  const deleteMessageForMe = useCallback(
    async (message) => {
      await apiFetch(`/api/Chat/messages/${message.id}/for-me`, {
        method: "DELETE",
      });
      setMessagesByConversation((current) => ({
        ...current,
        [message.conversationId]: (current[message.conversationId] || []).filter(
          (item) => item.id !== message.id,
        ),
      }));
      await loadConversations({ silent: true });
    },
    [apiFetch, loadConversations],
  );

  const deleteMessageForEveryone = useCallback(
    async (message) => {
      const updated = await apiFetch(`/api/Chat/messages/${message.id}/for-everyone`, {
        method: "DELETE",
      });
      const displayMessage = normalizeChatMessage(
        { ...updated, displayBody: "This message was deleted" },
        auth.userId,
      );

      setMessagesByConversation((current) => ({
        ...current,
        [message.conversationId]: (current[message.conversationId] || []).map((item) =>
          item.id === message.id ? displayMessage : item,
        ),
      }));
      await loadConversations({ silent: true });
      return displayMessage;
    },
    [apiFetch, auth.userId, loadConversations],
  );

  const toggleReaction = useCallback(
    async (message, emoji) => {
      if (!message?.id || !emoji || message.isDeletedForEveryone) {
        return null;
      }

      const updated = await apiFetch(`/api/Chat/messages/${message.id}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      const displayMessage = normalizeChatMessage(
        {
          ...message,
          ...updated,
          displayBody: message.displayBody ?? message.body,
        },
        auth.userId,
      );

      setMessagesByConversation((current) => ({
        ...current,
        [message.conversationId]: (current[message.conversationId] || []).map((item) =>
          item.id === message.id ? displayMessage : item,
        ),
      }));

      return displayMessage;
    },
    [apiFetch, auth.userId],
  );

  const hideConversation = useCallback(
    async (conversationId) => {
      await apiFetch(`/api/Chat/conversations/${conversationId}`, {
        method: "DELETE",
      });
      setConversations((current) => current.filter((item) => item.conversationId !== conversationId));
      conversationsRef.current = conversationsRef.current.filter(
        (item) => item.conversationId !== conversationId,
      );
      setActiveConversationId((current) => {
        if (current !== conversationId) return current;
        return conversationsRef.current[0]?.conversationId || null;
      });
    },
    [apiFetch],
  );

  const setTyping = useCallback(
    (conversationId, isTyping) => {
      if (!conversationId || !canSendMessages) return;

      apiFetch("/api/Chat/typing", {
        method: "POST",
        silentNetworkError: true,
        body: JSON.stringify({
          conversationId,
          isTyping,
        }),
      }).catch(() => {});
    },
    [apiFetch, canSendMessages],
  );

  const getTypingState = useCallback(
    async (conversationId) => {
      if (!conversationId) return false;
      const result = await apiFetch(`/api/Chat/conversations/${conversationId}/typing`, {
        silentNetworkError: true,
      });
      return Boolean(result?.isTyping);
    },
    [apiFetch],
  );

  useEffect(() => {
    if (!auth.userId) {
      resetChatState();
      return undefined;
    }

    loadConversations();
    const intervalId = window.setInterval(() => {
      loadConversations({ silent: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [auth.userId, loadConversations, resetChatState]);

  const value = useMemo(
    () => ({
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
      createGroupConversation,
      sendMessage,
      editMessage,
      deleteMessageForMe,
      deleteMessageForEveryone,
      toggleReaction,
      hideConversation,
      setTyping,
      getTypingState,
      setError,
    }),
    [
      activeConversationId,
      apiFetch,
      auth,
      canSendMessages,
      conversations,
      deleteMessageForEveryone,
      deleteMessageForMe,
      editMessage,
      error,
      getTypingState,
      hideConversation,
      loadConversations,
      loadMessages,
      loadingConversations,
      loadingMessages,
      messagesByConversation,
      sendMessage,
      setTyping,
      startConversation,
      createGroupConversation,
      toggleReaction,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error("useChat must be used inside ChatProvider.");
  }

  return context;
}

function updateConversationList(conversations, conversationId, patch) {
  return conversations.map((conversation) =>
    conversation.conversationId === conversationId ? { ...conversation, ...patch } : conversation,
  );
}

function normalizeChatMessage(message, currentUserId) {
  const backendIsMine =
    typeof message.isMine === "boolean"
      ? message.isMine
      : typeof message.IsMine === "boolean"
        ? message.IsMine
        : null;

  const reactions = Array.isArray(message.reactions)
    ? message.reactions
    : Array.isArray(message.Reactions)
      ? message.Reactions
      : [];

  return {
    ...message,
    reactions: reactions.map((reaction) => ({
      emoji: reaction.emoji ?? reaction.Emoji,
      count: reaction.count ?? reaction.Count ?? 0,
      reactedByCurrentUser:
        reaction.reactedByCurrentUser ?? reaction.ReactedByCurrentUser ?? false,
    })),
    currentUserReaction: message.currentUserReaction ?? message.CurrentUserReaction ?? null,
    isMine:
      backendIsMine ??
      (currentUserId != null && Number(message.senderId) === Number(currentUserId)),
  };
}

function getConversationPeerId(conversation) {
  if (!conversation) return null;
  return conversation.isGroup
    ? `group:${conversation.conversationId}`
    : conversation.otherUserId;
}

function getFriendlyChatError(message, status, url) {
  if (status === 401) return "Chat request failed: you are not logged in.";
  if (status === 403) return "Chat request failed: you do not have access to this conversation.";
  if (status === 404) return `Chat request failed: ${url} was not found.`;
  if (status >= 500) {
    if (message?.toLowerCase().includes("chat service is not ready")) {
      return "Chat service is not ready yet. Please refresh after the backend restarts.";
    }

    return "Chat is temporarily unavailable. Please try again.";
  }

  if (message) {
    return message;
  }

  return `Chat request failed (${status}).`;
}

function getAuthInfo() {
  const token = localStorage.getItem("token");
  if (!token) return { userId: null, role: "" };

  try {
    const decoded = jwtDecode(token);
    const rawUserId = USER_ID_CLAIMS.map((claim) => decoded[claim]).find(Boolean);
    const rawRole = ROLE_CLAIMS.map((claim) => decoded[claim]).find(Boolean);

    return {
      userId: rawUserId == null ? null : String(rawUserId),
      role: Array.isArray(rawRole) ? rawRole[0] || "" : rawRole || "",
    };
  } catch {
    return { userId: null, role: "" };
  }
}
