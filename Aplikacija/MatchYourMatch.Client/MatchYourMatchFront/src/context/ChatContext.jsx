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
  const canSendMessages = ["user", "organizer"].includes(auth.role?.toLowerCase());
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [messageLoadStateByConversation, setMessageLoadStateByConversation] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const conversationsRef = useRef([]);
  const messagesByConversationRef = useRef({});
  const hasLoadedConversationsRef = useRef(false);
  const backendUnavailableUntilRef = useRef(0);

  const resetChatState = useCallback(() => {
    conversationsRef.current = [];
    messagesByConversationRef.current = {};
    hasLoadedConversationsRef.current = false;
    backendUnavailableUntilRef.current = 0;
    setConversations([]);
    setMessagesByConversation({});
    setMessageLoadStateByConversation({});
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
      const error = new Error(getFriendlyChatError(message, response.status, url));
      error.status = response.status;
      throw error;
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
        data.map(async (conversation) => {
          let lastMessagePreview = conversation.lastMessagePreview;
          if (lastMessagePreview) {
            try {
              lastMessagePreview = await decryptChatBody(
                lastMessagePreview,
                auth.userId,
                getConversationPeerId(conversation),
              );
            } catch (decryptError) {
              console.warn("[Chat privacy] Conversation preview could not be decrypted.", {
                conversationId: conversation.conversationId,
                error: decryptError,
              });
              lastMessagePreview = "Encrypted message could not be opened.";
            }
          }

          if (!lastMessagePreview) {
            lastMessagePreview = getLastMessagePreviewFromMessages(
              messagesByConversationRef.current[conversation.conversationId] || [],
            );
          }

          return { ...conversation, lastMessagePreview };
        }),
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

  const removeUnavailableConversation = useCallback((conversationId) => {
    setMessagesForConversation(setMessagesByConversation, messagesByConversationRef, conversationId, []);
    setMessageLoadStateByConversation((current) => ({
      ...current,
      [conversationId]: { status: "idle", error: "" },
    }));

    const nextConversations = conversationsRef.current.filter(
      (conversation) => conversation.conversationId !== conversationId,
    );
    conversationsRef.current = nextConversations;
    setConversations(nextConversations);
    setActiveConversationId((current) => {
      if (current !== conversationId) return current;
      return nextConversations[0]?.conversationId || null;
    });
  }, []);

  const loadMessages = useCallback(
    async (conversationId, { silent = false, markRead = true } = {}) => {
      if (!conversationId) return [];

      if (!silent) {
        setLoadingMessages(true);
        setMessageLoadStateByConversation((current) => ({
          ...current,
          [conversationId]: { status: "loading", error: "" },
        }));
      }

      try {
        const data = await apiFetch(`/api/Chat/conversations/${conversationId}/messages`, {
          silentNetworkError: silent,
        });
        const activeConversation =
          conversationsRef.current.find(
            (conversation) => conversation.conversationId === conversationId,
          ) || null;
        if (!Array.isArray(data)) {
          throw new Error("Messages response has an invalid format.");
        }

        const decrypted = await Promise.all(data.map(async (message) => {
          let displayBody = message.body ?? message.Body ?? "";
          try {
            displayBody = await decryptChatBody(
              displayBody,
              auth.userId,
              getConversationPeerId(activeConversation) ||
                (String(message.senderId ?? message.SenderId) === String(auth.userId)
                  ? message.receiverId ?? message.ReceiverId
                  : message.senderId ?? message.SenderId),
            );
          } catch (decryptError) {
            console.warn("[Chat privacy] A message could not be decrypted.", {
              conversationId,
              messageId: message.id ?? message.Id,
              error: decryptError,
            });
            displayBody = "Encrypted message could not be opened.";
          }

          return normalizeChatMessage({ ...message, displayBody }, auth.userId);
        }));

        decrypted.sort(compareChatMessages);

        setMessagesForConversation(setMessagesByConversation, messagesByConversationRef, conversationId, decrypted);
        setMessageLoadStateByConversation((current) => ({
          ...current,
          [conversationId]: { status: "success", error: "" },
        }));
        updateConversationPreviewFromMessages(setConversations, conversationsRef, conversationId, decrypted);

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
        const message = err.message || "Messages could not be loaded.";

        if (err.status === 403 || err.status === 404) {
          removeUnavailableConversation(conversationId);
          if (!silent) {
            setError("");
          }
          await loadConversations({ silent: true });
          return [];
        }

        setMessageLoadStateByConversation((current) => ({
          ...current,
          [conversationId]: { status: "error", error: message },
        }));
        return [];
      } finally {
        if (!silent) {
          setLoadingMessages(false);
        }
      }
    },
    [apiFetch, auth.userId, loadConversations, removeUnavailableConversation],
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

      const nextMessages = [
        ...(messagesByConversationRef.current[conversationId] || []),
        displayMessage,
      ];
      setMessagesForConversation(setMessagesByConversation, messagesByConversationRef, conversationId, nextMessages);
      updateConversationPreviewFromMessages(setConversations, conversationsRef, conversationId, nextMessages);
      await loadConversations({ silent: true });
      return displayMessage;
    },
    [apiFetch, auth.userId, canSendMessages, loadConversations],
  );

  const sendAttachment = useCallback(async (conversationId, file, text = "", onProgress) => {
    const conversation = conversationsRef.current.find((item) => item.conversationId === conversationId);
    if (!conversation || !canSendMessages) return null;
    const body = text.trim() ? await encryptChatBody(text.trim(), auth.userId, getConversationPeerId(conversation)) : "";
    const form = new FormData(); form.append("file", file); if (body) form.append("body", body);
    const sent = await new Promise((resolve, reject) => {
      const request = new XMLHttpRequest(); request.open("POST", `/api/Chat/conversations/${conversationId}/attachments`);
      request.setRequestHeader("Authorization", `Bearer ${localStorage.getItem("token")}`);
      request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded * 100 / event.total)); };
      request.onload = () => request.status >= 200 && request.status < 300 ? resolve(JSON.parse(request.responseText)) : reject(new Error(request.responseText || "Upload failed."));
      request.onerror = () => reject(new Error("Upload failed.")); request.send(form);
    });
    const display = normalizeChatMessage({ ...sent, displayBody: text.trim(), isMine: true }, auth.userId);
    const nextMessages = [...(messagesByConversationRef.current[conversationId] || []), display];
    setMessagesForConversation(setMessagesByConversation, messagesByConversationRef, conversationId, nextMessages);
    updateConversationPreviewFromMessages(setConversations, conversationsRef, conversationId, nextMessages);
    await loadConversations({ silent: true }); return display;
  }, [auth.userId, canSendMessages, loadConversations]);

  const sendGif = useCallback(async (conversationId, gif) => {
    const conversation = conversationsRef.current.find((item) => item.conversationId === conversationId);
    if (!conversation || !canSendMessages) return null;
    const plainBody = gif.body?.trim() || "";
    const body = plainBody ? await encryptChatBody(plainBody, auth.userId, getConversationPeerId(conversation)) : null;
    const sent = await apiFetch(`/api/Chat/conversations/${conversationId}/gifs`, { method:"POST", body:JSON.stringify({ ...gif, body }) });
    const display = normalizeChatMessage({ ...sent, displayBody:plainBody, isMine:true }, auth.userId);
    const nextMessages = [...(messagesByConversationRef.current[conversationId] || []), display];
    setMessagesForConversation(setMessagesByConversation, messagesByConversationRef, conversationId, nextMessages);
    updateConversationPreviewFromMessages(setConversations, conversationsRef, conversationId, nextMessages);
    await loadConversations({ silent:true }); return display;
  }, [apiFetch, auth.userId, canSendMessages, loadConversations]);

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

      const nextMessages = (messagesByConversationRef.current[message.conversationId] || []).map((item) =>
        item.id === message.id ? displayMessage : item,
      );
      setMessagesForConversation(
        setMessagesByConversation,
        messagesByConversationRef,
        message.conversationId,
        nextMessages,
      );
      updateConversationPreviewFromMessages(setConversations, conversationsRef, message.conversationId, nextMessages);
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
      const nextMessages = (messagesByConversationRef.current[message.conversationId] || []).filter(
        (item) => item.id !== message.id,
      );
      setMessagesForConversation(
        setMessagesByConversation,
        messagesByConversationRef,
        message.conversationId,
        nextMessages,
      );
      updateConversationPreviewFromMessages(setConversations, conversationsRef, message.conversationId, nextMessages);
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

      const nextMessages = (messagesByConversationRef.current[message.conversationId] || []).map((item) =>
        item.id === message.id ? displayMessage : item,
      );
      setMessagesForConversation(
        setMessagesByConversation,
        messagesByConversationRef,
        message.conversationId,
        nextMessages,
      );
      updateConversationPreviewFromMessages(setConversations, conversationsRef, message.conversationId, nextMessages);
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

      const nextMessages = (messagesByConversationRef.current[message.conversationId] || []).map((item) =>
        item.id === message.id ? displayMessage : item,
      );
      setMessagesForConversation(
        setMessagesByConversation,
        messagesByConversationRef,
        message.conversationId,
        nextMessages,
      );

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
      messageLoadStateByConversation,
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
      sendAttachment,
      sendGif,
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
      messageLoadStateByConversation,
      sendMessage,
      sendAttachment,
      sendGif,
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

function setMessagesForConversation(setter, ref, conversationId, messages) {
  ref.current = {
    ...ref.current,
    [conversationId]: messages,
  };
  setter(ref.current);
}

function updateConversationPreviewFromMessages(setter, ref, conversationId, messages) {
  const lastMessagePreview = getLastMessagePreviewFromMessages(messages);
  const lastMessageAt = getLastMessageCreatedAt(messages);
  const patch = {
    ...(lastMessagePreview ? { lastMessagePreview } : {}),
    ...(lastMessageAt ? { lastMessageAt } : {}),
  };

  if (Object.keys(patch).length === 0) return;

  const next = updateConversationList(ref.current, conversationId, patch);
  ref.current = next;
  setter(next);
}

function getLastMessagePreviewFromMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return "";

  const lastMessage = [...messages].sort(compareChatMessages).at(-1);
  if (!lastMessage) return "";

  if (lastMessage.isDeletedForEveryone ?? lastMessage.IsDeletedForEveryone) {
    return "This message was deleted";
  }

  const body = String(
    lastMessage.displayBody ?? lastMessage.body ?? lastMessage.Body ?? "",
  ).trim();
  if (body) return body;

  const attachment = lastMessage.attachment ?? lastMessage.Attachment;
  if (!attachment) return "";

  const kind = String(attachment.kind ?? attachment.Kind ?? "").toLowerCase();
  if (kind === "gif") return "GIF";

  return (
    attachment.originalFileName ??
    attachment.OriginalFileName ??
    attachment.fileName ??
    attachment.FileName ??
    "Attachment"
  );
}

function getLastMessageCreatedAt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const lastMessage = [...messages].sort(compareChatMessages).at(-1);
  return lastMessage?.createdAt ?? lastMessage?.CreatedAt ?? null;
}

function compareChatMessages(first, second) {
  const firstTime = new Date(first.createdAt ?? first.CreatedAt ?? 0).getTime();
  const secondTime = new Date(second.createdAt ?? second.CreatedAt ?? 0).getTime();
  if (firstTime !== secondTime) return firstTime - secondTime;
  return Number(first.id ?? first.Id ?? 0) - Number(second.id ?? second.Id ?? 0);
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
  if (status === 403 && url.includes("/messages"))
    return "Chat request failed: you do not have access to this conversation.";
  if (status === 403) return "Chat request failed: this action is not allowed.";
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
