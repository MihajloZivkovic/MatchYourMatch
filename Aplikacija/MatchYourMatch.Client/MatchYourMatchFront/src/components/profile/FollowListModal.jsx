import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UserAvatar from '../UserAvatar';
import { useTranslation } from '../../hooks/useTranslation';
import { announceProfileChanged } from '../../services/notificationService';
import './FollowListModal.css';

const PAGE_SIZE = 20;

export default function FollowListModal({ userId, currentUserId, type = 'followers', onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], page: 1, pageSize: PAGE_SIZE, totalCount: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rowLoadingId, setRowLoadingId] = useState(null);

  const title = type === 'following' ? t('followList.following') : t('followList.followers');
  const emptyText = type === 'following' ? t('followList.noFollowing') : t('followList.noFollowers');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/Follow/${userId}/${type}?page=${page}&pageSize=${PAGE_SIZE}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await response.text() || t('followList.loadError'));
        const body = await response.json();
        setData({
          items: Array.isArray(body.items) ? body.items : [],
          page: body.page || page,
          pageSize: body.pageSize || PAGE_SIZE,
          totalCount: body.totalCount || 0,
          totalPages: body.totalPages || 0,
        });
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || t('followList.loadError'));
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [page, t, type, userId]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const pageLabel = useMemo(() => {
    const totalPages = Math.max(1, data.totalPages || 1);
    return t('followList.pageOf', { page: data.page || page, total: totalPages });
  }, [data.page, data.totalPages, page, t]);

  const toggleFollow = async (person) => {
    if (rowLoadingId || Number(person.userId || person.id) === Number(currentUserId)) return;
    const targetId = person.userId || person.id;
    const wasFollowing = Boolean(person.isFollowing);
    setRowLoadingId(targetId);
    setData((current) => ({
      ...current,
      items: current.items.map((item) => (Number(item.userId || item.id) === Number(targetId)
        ? { ...item, isFollowing: !wasFollowing }
        : item)),
    }));
    try {
      const response = await fetch(`/api/Follow/${targetId}`, {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(await response.text() || t('publicProfile.followError'));
      announceProfileChanged({ source: wasFollowing ? 'unfollow' : 'follow', userId: targetId });
    } catch (err) {
      setData((current) => ({
        ...current,
        items: current.items.map((item) => (Number(item.userId || item.id) === Number(targetId)
          ? { ...item, isFollowing: wasFollowing }
          : item)),
      }));
      setError(err.message || t('publicProfile.followError'));
    } finally {
      setRowLoadingId(null);
    }
  };

  const openProfile = (person) => {
    const targetId = person.userId || person.id;
    onClose();
    navigate(Number(targetId) === Number(currentUserId) ? '/app/profile' : `/app/users/${targetId}`);
  };

  return createPortal(
    <div className="follow-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="follow-modal" role="dialog" aria-modal="true" aria-labelledby="follow-modal-title"
        onMouseDown={(event) => event.stopPropagation()}>
        <header className="follow-modal__head">
          <div>
            <h2 id="follow-modal-title">{title}</h2>
            <span>{data.totalCount} {title.toLowerCase()}</span>
          </div>
          <button type="button" className="follow-modal__close" onClick={onClose} aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </header>

        <div className="follow-modal__body">
          {loading && <p className="follow-modal__state">{t('common.loading')}</p>}
          {!loading && error && <p className="follow-modal__state follow-modal__state--error">{error}</p>}
          {!loading && !error && data.items.length === 0 && <p className="follow-modal__state">{emptyText}</p>}
          {!loading && !error && data.items.map((person) => {
            const targetId = person.userId || person.id;
            const isSelf = Number(targetId) === Number(currentUserId);
            return (
              <article key={targetId} className="follow-modal__row">
                <button type="button" className="follow-modal__person" onClick={() => openProfile(person)}>
                  <UserAvatar className="follow-modal__avatar" profilePicture={person.profilePictureUrl}
                    initials={getInitials(person.displayName || person.username)} alt="" />
                  <span>
                    <strong>{person.displayName || person.username}</strong>
                    <small>@{person.username}</small>
                    {person.location && <em>{person.location}</em>}
                  </span>
                </button>
                {!isSelf && (
                  <button type="button" className={`follow-modal__follow${person.isFollowing ? ' follow-modal__follow--active' : ''}`}
                    disabled={rowLoadingId === targetId} onClick={() => toggleFollow(person)}>
                    {person.isFollowing ? t('publicProfile.following') : t('publicProfile.follow')}
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <footer className="follow-modal__pager">
          <button type="button" disabled={loading || (data.page || page) <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            {t('followList.previous')}
          </button>
          <span>{pageLabel}</span>
          <button type="button" disabled={loading || (data.totalPages || 0) === 0 || (data.page || page) >= data.totalPages}
            onClick={() => setPage((value) => value + 1)}>
            {t('followList.next')}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function getInitials(value) {
  return String(value || 'MY')
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'MY';
}
