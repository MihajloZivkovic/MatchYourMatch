import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Check,
  CheckCheck,
  Clock,
  MessageCircle,
  Minus,
  Users,
  X,
} from 'lucide-react';
import ConfirmModal from '../ConfirmModal';
import MessageReactions from './MessageReactions';
import ChatComposer from './ChatComposer';
import AttachmentView from './AttachmentView';
import { useChat } from '../../context/ChatContext';
import './FloatingChat.css';
import { useTranslation } from '../../hooks/useTranslation';

function FloatingChat() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [draft, setDraft] = useState('');
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [messageMenu, setMessageMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [sending, setSending] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messagesViewportRef = useRef(null);
  const messagesEndRef = useRef(null);
  const previousConversationIdRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const {
    auth,
    canSendMessages,
    conversations,
    messagesByConversation,
    messageLoadStateByConversation,
    activeConversationId: activeId,
    loadingConversations,
    error,
    setError,
    setActiveConversationId,
    loadConversations,
    loadMessages,
    sendMessage,
    sendAttachment,
    sendGif,
    editMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    toggleReaction,
    setTyping,
    getTypingState,
  } = useChat();

  useEffect(() => {
    if (!open || !activeId) return;
    loadMessages(activeId);
    const intervalId = window.setInterval(
      () => loadMessages(activeId, { silent: true }).catch(() => {}),
      2500,
    );
    return () => window.clearInterval(intervalId);
  }, [activeId, loadMessages, open]);

  useEffect(() => {
    if (!open || !activeId) return;

    let cancelled = false;

    const pollTyping = async () => {
      try {
        const result = await getTypingState(activeId);
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
  }, [activeId, getTypingState, open]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const activeConversation =
    conversations.find(
      (conversation) => conversation.conversationId === activeId,
    ) ||
    conversations[0] ||
    null;
  const messages =
    messagesByConversation[activeConversation?.conversationId] || [];
  const messageLoadState = activeConversation
    ? messageLoadStateByConversation[activeConversation.conversationId] || {
        status: 'idle',
        error: '',
      }
    : { status: 'idle', error: '' };

  const scrollMessagesToBottom = useCallback((behavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  useEffect(() => {
    if (!open || minimized) return;

    const conversationId = activeConversation?.conversationId || null;
    const conversationChanged =
      previousConversationIdRef.current !== conversationId;
    const lastMessage = messages[messages.length - 1];
    const lastMessageIsMine = isMessageMine(lastMessage, auth.userId);

    if (conversationChanged || lastMessageIsMine || isNearBottomRef.current) {
      window.requestAnimationFrame(() =>
        scrollMessagesToBottom(conversationChanged ? 'auto' : 'smooth'),
      );
    }

    previousConversationIdRef.current = conversationId;
  }, [
    activeConversation?.conversationId,
    auth.userId,
    messages,
    minimized,
    open,
    scrollMessagesToBottom,
  ]);

  const handleMessagesScroll = () => {
    const element = messagesViewportRef.current;
    if (!element) return;

    isNearBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 72;
  };

  const unreadTotal = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

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
      if (event.key === 'Escape') {
        setMessageMenu(null);
        setEditingMessage(null);
        setDraft('');
      }
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [messageMenu]);

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
    setDraft(message.displayBody ?? message.body ?? '');
    setMessageMenu(null);
  };

  const handleDeleteForMe = (message) => {
    setMessageMenu(null);
    setConfirmDialog({
      action: 'forMe',
      message,
      title: 'Delete message?',
      body: 'This message will be removed only for you.',
      confirmText: 'Delete',
    });
  };

  const handleDeleteForEveryone = (message) => {
    setMessageMenu(null);
    setConfirmDialog({
      action: 'forEveryone',
      message,
      title: 'Delete message for everyone?',
      body: 'This action will remove the message for all conversation participants.',
      confirmText: 'Delete for everyone',
    });
  };

  const handleReactToMessage = async (message, emoji) => {
    setError('');

    try {
      await toggleReaction(message, emoji);
    } catch (err) {
      setError(err.message || 'Reaction could not be saved.');
    }
  };

  const handleRetry = async () => {
    setError('');
    if (
      activeConversation?.conversationId &&
      messageLoadState.status === 'error'
    ) {
      await loadMessages(activeConversation.conversationId);
      return;
    }
    await loadConversations({ retryNow: true });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDialog || confirmLoading) return;

    setConfirmLoading(true);

    try {
      if (confirmDialog.action === 'forEveryone') {
        await deleteMessageForEveryone(confirmDialog.message);
      } else {
        await deleteMessageForMe(confirmDialog.message);
      }
      setConfirmDialog(null);
    } catch (err) {
      setError(err.message || 'Message could not be deleted.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancelConfirm = () => {
    if (confirmLoading) return;
    setConfirmDialog(null);
  };

  if (!open) {
    return (
      <button
        type='button'
        className='floating-chat__launcher'
        aria-label={t('chatUi.openChat')}
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
    <aside
      className={`floating-chat${minimized ? ' floating-chat--minimized' : ''}`}
    >
      <header className='floating-chat__head'>
        <button
          type='button'
          className='floating-chat__person'
          onClick={() => setMinimized(false)}
        >
          <span className='floating-chat__avatar'>
            {activeConversation?.isGroup ? (
              <Users size={16} aria-hidden='true' />
            ) : activeConversation?.otherAvatar ? (
              <img src={activeConversation.otherAvatar} alt='' />
            ) : (
              activeConversation?.otherInitials || 'MY'
            )}
          </span>
          <span>
            <strong>{getConversationDisplayName(activeConversation)}</strong>
            <small>
              {activeConversation?.isGroup && activeConversation.memberCount
                ? `${activeConversation.memberCount} members`
                : activeConversation
                  ? t('chat.messages')
                  : t('chat.noConversations')}
            </small>
          </span>
        </button>
        <div className='floating-chat__controls'>
          <button
            type='button'
            aria-label='Minimize chat'
            onClick={() => setMinimized((value) => !value)}
          >
            <Minus size={17} />
          </button>
          <button
            type='button'
            aria-label={t('chatUi.closeChat')}
            onClick={() => setOpen(false)}
          >
            <X size={17} />
          </button>
        </div>
      </header>

      {!minimized && (
        <>
          <div className='floating-chat__body'>
            <div className='floating-chat__threads'>
              {conversations.map((conversation) => (
                <button
                  type='button'
                  key={conversation.conversationId}
                  className={`floating-chat__thread${
                    conversation.conversationId ===
                    activeConversation?.conversationId
                      ? ' floating-chat__thread--active'
                      : ''
                  }`}
                  onClick={() =>
                    setActiveConversationId(conversation.conversationId)
                  }
                  aria-label={`Open chat with ${conversation.otherUsername}`}
                >
                  <span className='floating-chat__avatar floating-chat__avatar--small'>
                    {conversation.isGroup ? (
                      <Users size={14} aria-hidden='true' />
                    ) : conversation.otherAvatar ? (
                      <img src={conversation.otherAvatar} alt='' />
                    ) : (
                      conversation.otherInitials ||
                      getInitials(conversation.otherUsername)
                    )}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <b>{conversation.unreadCount}</b>
                  )}
                </button>
              ))}
            </div>

            <div
              className='floating-chat__messages'
              ref={messagesViewportRef}
              onScroll={handleMessagesScroll}
            >
              {messageLoadState.status === 'loading' &&
                messages.length === 0 && (
                  <div className='floating-chat__state'>
                    {t('chat.loadingMessages')}
                  </div>
                )}
              {!loadingConversations && !activeConversation && (
                <div className='floating-chat__state'>
                  {t('chat.noConversations')}
                </div>
              )}
              {messageLoadState.status !== 'loading' &&
                messages.map((message) => {
                  const mine = isMessageMine(message, auth.userId);

                  return (
                    <div
                      key={message.id}
                      className={`floating-chat__message floating-chat__message--${mine ? 'me' : 'them'}${
                        message.isDeletedForEveryone
                          ? ' floating-chat__message--deleted'
                          : ''
                      }`}
                      onContextMenu={(event) => openMessageMenu(event, message)}
                    >
                      {activeConversation?.isGroup &&
                        !mine &&
                        !message.isDeletedForEveryone && (
                          <span className='floating-chat__message-sender'>
                            {message.senderDisplayName ||
                              message.senderUsername ||
                              t('chatUi.member')}
                          </span>
                        )}
                      {!message.isDeletedForEveryone && (
                        <AttachmentView attachment={message.attachment} />
                      )}
                      {(message.isDeletedForEveryone ||
                        message.displayBody ||
                        message.body) && (
                        <p>
                          {message.isDeletedForEveryone
                            ? t('chatUi.deleted')
                            : (message.displayBody ?? message.body)}
                        </p>
                      )}
                      <div className='floating-chat__message-meta'>
                        <span>{formatTime(message.createdAt)}</span>
                        {message.editedAt && !message.isDeletedForEveryone && (
                          <span title={formatTime(message.editedAt)}>
                            {t('chat.edited')}
                          </span>
                        )}
                        {mine && <MessageStatusIcon message={message} />}
                      </div>
                      <MessageReactions
                        message={message}
                        currentUserId={auth.userId}
                        align={mine ? 'end' : 'start'}
                        compact
                        onReact={handleReactToMessage}
                      />
                    </div>
                  );
                })}
              {messageLoadState.status !== 'loading' && otherUserTyping && (
                <TypingIndicator className='floating-chat__message floating-chat__message--them' />
              )}
              {messageLoadState.status === 'success' &&
                messages.length === 0 &&
                activeConversation && (
                  <div className='floating-chat__state'>
                    {t('chat.startConversation')}
                  </div>
                )}
              {messageLoadState.status === 'error' && (
                <div className='floating-chat__error'>
                  <span>{messageLoadState.error}</span>
                  <button type='button' onClick={handleRetry}>
                    {t('common.retry')}
                  </button>
                </div>
              )}
              {error && (
                <div className='floating-chat__error'>
                  <span>{error}</span>
                  <button
                    type='button'
                    onClick={handleRetry}
                    disabled={loadingConversations}
                  >
                    {t('common.retry')}
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} aria-hidden='true' />
            </div>
          </div>

          {canSendMessages && activeConversation ? (
            <ChatComposer
              value={draft}
              onChange={(value) => handleDraftChange({ target: { value } })}
              sending={sending}
              placeholder={t('chat.messagePlaceholder')}
              editing={Boolean(editingMessage)}
              onCancelEdit={() => {
                setEditingMessage(null);
                setDraft('');
              }}
              onSendText={async (text) => {
                setSending(true);
                try {
                  if (editingMessage) {
                    await editMessage(editingMessage, text);
                    setEditingMessage(null);
                  } else
                    await sendMessage(activeConversation.conversationId, text);
                  setDraft('');
                  notifyTyping(false);
                } finally {
                  setSending(false);
                }
              }}
              onSendAttachment={async (file, text, progress) => {
                setSending(true);
                try {
                  await sendAttachment(
                    activeConversation.conversationId,
                    file,
                    text,
                    progress,
                  );
                  setDraft('');
                } finally {
                  setSending(false);
                }
              }}
              onSendGif={async (gif) => {
                setSending(true);
                try {
                  await sendGif(activeConversation.conversationId, gif);
                  setDraft('');
                } finally {
                  setSending(false);
                }
              }}
            />
          ) : (
            <div className='floating-chat__disabled'>
              {canSendMessages
                ? t('chatUi.openProfile')
                : t('chatUi.usersOnly')}
            </div>
          )}

          <Link className='floating-chat__full' to='/app/chat'>
            View all messages
          </Link>
        </>
      )}
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
        cancelText={t('common.cancel')}
        variant='danger'
        isLoading={confirmLoading}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelConfirm}
      />
    </aside>
  );
}

function MessageContextMenu({
  menu,
  currentUserId,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
}) {
  const isMine = isMessageMine(menu.message, currentUserId);
  const { t } = useTranslation();

  return createPortal(
    <div
      className='chat-message-menu'
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
    >
      {isMine && !menu.message.isDeletedForEveryone && (
        <button type='button' onClick={() => onEdit(menu.message)}>
          {t('chat.editMessage')}
        </button>
      )}
      <button type='button' onClick={() => onDeleteForMe(menu.message)}>
        {t('chat.deleteSelf')}
      </button>
      {isMine && !menu.message.isDeletedForEveryone && (
        <button
          type='button'
          className='chat-message-menu__danger'
          onClick={() => onDeleteForEveryone(menu.message)}
        >
          {t('chat.deleteEveryone')}
        </button>
      )}
    </div>,
    document.body,
  );
}

function isMessageMine(message, currentUserId) {
  if (!message) return false;
  if (typeof message.isMine === 'boolean') return message.isMine;
  return Number(message.senderId) === Number(currentUserId);
}

function TypingIndicator({ className }) {
  return (
    <div className={`${className} floating-chat__typing`} aria-label='Typing'>
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
  const Icon =
    status === 'Read'
      ? CheckCheck
      : status === 'Delivered'
        ? CheckCheck
        : status === 'Sent'
          ? Check
          : Clock;

  return (
    <span
      className='floating-chat__message-status'
      title={status}
      aria-label={status}
    >
      <Icon size={12} strokeWidth={2.4} />
    </span>
  );
}

function getMessageStatus(message) {
  if (message.readAt) return 'Read';
  if (message.id) return 'Delivered';
  return 'Sending';
}

function getConversationDisplayName(conversation) {
  if (!conversation) return 'Chat';
  return (
    conversation.displayName ||
    conversation.groupName ||
    conversation.otherDisplayName ||
    conversation.otherUsername ||
    'Chat'
  );
}

function formatTime(value) {
  if (!value) return '';
  return parseServerDate(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseServerDate(value) {
  if (typeof value === 'string' && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
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
      .join('') || 'MY'
  );
}

export default FloatingChat;
