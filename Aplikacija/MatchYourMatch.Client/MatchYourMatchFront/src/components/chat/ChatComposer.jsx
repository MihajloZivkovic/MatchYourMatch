import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText,
  ImageIcon,
  Paperclip,
  RefreshCw,
  Send,
  Smile,
  X,
} from 'lucide-react';
import './ChatMedia.css';

const ACCEPT =
  '.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
const EMOJI = [
  '\uD83D\uDE00',
  '\uD83D\uDE02',
  '\uD83E\uDD70',
  '\uD83D\uDE0D',
  '\uD83D\uDE0A',
  '\uD83D\uDE09',
  '\uD83D\uDE0E',
  '\uD83E\uDD17',
  '\uD83E\uDD14',
  '\uD83D\uDE4C',
  '\uD83D\uDC4F',
  '\uD83D\uDD25',
  '\u2728',
  '\u2764\uFE0F',
  '\uD83D\uDC9B',
  '\uD83D\uDC4D',
  '\uD83C\uDF89',
  '\uD83D\uDCAC',
  '\uD83C\uDF19',
  '\u2615',
];
const GIPHY_ENDPOINT = 'https://api.giphy.com/v1/gifs';
const GIPHY_LIMIT = '20';
const GIPHY_RATING = 'pg';

const formatBytes = (size = 0) =>
  size < 1024
    ? `${size} B`
    : size < 1048576
      ? `${(size / 1024).toFixed(1)} KB`
      : `${(size / 1048576).toFixed(1)} MB`;

function getGifPreviewUrl(gif) {
  return (
    gif?.images?.fixed_width_small?.url ||
    gif?.images?.fixed_width?.url ||
    gif?.images?.downsized_medium?.url ||
    gif?.images?.downsized?.url ||
    gif?.images?.preview_gif?.url ||
    gif?.images?.original?.url ||
    ''
  );
}

function getGifOriginalUrl(gif) {
  return (
    gif?.images?.original?.url ||
    gif?.images?.downsized_original?.url ||
    gif?.url ||
    ''
  );
}

export default function ChatComposer({
  value,
  onChange,
  onSendText,
  onSendAttachment,
  onSendGif,
  placeholder,
  disabled,
  sending,
  inputRef,
  editing,
  onCancelEdit,
}) {
  const fileInput = useRef(null);
  const composerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const gifButtonRef = useRef(null);
  const ownInput = useRef(null);
  const actualInput = inputRef || ownInput;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [activePanel, setActivePanel] = useState(null);
  const [panelX, setPanelX] = useState(190);
  const [gifs, setGifs] = useState([]);
  const [gifQuery, setGifQuery] = useState('');
  const [gifReloadToken, setGifReloadToken] = useState(0);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState('');
  const [composerError, setComposerError] = useState('');
  const [progress, setProgress] = useState(0);
  const giphyApiKey = import.meta.env.VITE_GIPHY_API_KEY;
  const gifConfigError = !giphyApiKey
    ? 'VITE_GIPHY_API_KEY is missing. Add it to .env and restart the Vite dev server.'
    : '';

  const positionPanel = useCallback((button, panel) => {
    const composer = composerRef.current;
    if (!composer || !button) return;
    const composerRect = composer.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const preferredWidth =
      panel === 'emoji' ? (window.innerWidth <= 420 ? 244 : 280) : 360;
    const panelWidth = Math.min(
      preferredWidth,
      window.innerWidth - (panel === 'emoji' ? 20 : 32),
    );
    const center = buttonRect.left + buttonRect.width / 2 - composerRect.left;
    const min = panelWidth / 2 + 8;
    const max = composerRect.width - panelWidth / 2 - 8;
    setPanelX(Math.max(min, Math.min(center, max)));
  }, []);

  const openPanel = (panel) => {
    const button =
      panel === 'emoji' ? emojiButtonRef.current : gifButtonRef.current;
    positionPanel(button, panel);
    setActivePanel((current) => (current === panel ? null : panel));
  };

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  useEffect(() => {
    const close = (event) => {
      if (!composerRef.current?.contains(event.target)) {
        setActivePanel(null);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setActivePanel(null);
      }
    };

    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!activePanel) return undefined;

    const onResize = () => {
      positionPanel(
        activePanel === 'emoji' ? emojiButtonRef.current : gifButtonRef.current,
        activePanel,
      );
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activePanel, positionPanel]);

  useEffect(() => {
    if (activePanel !== 'gif') return undefined;

    if (!giphyApiKey) {
      if (import.meta.env.DEV) {
        console.error(`[GIPHY] ${gifConfigError}`);
      }
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      async () => {
        const query = gifQuery.trim();
        const endpoint = query ? 'search' : 'trending';
        const params = new URLSearchParams({
          api_key: giphyApiKey,
          limit: GIPHY_LIMIT,
          rating: GIPHY_RATING,
          bundle: 'messaging_non_clips',
        });

        if (query) {
          params.set('q', query);
          params.set('lang', 'en');
        }

        setGifLoading(true);
        setGifError('');

        try {
          const response = await fetch(
            `${GIPHY_ENDPOINT}/${endpoint}?${params.toString()}`,
            {
              signal: controller.signal,
            },
          );
          const contentType = response.headers.get('content-type') || '';
          const payload = contentType.includes('application/json')
            ? await response.json()
            : await response.text();

          if (!response.ok) {
            console.error('[GIPHY] request failed', {
              endpoint,
              status: response.status,
              response: payload,
            });
            const apiMessage =
              typeof payload === 'object'
                ? payload?.meta?.msg || payload?.message
                : payload;
            throw new Error(apiMessage || 'GIFs could not be loaded.');
          }

          const nextGifs = Array.isArray(payload?.data) ? payload.data : [];
          setGifs(
            nextGifs.filter(
              (gif) =>
                gif?.id && getGifPreviewUrl(gif) && getGifOriginalUrl(gif),
            ),
          );
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('[GIPHY] request failed', err);
            setGifs([]);
            setGifError(err.message || 'GIFs could not be loaded.');
          }
        } finally {
          if (!controller.signal.aborted) {
            setGifLoading(false);
          }
        }
      },
      gifQuery.trim() ? 350 : 0,
    );

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [activePanel, gifQuery, gifReloadToken, giphyApiKey, gifConfigError]);

  const chooseFile = (selected) => {
    setComposerError('');
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      setComposerError('Maximum file size is 10 MB.');
      return;
    }
    setFile(selected);
    setPreview(
      selected.type.startsWith('image/') ? URL.createObjectURL(selected) : '',
    );
  };

  const clearFile = () => {
    setFile(null);
    setPreview('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const insertEmoji = (emoji) => {
    const input = actualInput.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? start;
    onChange(`${value.slice(0, start)}${emoji}${value.slice(end)}`);
    setActivePanel(null);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setComposerError('');

    try {
      if (file) {
        await onSendAttachment(file, value, setProgress);
        clearFile();
        setProgress(0);
      } else if (value.trim()) {
        await onSendText(value);
      }
    } catch (err) {
      setComposerError(err.message || 'Message could not be sent.');
    }
  };

  const retryGifs = () => {
    setGifError('');
    setGifReloadToken((current) => current + 1);
  };

  const selectGif = async (gif) => {
    setGifError('');

    try {
      await onSendGif({
        provider: 'Giphy',
        gifId: gif.id,
        originalUrl: getGifOriginalUrl(gif),
        previewUrl: getGifPreviewUrl(gif),
        body: value.trim() || null,
      });
      setActivePanel(null);
    } catch (err) {
      setGifError(err.message || 'GIF could not be sent.');
      setActivePanel('gif');
    }
  };

  return (
    <form
      className='chat-composer chat-composer--media'
      onSubmit={submit}
      ref={composerRef}
    >
      {editing && (
        <div className='chat-composer__editing'>
          <span>Editing message</span>
          <button type='button' onClick={onCancelEdit}>
            Cancel
          </button>
        </div>
      )}

      {file && (
        <div className='chat-media__preview'>
          {preview ? (
            <img src={preview} alt='Preview' />
          ) : (
            <FileText size={28} />
          )}
          <span>
            <strong>{file.name}</strong>
            <small>{formatBytes(file.size)}</small>
          </span>
          <button
            type='button'
            onClick={clearFile}
            aria-label='Remove attachment'
            title='Remove attachment'
          >
            <X size={16} />
          </button>
          {sending && <progress max='100' value={progress} />}
        </div>
      )}

      {activePanel && (
        <div
          className={`chat-media__panel chat-media__panel--${activePanel}`}
          style={{ '--chat-panel-x': `${panelX}px` }}
        >
          {activePanel === 'emoji' ? (
            <div className='chat-media__emoji-grid'>
              {EMOJI.map((emoji) => (
                <button
                  type='button'
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  title={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className='chat-media__gif-search'>
                <ImageIcon size={15} aria-hidden='true' />
                <input
                  value={gifQuery}
                  onChange={(event) => setGifQuery(event.target.value)}
                  placeholder='Search GIPHY'
                  autoFocus
                />
              </div>
              {gifLoading && (
                <p className='chat-media__panel-state'>Loading GIFs...</p>
              )}
              {!gifLoading && (gifConfigError || gifError) && (
                <div className='chat-media__panel-error'>
                  <span>{gifConfigError || gifError}</span>
                  {!gifConfigError && (
                    <button type='button' onClick={retryGifs}>
                      <RefreshCw size={14} aria-hidden='true' />
                      Retry
                    </button>
                  )}
                </div>
              )}
              {!gifLoading &&
                !gifConfigError &&
                !gifError &&
                gifs.length === 0 && (
                  <p className='chat-media__panel-state'>No GIFs found.</p>
                )}
              {!gifLoading &&
                !gifConfigError &&
                !gifError &&
                gifs.length > 0 && (
                  <div className='chat-media__gif-grid'>
                    {gifs.map((gif) => (
                      <button
                        type='button'
                        key={gif.id}
                        onClick={() => selectGif(gif)}
                        title={gif.title || 'Send GIF'}
                      >
                        <img
                          src={getGifPreviewUrl(gif)}
                          alt={gif.title || 'GIF'}
                          loading='lazy'
                        />
                      </button>
                    ))}
                  </div>
                )}
              <small className='chat-media__giphy'>Powered by GIPHY</small>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInput}
        hidden
        type='file'
        accept={ACCEPT}
        onChange={(event) => chooseFile(event.target.files?.[0])}
      />

      <div className='chat-composer__row'>
        <button
          type='button'
          onClick={() => fileInput.current?.click()}
          disabled={disabled || sending || editing}
          aria-label='Attach file'
          title='Attach file'
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={actualInput}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={2000}
          disabled={disabled || sending}
        />
        <button
          ref={emojiButtonRef}
          type='button'
          onClick={() => openPanel('emoji')}
          disabled={disabled || sending}
          aria-label='Choose emoji'
          title='Choose emoji'
          aria-expanded={activePanel === 'emoji'}
        >
          <Smile size={18} />
        </button>
        <button
          ref={gifButtonRef}
          type='button'
          className='chat-media__gif-button'
          onClick={() => openPanel('gif')}
          disabled={disabled || sending}
          aria-label='Choose GIF'
          title='Choose GIF'
          aria-expanded={activePanel === 'gif'}
        >
          GIF
        </button>
        <button
          type='submit'
          className='chat-composer__send'
          disabled={disabled || sending || (!file && !value.trim())}
          aria-label='Send message'
          title='Send message'
        >
          <Send size={18} />
        </button>
      </div>

      {composerError && (
        <span className='chat-media__composer-error'>{composerError}</span>
      )}
    </form>
  );
}
