import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import ThemeLang from '../../components/ThemeLang';
import { useTranslation } from '../../hooks/useTranslation';
import { logoutAndRedirect } from '../../services/authSession';
import { adminService } from '../../services/adminService';
import '../../app/app-global.css';
import '../../app/app-polish.css';
import './AdminDashboard.css';

const USERS_PAGE_SIZE = 8;
const EVENTS_PAGE_SIZE = 6;

function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activePanel, setActivePanel] = useState('users');
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [notice, setNotice] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userStatus, setUserStatus] = useState('all');
  const [usersPage, setUsersPage] = useState(1);
  const [eventQuery, setEventQuery] = useState('');
  const [eventsPage, setEventsPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmError, setConfirmError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const data = await adminService.users();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setUsers([]);
      setUsersError(error.message || t('admin.errors.usersLoad'));
    } finally {
      setUsersLoading(false);
    }
  }, [t]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError('');
    try {
      const data = await adminService.events();
      setEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      setEvents([]);
      setEventsError(error.message || t('admin.errors.eventsLoad'));
    } finally {
      setEventsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      loadUsers();
      loadEvents();
    }, 0);
    return () => window.clearTimeout(initial);
  }, [loadEvents, loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !query ||
        [user.username, user.email, user.role, String(user.id)]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      const matchesStatus =
        userStatus === 'all' ||
        (userStatus === 'active' && user.isActive) ||
        (userStatus === 'inactive' && !user.isActive);
      return matchesQuery && matchesStatus;
    });
  }, [userQuery, userStatus, users]);

  const filteredEvents = useMemo(() => {
    const query = eventQuery.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) =>
      [
        event.title,
        event.location,
        event.category,
        event.organizerUsername,
        String(event.id),
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [eventQuery, events]);

  const usersPageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const eventsPageCount = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PAGE_SIZE));
  const safeUsersPage = Math.min(usersPage, usersPageCount);
  const safeEventsPage = Math.min(eventsPage, eventsPageCount);

  const pagedUsers = useMemo(
    () => paginate(filteredUsers, safeUsersPage, USERS_PAGE_SIZE),
    [filteredUsers, safeUsersPage],
  );

  const pagedEvents = useMemo(
    () => paginate(filteredEvents, safeEventsPage, EVENTS_PAGE_SIZE),
    [filteredEvents, safeEventsPage],
  );

  const stats = useMemo(() => {
    const activeUsers = users.filter((user) => user.isActive).length;
    const inactiveUsers = users.length - activeUsers;
    return [
      { label: t('admin.stats.totalUsers'), value: users.length, Icon: Users },
      { label: t('admin.stats.activeUsers'), value: activeUsers, Icon: UserCheck },
      { label: t('admin.stats.inactiveUsers'), value: inactiveUsers, Icon: UserX },
      { label: t('admin.stats.eventsVisible'), value: events.length, Icon: CalendarDays },
    ];
  }, [events.length, t, users]);

  const requestUserAction = (type, user) => {
    const copy = {
      activate: {
        title: t('admin.confirm.activateTitle'),
        message: t('admin.confirm.activateMessage', { username: user.username }),
        confirmText: t('admin.actions.activate'),
      },
      deactivate: {
        title: t('admin.confirm.deactivateTitle'),
        message: t('admin.confirm.deactivateMessage', { username: user.username }),
        confirmText: t('admin.actions.deactivate'),
      },
      deleteUser: {
        title: t('admin.confirm.deleteUserTitle'),
        message: t('admin.confirm.deleteUserMessage', { username: user.username }),
        confirmText: t('admin.actions.deleteUser'),
      },
    };
    setConfirmError('');
    setConfirmAction({ type, target: user, ...copy[type] });
  };

  const requestEventDelete = (event) => {
    setConfirmError('');
    setConfirmAction({
      type: 'deleteEvent',
      target: event,
      title: t('admin.confirm.deleteEventTitle'),
      message: t('admin.confirm.deleteEventMessage', { title: event.title }),
      confirmText: t('admin.actions.deleteEvent'),
    });
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    setConfirmError('');
    setNotice('');
    try {
      if (confirmAction.type === 'activate') {
        await adminService.activateUser(confirmAction.target.id);
        await loadUsers();
        setNotice(t('admin.notices.userActivated', { username: confirmAction.target.username }));
      } else if (confirmAction.type === 'deactivate') {
        await adminService.deactivateUser(confirmAction.target.id);
        await loadUsers();
        setNotice(t('admin.notices.userDeactivated', { username: confirmAction.target.username }));
      } else if (confirmAction.type === 'deleteUser') {
        await adminService.deleteUser(confirmAction.target.id);
        await loadUsers();
        setNotice(t('admin.notices.userDeleted', { username: confirmAction.target.username }));
      } else if (confirmAction.type === 'deleteEvent') {
        await adminService.deleteEvent(confirmAction.target.id);
        await loadEvents();
        setNotice(t('admin.notices.eventDeleted', { title: confirmAction.target.title }));
      }
      setConfirmAction(null);
    } catch (error) {
      setConfirmError(error.message || t('admin.errors.actionFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const closeConfirm = () => {
    if (actionLoading) return;
    setConfirmAction(null);
    setConfirmError('');
  };

  return (
    <div className='app-shell admin-shell'>
      <div className='app-shell__bg' aria-hidden='true'>
        <span className='app-shell__grain' />
        <span className='app-shell__glow app-shell__glow--tl' />
        <span className='app-shell__glow app-shell__glow--br' />
      </div>

      <header className='admin-nav'>
        <Link to='/admin/dashboard' className='admin-nav__logo'>
          <span>M</span>
          <strong>Y</strong>
          <span>M</span>
          <em>ADMIN</em>
        </Link>
        <label className='admin-nav__search' aria-label={t('admin.search.label')}>
          <Search size={17} aria-hidden='true' />
          <input
            type='search'
            value={activePanel === 'users' ? userQuery : eventQuery}
            placeholder={
              activePanel === 'users'
                ? t('admin.search.users')
                : t('admin.search.events')
            }
            onChange={(event) => {
              if (activePanel === 'users') {
                setUserQuery(event.target.value);
                setUsersPage(1);
              } else {
                setEventQuery(event.target.value);
                setEventsPage(1);
              }
            }}
          />
        </label>
        <nav className='admin-nav__sections' aria-label={t('admin.nav.sections')}>
          <NavSectionButton
            active={activePanel === 'users'}
            title={t('admin.nav.users')}
            count={filteredUsers.length}
            Icon={Users}
            onClick={() => setActivePanel('users')}
          />
          <NavSectionButton
            active={activePanel === 'events'}
            title={t('admin.nav.events')}
            count={filteredEvents.length}
            Icon={CalendarDays}
            onClick={() => setActivePanel('events')}
          />
        </nav>
        <div className='admin-nav__actions'>
          <ThemeLang variant='app' />
          <button
            type='button'
            className='admin-nav__logout'
            onClick={() => logoutAndRedirect(navigate)}
          >
            <LogOut size={16} aria-hidden='true' />
            {t('nav.logout')}
          </button>
        </div>
      </header>

      <main className='admin-dashboard'>
        <section className='admin-dashboard__hero'>
          <div>
            <span className='admin-dashboard__eyebrow'>
              <ShieldCheck size={16} aria-hidden='true' />
              {t('admin.hero.eyebrow')}
            </span>
            <h1>{t('admin.hero.title')}</h1>
            <p>{t('admin.hero.subtitle')}</p>
          </div>
          <button
            type='button'
            className='admin-dashboard__refresh'
            onClick={() => {
              loadUsers();
              loadEvents();
            }}
          >
            <RefreshCw size={16} aria-hidden='true' />
            {t('profileUi.refresh')}
          </button>
        </section>

        {notice && (
          <div className='admin-dashboard__notice' role='status'>
            {notice}
          </div>
        )}

        <section className='admin-dashboard__stats'>
          {stats.map(({ label, value, Icon }) => (
            <article className='admin-stat' key={label}>
              <Icon size={18} aria-hidden='true' />
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </section>

        {activePanel === 'users' ? (
          <AdminUsersPanel
            users={pagedUsers}
            totalUsers={filteredUsers.length}
            page={safeUsersPage}
            pageCount={usersPageCount}
            loading={usersLoading}
            error={usersError}
            status={userStatus}
            onPageChange={setUsersPage}
            onStatusChange={(nextStatus) => {
              setUserStatus(nextStatus);
              setUsersPage(1);
            }}
            onRetry={loadUsers}
            onAction={requestUserAction}
            t={t}
          />
        ) : (
          <AdminEventsPanel
            events={pagedEvents}
            totalEvents={filteredEvents.length}
            page={safeEventsPage}
            pageCount={eventsPageCount}
            loading={eventsLoading}
            error={eventsError}
            onPageChange={setEventsPage}
            onRetry={loadEvents}
            onDelete={requestEventDelete}
            t={t}
          />
        )}
      </main>

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        confirmText={confirmAction?.confirmText || t('common.confirm')}
        cancelText={t('common.cancel')}
        variant={
          confirmAction?.type === 'deleteUser' ||
          confirmAction?.type === 'deleteEvent'
            ? 'danger'
            : 'default'
        }
        isLoading={actionLoading}
        errorMessage={confirmError}
        onConfirm={runConfirmedAction}
        onCancel={closeConfirm}
      />
    </div>
  );
}

function AdminUsersPanel({
  users,
  totalUsers,
  page,
  pageCount,
  loading,
  error,
  status,
  onPageChange,
  onStatusChange,
  onRetry,
  onAction,
  t,
}) {
  return (
    <section className='admin-panel'>
      <PanelHead
        title={t('admin.users.title')}
        description={t('admin.users.description', { count: totalUsers })}
      />
      <div className='admin-toolbar'>
        <select
          className='admin-select'
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label={t('admin.users.filterStatus')}
        >
          <option value='all'>{t('admin.users.allStatuses')}</option>
          <option value='active'>{t('admin.status.active')}</option>
          <option value='inactive'>{t('admin.status.inactive')}</option>
        </select>
      </div>
      <PanelState loading={loading} error={error} empty={!users.length} onRetry={onRetry} t={t} />
      {!loading && !error && users.length > 0 && (
        <>
          <div className='admin-table-wrap'>
            <table className='admin-table'>
              <thead>
                <tr>
                  <th>{t('admin.table.id')}</th>
                  <th>{t('admin.table.user')}</th>
                  <th>{t('admin.table.email')}</th>
                  <th>{t('admin.table.role')}</th>
                  <th>{t('admin.table.status')}</th>
                  <th>{t('admin.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>
                      <strong>{user.username}</strong>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <span
                        className={`admin-status ${
                          user.isActive ? 'is-active' : 'is-inactive'
                        }`}
                      >
                        {user.isActive ? t('admin.status.active') : t('admin.status.inactive')}
                      </span>
                    </td>
                    <td>
                      <div className='admin-row-actions'>
                        {user.isActive ? (
                          <button
                            type='button'
                            onClick={() => onAction('deactivate', user)}
                          >
                            <UserX size={15} aria-hidden='true' />
                            {t('admin.actions.deactivate')}
                          </button>
                        ) : (
                          <button
                            type='button'
                            onClick={() => onAction('activate', user)}
                          >
                            <UserCheck size={15} aria-hidden='true' />
                            {t('admin.actions.activate')}
                          </button>
                        )}
                        <button
                          type='button'
                          className='admin-danger-action'
                          onClick={() => onAction('deleteUser', user)}
                        >
                          <Trash2 size={15} aria-hidden='true' />
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            totalItems={totalUsers}
            pageSize={USERS_PAGE_SIZE}
            label={t('admin.nav.users').toLowerCase()}
            onPageChange={onPageChange}
            t={t}
          />
        </>
      )}
    </section>
  );
}

function AdminEventsPanel({
  events,
  totalEvents,
  page,
  pageCount,
  loading,
  error,
  onPageChange,
  onRetry,
  onDelete,
  t,
}) {
  return (
    <section className='admin-panel'>
      <PanelHead
        title={t('admin.events.title')}
        description={t('admin.events.description', { count: totalEvents })}
      />
      <PanelState loading={loading} error={error} empty={!events.length} onRetry={onRetry} t={t} />
      {!loading && !error && events.length > 0 && (
        <>
          <div className='admin-event-grid'>
            {events.map((event) => (
              <article className='admin-event-card' key={event.id}>
                <div>
                  <span>{event.category || t('admin.events.fallbackCategory')}</span>
                  <h3>{event.title}</h3>
                  <p>{event.description || t('admin.events.noDescription')}</p>
                </div>
                <dl>
                  <div>
                    <dt>{t('admin.table.id')}</dt>
                    <dd>{event.id}</dd>
                  </div>
                  <div>
                    <dt>{t('admin.events.date')}</dt>
                    <dd>{formatEventDate(event.date, event.time, t)}</dd>
                  </div>
                  <div>
                    <dt>{t('events.location')}</dt>
                    <dd>{event.location || t('profileUi.notSet')}</dd>
                  </div>
                  <div>
                    <dt>{t('admin.events.organizer')}</dt>
                    <dd>{event.organizerUsername || t('admin.events.unknown')}</dd>
                  </div>
                </dl>
                <button
                  type='button'
                  className='admin-event-card__delete'
                  onClick={() => onDelete(event)}
                >
                  <Trash2 size={15} aria-hidden='true' />
                  {t('admin.actions.deleteEvent')}
                </button>
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            totalItems={totalEvents}
            pageSize={EVENTS_PAGE_SIZE}
            label={t('admin.nav.events').toLowerCase()}
            onPageChange={onPageChange}
            t={t}
          />
        </>
      )}
    </section>
  );
}

function NavSectionButton({ active, title, count, Icon, onClick }) {
  return (
    <button
      type='button'
      className={`admin-nav__section${active ? ' admin-nav__section--active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <Icon size={20} aria-hidden='true' />
      <span>{title}</span>
      <strong>{count}</strong>
    </button>
  );
}

function Pagination({ page, pageCount, totalItems, pageSize, label, onPageChange, t }) {
  const firstItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <nav className='admin-pagination' aria-label={t('admin.pagination.aria', { label })}>
      <span>
        {t('admin.pagination.showing', { first: firstItem, last: lastItem, total: totalItems, label })}
      </span>
      <div>
        <button
          type='button'
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label={t('admin.pagination.previous', { label })}
        >
          <ChevronLeft size={16} aria-hidden='true' />
        </button>
        <strong>
          {t('admin.pagination.page', { page, pageCount })}
        </strong>
        <button
          type='button'
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          aria-label={t('admin.pagination.next', { label })}
        >
          <ChevronRight size={16} aria-hidden='true' />
        </button>
      </div>
    </nav>
  );
}

function PanelHead({ title, description }) {
  return (
    <div className='admin-panel__head'>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function PanelState({ loading, error, empty, onRetry, t }) {
  if (loading) return <div className='admin-state'>{t('common.loading')}</div>;
  if (error) {
    return (
      <div className='admin-state admin-state--error'>
        <span>{error}</span>
        <button type='button' onClick={onRetry}>
          {t('common.retry')}
        </button>
      </div>
    );
  }
  if (empty) return <div className='admin-state'>{t('admin.empty')}</div>;
  return null;
}

function formatEventDate(date, time, t) {
  if (!date) return t('admin.events.tba');
  const value = new Date(`${date}T${time || '00:00:00'}`);
  if (Number.isNaN(value.getTime())) return date;
  return value.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export default AdminDashboard;
