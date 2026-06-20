import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Camera, Check, CheckCheck, Clock, Crown, LogOut, MoreHorizontal, Paperclip, Search, Send, ShieldCheck, Trash2, UserMinus, UserPlus, Users, X } from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal";
import MessageReactions from "../../components/chat/MessageReactions";
import { useChat } from "../../context/ChatContext";
import "./Chat.css";
import { useTranslation } from '../../hooks/useTranslation';

const QUICK_STARTER_MESSAGES = [
  "Hello! What's up?",
  "Hey everyone!",
  "When are you free?",
  "Want to plan something?",
  "Let's start here.",
  "Coffee or study session?",
];

const MAX_GROUP_PHOTO_BYTES = 2 * 1024 * 1024;
const GROUP_PHOTO_SIZE = 512;

async function prepareGroupPhoto(file) {
  if (!file.type?.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Please choose a JPG, PNG, or WebP image.");
  }

  if (file.size > MAX_GROUP_PHOTO_BYTES) {
    throw new Error("Group photo must be smaller than 2 MB.");
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Group photo could not be read."));
      img.src = sourceUrl;
    });

    const scale = Math.min(1, GROUP_PHOTO_SIZE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Group photo could not be prepared.");
    }
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function Chat() {
  const { t } = useTranslation();
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
  const [confirmError, setConfirmError] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberQuery, setGroupMemberQuery] = useState("");
  const [groupPeopleResults, setGroupPeopleResults] = useState([]);
  const [searchingGroupPeople, setSearchingGroupPeople] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [groupError, setGroupError] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [groupSettings, setGroupSettings] = useState(null);
  const [loadingGroupSettings, setLoadingGroupSettings] = useState(false);
  const [groupSettingsError, setGroupSettingsError] = useState("");
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [savingGroupPhoto, setSavingGroupPhoto] = useState(false);
  const [updatingMute, setUpdatingMute] = useState(false);
  const groupPhotoInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const startedFromUrlRef = useRef("");
  const messagesViewportRef = useRef(null);
  const messagesEndRef = useRef(null);
  const composerInputRef = useRef(null);
  const previousConversationIdRef = useRef(null);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    if (confirmDialog) {
      setConfirmError("");
    }
  }, [confirmDialog]);

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

  useEffect(() => {
    if (!groupModalOpen) return undefined;

    const query = groupMemberQuery.trim();

    if (query.length < 2) {
      setGroupPeopleResults([]);
      setSearchingGroupPeople(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchingGroupPeople(true);

      try {
        const result = await apiFetch(`/api/Search?query=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });

        setGroupPeopleResults(result?.people || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setGroupPeopleResults([]);
          setGroupError(err.message || "People search failed.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchingGroupPeople(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [apiFetch, groupMemberQuery, groupModalOpen]);

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        const query = filter.trim().toLowerCase();
        if (!query) return true;

        return (
          getConversationDisplayName(conversation).toLowerCase().includes(query) ||
          conversation.otherUsername?.toLowerCase().includes(query)
        );
      }),
    [conversations, filter],
  );

  const conversationUserIds = useMemo(
    () => new Set(conversations.filter((conversation) => !conversation.isGroup).map((conversation) => Number(conversation.otherUserId))),
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

  const filteredGroupPeopleResults = useMemo(() => {
    const selectedIds = new Set(selectedGroupMembers.map((person) => Number(person.id)));

    return groupPeopleResults.filter(
      (person) =>
        Number(person.id) !== Number(auth.userId) &&
        (!person.role || person.role.toLowerCase() === "user") &&
        !selectedIds.has(Number(person.id)),
    );
  }, [auth.userId, groupPeopleResults, selectedGroupMembers]);

  const activeConversation =
    conversations.find((conversation) => conversation.conversationId === activeConversationId) ||
    filteredConversations[0] ||
    conversations[0] ||
    null;
  const messages = messagesByConversation[activeConversation?.conversationId] || [];

  useEffect(() => {
    setShowGroupSettings(false);
    setGroupSettings(null);
    setGroupSettingsError("");
    setEditingGroupName(false);
    setSavingGroupPhoto(false);
  }, [activeConversation?.conversationId]);

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
    setConfirmError("");

    try {
      if (confirmDialog.action === "removeMember") {
        await apiFetch(
          `/api/Chat/groups/${confirmDialog.conversationId}/members/${confirmDialog.member.userId}`,
          { method: "DELETE" },
        );
        await loadGroupSettings(confirmDialog.conversationId);
        await loadConversations({ silent: true });
      } else if (confirmDialog.action === "leaveGroup") {
        await apiFetch(`/api/Chat/groups/${confirmDialog.conversationId}/leave`, {
          method: "POST",
        });
        setShowGroupSettings(false);
        setGroupSettings(null);
        await loadConversations({ silent: true });
      } else if (confirmDialog.action === "deleteGroup") {
        await apiFetch(`/api/Chat/conversations/${confirmDialog.conversationId}?permanent=true`, {
          method: "DELETE",
          skipBackendCooldown: true,
        });
        setConfirmDialog(null);
        setShowGroupSettings(false);
        setGroupSettings(null);
        setActiveConversationId(null);
        await loadConversations({ silent: true });
      } else if (confirmDialog.action === "forEveryone") {
        await deleteMessageForEveryone(confirmDialog.message);
      } else {
        await deleteMessageForMe(confirmDialog.message);
      }
      setConfirmDialog(null);
    } catch (err) {
      const fallbackMessage =
        confirmDialog.action === "deleteGroup"
          ? "Group could not be deleted. Restart the API server and try again."
          : "Action could not be completed.";
      const message = err.message || fallbackMessage;
      setConfirmError(message);
      setGroupSettingsError(message);
      setError(message);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleReactToMessage = async (message, emoji) => {
    setError("");

    try {
      await toggleReaction(message, emoji);
    } catch (err) {
      setError(err.message || "Reaction could not be saved.");
    }
  };

  const handleCancelConfirm = () => {
    if (confirmLoading) return;
    setConfirmDialog(null);
    setConfirmError("");
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

  const resetGroupModal = () => {
    setGroupName("");
    setGroupMemberQuery("");
    setGroupPeopleResults([]);
    setSelectedGroupMembers([]);
    setGroupError("");
    setCreatingGroup(false);
  };

  const handleOpenGroupModal = () => {
    resetGroupModal();
    setGroupModalOpen(true);
  };

  const handleCloseGroupModal = () => {
    if (creatingGroup) return;
    setGroupModalOpen(false);
    resetGroupModal();
  };

  const handleAddGroupMember = (person) => {
    setSelectedGroupMembers((current) => [...current, person]);
    setGroupMemberQuery("");
    setGroupPeopleResults([]);
    setGroupError("");
  };

  const handleRemoveSelectedGroupMember = (personId) => {
    setSelectedGroupMembers((current) => current.filter((person) => Number(person.id) !== Number(personId)));
  };

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    if (creatingGroup || !canSendMessages) return;

    const name = groupName.trim();
    if (!name || selectedGroupMembers.length < 2) return;

    setCreatingGroup(true);
    setGroupError("");
    setError("");

    try {
      const created = await createGroupConversation({
        groupName: name,
        memberUserIds: selectedGroupMembers.map((person) => Number(person.id)),
      });
      if (created?.conversationId) {
        setActiveConversationId(created.conversationId);
        await loadMessages(created.conversationId);
      }
      setGroupModalOpen(false);
      resetGroupModal();
    } catch (err) {
      setGroupError(err.message || "Group chat could not be created.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const loadGroupSettings = useCallback(
    async (conversationId = activeConversation?.conversationId) => {
      if (!conversationId) return null;

      const requestUrl = `/api/Chat/groups/${conversationId}/settings`;
      setLoadingGroupSettings(true);
      setGroupSettingsError("");

      try {
        console.debug("[Group settings] request", {
          url: requestUrl,
          activeConversationId: activeConversation?.conversationId,
          activeConversationIsGroup: activeConversation?.isGroup,
        });

        const token = localStorage.getItem("token");
        const response = await fetch(requestUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const responseBody = await response.text();
          console.debug("[Group settings] request failed", {
            url: requestUrl,
            status: response.status,
            responseBody,
            activeConversationId: activeConversation?.conversationId,
            activeConversationIsGroup: activeConversation?.isGroup,
          });
          throw new Error(getGroupSettingsErrorMessage(response.status, responseBody));
        }

        const settings = await response.json();
        setGroupSettings(settings);
        setGroupNameDraft(settings.groupName || "");
        return settings;
      } catch (err) {
        setGroupSettingsError(err.message || "Group settings could not be loaded.");
        return null;
      } finally {
        setLoadingGroupSettings(false);
      }
    },
    [activeConversation?.conversationId, activeConversation?.isGroup],
  );

  const handleOpenChatSettings = async () => {
    if (!isGroupConversation(activeConversation)) {
      setError("Settings are available for group chats.");
      return;
    }

    setError("");
    setShowGroupSettings(true);
    await loadGroupSettings(activeConversation.conversationId);
  };

  const handleSaveGroupName = async (event) => {
    event.preventDefault();
    if (!activeConversation?.isGroup || savingGroupName) return;

    const nextName = groupNameDraft.trim();
    if (!nextName) return;

    setSavingGroupName(true);
    setGroupSettingsError("");

    try {
      const settings = await apiFetch(`/api/Chat/groups/${activeConversation.conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ groupName: nextName }),
      });
      setGroupSettings(settings);
      setGroupNameDraft(settings.groupName || "");
      setEditingGroupName(false);
      await loadConversations({ silent: true });
    } catch (err) {
      setGroupSettingsError(err.message || "Group name could not be saved.");
    } finally {
      setSavingGroupName(false);
    }
  };

  const handleChooseGroupPhoto = () => {
    if (!groupSettings?.isCurrentUserAdmin || savingGroupPhoto) return;
    groupPhotoInputRef.current?.click();
  };

  const handleGroupPhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !activeConversation?.isGroup || savingGroupPhoto) return;

    setSavingGroupPhoto(true);
    setGroupSettingsError("");

    try {
      const groupPhoto = await prepareGroupPhoto(file);
      const settings = await apiFetch(`/api/Chat/groups/${activeConversation.conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({
          groupName: groupSettings?.groupName || activeConversation.groupName || "Group chat",
          groupPhoto,
        }),
      });
      setGroupSettings(settings);
      setGroupNameDraft(settings.groupName || "");
      await loadConversations({ silent: true });
    } catch (err) {
      setGroupSettingsError(err.message || "Group photo could not be saved.");
    } finally {
      setSavingGroupPhoto(false);
    }
  };

  const handleToggleMute = async () => {
    if (!activeConversation?.isGroup || !groupSettings || updatingMute) return;

    setUpdatingMute(true);
    setGroupSettingsError("");

    try {
      const settings = await apiFetch(`/api/Chat/groups/${activeConversation.conversationId}/mute`, {
        method: "PATCH",
        body: JSON.stringify({ isMuted: !groupSettings.isMuted }),
      });
      setGroupSettings(settings);
    } catch (err) {
      setGroupSettingsError(err.message || "Mute preference could not be saved.");
    } finally {
      setUpdatingMute(false);
    }
  };

  const handleRemoveGroupMember = (member) => {
    setConfirmDialog({
      action: "removeMember",
      conversationId: activeConversation.conversationId,
      member,
      title: "Remove member?",
      body: `${member.displayName || member.username} will lose access to this group.`,
      confirmText: "Remove",
    });
  };

  const handleLeaveGroup = () => {
    setConfirmDialog({
      action: "leaveGroup",
      conversationId: activeConversation.conversationId,
      title: "Leave group?",
      body: "You will stop seeing this group and will not be able to read new messages.",
      confirmText: "Leave group",
    });
  };

  const handleDeleteGroup = () => {
    setConfirmDialog({
      action: "deleteGroup",
      conversationId: activeConversation.conversationId,
      title: "Permanently delete group?",
      body: "This will delete the group chat and its messages for everyone. This action cannot be undone.",
      confirmText: "Delete group",
    });
  };

  const handleStarterClick = (message) => {
    setEditingMessage(null);
    setDraft(message);
    window.requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
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
              <p>{t('chat.messages')}</p>
              <h1>{t('chat.title')}</h1>
            </div>
            <span>{conversations.length}</span>
          </div>

          <label className="chat-search">
            <Search size={16} aria-hidden="true" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={`${t('chat.search')}...`}
            />
          </label>

          {canSendMessages && (
            <button type="button" className="chat-new-group" onClick={handleOpenGroupModal}>
              <Users size={16} aria-hidden="true" />
              <span>+ {t('chat.newGroup')}</span>
            </button>
          )}

          <div className="chat-list">
            {loadingConversations && conversations.length === 0 && (
              <div className="chat-state">{t('chat.loadingConversations')}</div>
            )}
            {!loadingConversations && error && conversations.length === 0 && (
              <div className="chat-state chat-state--error">
                <span>{error}</span>
                <button type="button" onClick={() => loadConversations({ retryNow: true })}>
                  {t('common.retry')}
                </button>
              </div>
            )}
            {!loadingConversations && !error && filteredConversations.length === 0 && (
              <div className="chat-state">
                {conversations.length === 0 ? t('chatUi.noneShown') : t('chatUi.noMatching')}
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
                    {isGroupConversation(conversation) && conversation.groupPhoto ? (
                      <img src={conversation.groupPhoto} alt="" />
                    ) : isGroupConversation(conversation) ? (
                      <Users size={18} aria-hidden="true" />
                    ) : conversation.otherAvatar ? (
                      <img src={conversation.otherAvatar} alt="" />
                    ) : (
                      conversation.otherInitials || getInitials(conversation.otherUsername)
                    )}
                  </span>
                  <span className="chat-list__copy">
                    <strong>{getConversationDisplayName(conversation)}</strong>
                    <small>{conversation.lastMessagePreview || t('chat.noMessages')}</small>
                  </span>
                  {conversation.unreadCount > 0 && <b>{conversation.unreadCount}</b>}
                </div>
                <button
                  type="button"
                  className="chat-list__dismiss"
                  title={t('chatUi.hide')}
                  aria-label={t('chatUi.hide')}
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
                <span>{t('chat.people')}</span>
              </div>
            )}
            {searchingPeople && <div className="chat-state">{t('chat.searchingPeople')}</div>}
            {!searchingPeople &&
              filter.trim().length >= 2 &&
              filteredPeopleResults.length === 0 && (
                <div className="chat-state">{t('chat.noNewPeople')}</div>
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
                        t('chatUi.startNew')}
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
                  {isGroupConversation(activeConversation) && activeConversation.groupPhoto ? (
                    <img src={activeConversation.groupPhoto} alt="" />
                  ) : isGroupConversation(activeConversation) ? (
                    <Users size={22} aria-hidden="true" />
                  ) : activeConversation.otherAvatar ? (
                    <img src={activeConversation.otherAvatar} alt="" />
                  ) : (
                    activeConversation.otherInitials ||
                    getInitials(activeConversation.otherUsername)
                  )}
                </div>
                <div>
                  <h2>{getConversationDisplayName(activeConversation)}</h2>
                  <p>
                    {isGroupConversation(activeConversation) && activeConversation.memberCount
                      ? `${activeConversation.memberCount} members`
                      : formatDateTime(activeConversation.lastMessageAt) || t('chatUi.newConversation')}
                  </p>
                </div>
                <button type="button" className="chat-icon-btn" aria-label={t('chatUi.openSettings')} onClick={handleOpenChatSettings}>
                  <MoreHorizontal size={20} />
                </button>
              </header>

              {error && <div className="chat-error">{error}</div>}

              {showGroupSettings && isGroupConversation(activeConversation) ? (
                <GroupSettingsView
                  settings={groupSettings}
                  loading={loadingGroupSettings}
                  error={groupSettingsError}
                  nameDraft={groupNameDraft}
                  editingName={editingGroupName}
                  savingName={savingGroupName}
                  savingPhoto={savingGroupPhoto}
                  updatingMute={updatingMute}
                  currentUserId={auth.userId}
                  photoInputRef={groupPhotoInputRef}
                  onBack={() => setShowGroupSettings(false)}
                  onReload={() => loadGroupSettings(activeConversation.conversationId)}
                  onEditName={() => setEditingGroupName(true)}
                  onCancelEditName={() => {
                    setEditingGroupName(false);
                    setGroupNameDraft(groupSettings?.groupName || "");
                  }}
                  onNameDraftChange={setGroupNameDraft}
                  onSaveName={handleSaveGroupName}
                  onChoosePhoto={handleChooseGroupPhoto}
                  onPhotoChange={handleGroupPhotoChange}
                  onToggleMute={handleToggleMute}
                  onRemoveMember={handleRemoveGroupMember}
                  onLeaveGroup={handleLeaveGroup}
                  onDeleteGroup={handleDeleteGroup}
                />
              ) : (
              <>
              <div className="chat-messages" ref={messagesViewportRef} onScroll={handleMessagesScroll}>
                {loadingMessages && messages.length === 0 && (
                  <div className="chat-state">{t('chat.loadingMessages')}</div>
                )}
                {!loadingMessages && messages.length === 0 && (
                  <div className="chat-message chat-message--system">
                    <span className="chat-safety chat-safety--empty">
                      <ShieldCheck size={16} />
                      <span>
                        {t('chatUi.privacy')}
                      </span>
                    </span>
                    <p>{t('chat.startConversation')}</p>
                    {canSendMessages && (
                      <div className="chat-starters" aria-label="Quick message suggestions">
                        {QUICK_STARTER_MESSAGES.map((message) => (
                          <button
                            key={message}
                            type="button"
                            onClick={() => handleStarterClick(message)}
                          >
                            {message}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!loadingMessages &&
                  messages.map((message) => {
                    const mine = isMessageMine(message, auth.userId);

                    return (
                      <div
                        key={message.id}
                        className={`chat-message chat-message--${mine ? "me" : "them"}${
                          message.isDeletedForEveryone ? " chat-message--deleted" : ""
                        }`}
                        onContextMenu={(event) => openMessageMenu(event, message)}
                      >
                        {isGroupConversation(activeConversation) && !mine && !message.isDeletedForEveryone && (
                          <span className="chat-message__sender">
                            {message.senderDisplayName || message.senderUsername || t('chatUi.member')}
                          </span>
                        )}
                        <p>{message.isDeletedForEveryone ? t('chatUi.deleted') : message.displayBody ?? message.body}</p>
                        <div className="chat-message__meta">
                          <span>{formatTime(message.createdAt)}</span>
                          {message.editedAt && !message.isDeletedForEveryone && <span title={formatDateTime(message.editedAt)}>{t('chat.edited')}</span>}
                          {mine && (
                            <MessageStatusIcon message={message} />
                          )}
                        </div>
                        <MessageReactions
                          message={message}
                          currentUserId={auth.userId}
                          align={mine ? "end" : "start"}
                          onReact={handleReactToMessage}
                        />
                      </div>
                    );
                  })}
                {!loadingMessages && otherUserTyping && (
                  <TypingIndicator className="chat-message chat-message--them" />
                )}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>

              {canSendMessages ? (
                <form className="chat-composer" onSubmit={handleSend}>
                  {editingMessage && (
                    <div className="chat-composer__editing">
                      <span>{t('chat.editing')}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessage(null);
                          setDraft("");
                        }}
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  )}
                  <button type="button" aria-label="Attach file" disabled>
                    <Paperclip size={18} />
                  </button>
                  <input
                    ref={composerInputRef}
                    value={draft}
                    onChange={handleDraftChange}
                    placeholder={`Message ${
                      getConversationDisplayName(activeConversation)
                    }...`}
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    className="chat-composer__send"
                    aria-label={editingMessage ? t('chatUi.saveMessage') : t('chatUi.sendMessage')}
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
              )}
            </>
          ) : (
            <div className="chat-empty-panel">
              <ShieldCheck size={24} />
              <h2>{t('chat.noSelected')}</h2>
              <p>{t('chat.openProfile')}</p>
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
        errorMessage={confirmError}
        confirmText={confirmDialog?.confirmText}
        cancelText={t('common.cancel')}
        variant="danger"
        isLoading={confirmLoading}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelConfirm}
      />
      {groupModalOpen && (
        <CreateGroupModal
          groupName={groupName}
          memberQuery={groupMemberQuery}
          selectedMembers={selectedGroupMembers}
          results={filteredGroupPeopleResults}
          searching={searchingGroupPeople}
          error={groupError}
          creating={creatingGroup}
          onGroupNameChange={setGroupName}
          onMemberQueryChange={setGroupMemberQuery}
          onAddMember={handleAddGroupMember}
          onRemoveMember={handleRemoveSelectedGroupMember}
          onSubmit={handleCreateGroup}
          onClose={handleCloseGroupModal}
        />
      )}
    </main>
  );
}

function GroupSettingsView({
  settings,
  loading,
  error,
  nameDraft,
  editingName,
  savingName,
  savingPhoto,
  updatingMute,
  currentUserId,
  photoInputRef,
  onBack,
  onReload,
  onEditName,
  onCancelEditName,
  onNameDraftChange,
  onSaveName,
  onChoosePhoto,
  onPhotoChange,
  onToggleMute,
  onRemoveMember,
  onLeaveGroup,
  onDeleteGroup,
}) {
  const isAdmin = Boolean(settings?.isCurrentUserAdmin);
  const { t } = useTranslation();

  return (
    <div className="chat-settings">
      <div className="chat-settings__top">
        <button type="button" className="chat-settings__back" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" />
          <span>{t('chat.backToChat')}</span>
        </button>
        <div>
          <p>{t('chat.groupSettings')}</p>
          <h3>{settings?.groupName || t('chat.groupChat')}</h3>
        </div>
      </div>

      {loading && !settings && <div className="chat-state">{t('chat.loadingSettings')}</div>}
      {error && (
        <div className="chat-state chat-state--error">
          <span>{error}</span>
          <button type="button" onClick={onReload}>{t('common.retry')}</button>
        </div>
      )}

      {settings && (
        <>
          <section className="chat-settings__hero">
            <div className="chat-settings__photo">
              {settings.groupPhoto ? (
                <img src={settings.groupPhoto} alt="" />
              ) : (
                <Users size={34} aria-hidden="true" />
              )}
            </div>
            <div>
              <h2>{settings.groupName}</h2>
              <p>
                {settings.memberCount} members
                {settings.createdByUsername ? ` · Created by ${settings.createdByUsername}` : ""}
              </p>
              <span>{settings.currentUserRole}</span>
            </div>
          </section>

          <section className="chat-settings__section">
            <div className="chat-settings__section-head">
              <div>
                <h4>{t('chat.groupPhoto')}</h4>
                <p>{isAdmin ? t('chatUi.adminsPhoto') : t('chatUi.onlyAdminsPhoto')}</p>
              </div>
              <input
                ref={photoInputRef}
                className="chat-settings__file-input"
                type="file"
                accept="image/*"
                onChange={onPhotoChange}
              />
              <button
                type="button"
                className="chat-settings__soft-action"
                onClick={onChoosePhoto}
                disabled={!isAdmin || savingPhoto}
              >
                <Camera size={16} aria-hidden="true" />
                <span>{savingPhoto ? "Saving..." : settings.groupPhoto ? "Change photo" : "Add photo"}</span>
              </button>
            </div>
          </section>

          <section className="chat-settings__section">
            <div className="chat-settings__section-head">
              <div>
                <h4>{t('chat.groupName')}</h4>
                <p>{isAdmin ? t('chatUi.adminsRename') : t('chatUi.onlyAdminsRename')}</p>
              </div>
              {!editingName && isAdmin && (
                <button type="button" className="chat-settings__soft-action" onClick={onEditName}>
                  Rename
                </button>
              )}
            </div>
            {editingName ? (
              <form className="chat-settings__rename" onSubmit={onSaveName}>
                <input
                  value={nameDraft}
                  onChange={(event) => onNameDraftChange(event.target.value)}
                  maxLength={120}
                />
                <button type="button" onClick={onCancelEditName} disabled={savingName}>{t('common.cancel')}</button>
                <button type="submit" disabled={savingName || !nameDraft.trim()}>
                  {savingName ? t('common.loading') : t('common.save')}
                </button>
              </form>
            ) : (
              <strong className="chat-settings__readonly">{settings.groupName}</strong>
            )}
          </section>

          <section className="chat-settings__section chat-settings__toggle-row">
            <div>
              <h4>{t('chat.muteGroup')}</h4>
              <p>{t('chat.muteNote')}</p>
            </div>
            <button
              type="button"
              className={`chat-settings__toggle${settings.isMuted ? " chat-settings__toggle--on" : ""}`}
              onClick={onToggleMute}
              disabled={updatingMute}
              aria-pressed={settings.isMuted}
            >
              {settings.isMuted ? <BellOff size={16} /> : <Bell size={16} />}
              <span>{settings.isMuted ? t('chatUi.muted') : t('chatUi.mute')}</span>
            </button>
          </section>

          <section className="chat-settings__section">
            <div className="chat-settings__section-head">
              <div>
                <h4>{t('chat.members')}</h4>
                <p>{settings.memberCount} people in this group</p>
              </div>
            </div>
            <div className="chat-settings__members">
              {settings.members.map((member) => (
                <div key={member.userId} className="chat-settings__member">
                  <span className="chat-avatar">
                    {member.avatar ? <img src={member.avatar} alt="" /> : member.initials || getInitials(member.username)}
                  </span>
                  <span>
                    <strong>
                      {member.displayName || member.username}
                      {Number(member.userId) === Number(currentUserId) ? " (You)" : ""}
                    </strong>
                    <small>
                      {member.isAdmin && <Crown size={12} aria-hidden="true" />}
                      {member.role}
                    </small>
                  </span>
                  {isAdmin && !member.isCurrentUser && (
                    <button type="button" className="chat-settings__danger-action" onClick={() => onRemoveMember(member)}>
                      <UserMinus size={15} aria-hidden="true" />
                      <span>{t('chat.remove')}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="chat-settings__section">
            <div className="chat-settings__section-head">
              <div>
                <h4>{t('chat.adminControls')}</h4>
                <p>
                  {isAdmin
                    ? t('chatUi.adminsManage')
                    : t('chatUi.adminHidden')}
                </p>
              </div>
            </div>
          </section>

          <section className="chat-settings__section chat-settings__leave">
            <button type="button" onClick={onLeaveGroup}>
              <LogOut size={16} aria-hidden="true" />
              <span>{t('chat.leave')}</span>
            </button>
          </section>

          {isAdmin && (
            <section className="chat-settings__section chat-settings__delete">
              <div>
                <h4>{t('chat.permanentlyDelete')}</h4>
                <p>{t('chat.deleteGroupNote')}</p>
              </div>
              <button type="button" onClick={onDeleteGroup}>
                <Trash2 size={16} aria-hidden="true" />
                <span>{t('chat.permanentlyDelete')}</span>
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CreateGroupModal({
  groupName,
  memberQuery,
  selectedMembers,
  results,
  searching,
  error,
  creating,
  onGroupNameChange,
  onMemberQueryChange,
  onAddMember,
  onRemoveMember,
  onSubmit,
  onClose,
}) {
  const { t } = useTranslation();
  const selectedMembersLength = Array.isArray(selectedMembers) ? selectedMembers.length : 0;
  const canCreateGroup =
    groupName.trim().length > 0 &&
    selectedMembersLength >= 2 &&
    !creating;

  return createPortal(
    <div className="chat-group-modal create-group-modal" role="dialog" aria-modal="true" aria-labelledby="chat-group-title">
      <form className="chat-group-modal__panel" onSubmit={onSubmit}>
        <div className="chat-group-modal__head">
          <div>
            <p>{t('chat.groupChat')}</p>
            <h2 id="chat-group-title">{t('chat.createGroup')}</h2>
          </div>
          <button type="button" aria-label={t('chatUi.close')} onClick={onClose} disabled={creating}>
            <X size={18} />
          </button>
        </div>

        <label className="chat-group-field">
          <span>{t('chat.groupName')}</span>
          <input
            value={groupName}
            onChange={(event) => onGroupNameChange(event.target.value)}
            placeholder={t('chatUi.groupStudy')}
            maxLength={120}
            autoFocus
          />
        </label>

        <label className="chat-group-field">
          <span>{t('chat.addMembers')}</span>
          <input
            value={memberQuery}
            onChange={(event) => onMemberQueryChange(event.target.value)}
            placeholder={t('chatUi.searchPeople')}
          />
        </label>

        {selectedMembers.length > 0 && (
          <div className="chat-group-chips">
            {selectedMembers.map((person) => (
              <span key={person.id}>
                {person.displayName || person.username}
                <button type="button" onClick={() => onRemoveMember(person.id)} aria-label={t('chatUi.removeMember')}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="chat-group-results">
          {searching && <div className="chat-state">{t('chat.searchingPeople')}</div>}
          {!searching && memberQuery.trim().length >= 2 && results.length === 0 && (
            <div className="chat-state">{t('chat.noPeople')}</div>
          )}
          {!searching &&
            results.map((person) => (
              <button key={person.id} type="button" onClick={() => onAddMember(person)}>
                <span className="chat-avatar">{getInitials(person.displayName || person.username)}</span>
                <span>
                  <strong>{person.displayName || person.username}</strong>
                  <small>{person.locationDisplayName || "Add to group"}</small>
                </span>
                <UserPlus size={16} aria-hidden="true" />
              </button>
            ))}
        </div>

        {error && <div className="chat-error">{error}</div>}
        <div className="chat-group-modal__actions">
          <button type="button" className="chat-group-modal__cancel" onClick={onClose} disabled={creating}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={`chat-group-modal__submit create-group-submit ${canCreateGroup ? "is-ready" : "is-disabled"}`}
            disabled={!canCreateGroup}
            data-can-create={canCreateGroup ? "true" : "false"}
            onClick={onSubmit}
          >
            {creating ? t('common.loading') : t('chat.createGroup')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function MessageContextMenu({ menu, currentUserId, onEdit, onDeleteForMe, onDeleteForEveryone }) {
  const isMine = isMessageMine(menu.message, currentUserId);
  const { t } = useTranslation();

  return createPortal(
    <div
      className="chat-message-menu"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
    >
      {isMine && !menu.message.isDeletedForEveryone && (
        <button type="button" onClick={() => onEdit(menu.message)}>
          {t('chat.editMessage')}
        </button>
      )}
      <button type="button" onClick={() => onDeleteForMe(menu.message)}>
        {t('chat.deleteSelf')}
      </button>
      {isMine && !menu.message.isDeletedForEveryone && (
        <button type="button" className="chat-message-menu__danger" onClick={() => onDeleteForEveryone(menu.message)}>
          {t('chat.deleteEveryone')}
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

function getConversationDisplayName(conversation) {
  if (!conversation) return "Chat";
  return conversation.displayName || conversation.groupName || conversation.otherDisplayName || conversation.otherUsername || "Chat";
}

function isGroupConversation(conversation) {
  return conversation?.isGroup === true || conversation?.isGroup === "true";
}

function getGroupSettingsErrorMessage(status, responseBody) {
  if (status === 404) {
    return "Group settings endpoint was not found. Please check backend route and restart the API server.";
  }

  if (status === 403) {
    return responseBody || "You are no longer a member of this group.";
  }

  if (status === 400) {
    return responseBody || "Settings are available for group chats.";
  }

  return responseBody || "Group settings could not be loaded.";
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
