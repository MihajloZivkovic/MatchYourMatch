import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Flag,
  Info,
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
import NotificationsDropdown from '../../components/notifications/NotificationsDropdown';
import ThemeLang from '../../components/ThemeLang';
import { useTranslation } from '../../hooks/useTranslation';
import { logoutAndRedirect } from '../../services/authSession';
import { adminService } from '../../services/adminService';
import { readJwtPayload } from '../../services/guestSession';
import {
  notificationService,
  NOTIFICATIONS_CHANGED_EVENT,
} from '../../services/notificationService';
import '../../app/app-global.css';
import '../../app/app-polish.css';
import './AdminDashboard.css';

const USERS_PAGE_SIZE = 8;
const EVENTS_PAGE_SIZE = 6;
const REPORTS_PAGE_SIZE = 8;

function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [selectedPanel, setSelectedPanel] = useState('users');
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [reports, setReports] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [reportsError, setReportsError] = useState('');
  const [notice, setNotice] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userStatus, setUserStatus] = useState('all');
  const [usersPage, setUsersPage] = useState(1);
  const [eventQuery, setEventQuery] = useState('');
  const [eventStatus, setEventStatus] = useState('all');
  const [eventsPage, setEventsPage] = useState(1);
  const [reportQuery, setReportQuery] = useState('');
  const [reportStatus, setReportStatus] = useState('all');
  const [reportsPage, setReportsPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmError, setConfirmError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [adminStatus, setAdminStatus] = useState(readJwtPayload()?.role || 'User');
  const [activeStatus, setActiveStatus] = useState(readJwtPayload()?.isActive);
  console.log(activeStatus);

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

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError('');
    try {
      const data = await adminService.reports();
      setReports(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      setReports([]);
      setReportsError(error.message || t('admin.errors.reportsLoad'));
    } finally {
      setReportsLoading(false);
    }
  }, [t]);

  const loadUnreadNotifications = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      setNotificationUnread(0);
      return;
    }
    try {
      const data = await notificationService.unreadCount();
      setNotificationUnread(Math.max(0, Number(data?.count) || 0));
    } catch {
      /* Session handling owns auth errors; navbar polling stays quiet. */
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      loadUsers();
      loadEvents();
      loadReports();
    }, 0);
    return () => window.clearTimeout(initial);
  }, [loadEvents, loadReports, loadUsers]);

  useEffect(() => {
    const initial = window.setTimeout(loadUnreadNotifications, 0);
    const interval = window.setInterval(loadUnreadNotifications, 15000);
    const refresh = () => loadUnreadNotifications();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('tokenChanged', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener('tokenChanged', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadUnreadNotifications]);

  const requestedPanel = useMemo(
    () => getRequestedAdminPanel(location.search),
    [location.search],
  );
  const activePanel = requestedPanel || selectedPanel;

  const selectPanel = (panel) => {
    setSelectedPanel(panel);
    if (location.search) navigate('/admin/dashboard', { replace: true });
  };

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

  const currentAdminId = useMemo(() => getCurrentUserId(), []);

  const filteredEvents = useMemo(() => {
    const query = eventQuery.trim().toLowerCase();
    return events.filter((event) =>
      matchesEventStatus(event, eventStatus) &&
      (!query ||
        [
          event.title,
          event.location,
          event.category,
          event.organizerUsername,
          event.eventType,
          String(event.id),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))),
    );
  }, [eventQuery, eventStatus, events]);

  const filteredReports = useMemo(() => {
    const query = reportQuery.trim().toLowerCase();
    return reports.filter((report) => {
      const statusKey = normalizeStatusKey(report.status);
      const matchesStatus = reportStatus === 'all' || statusKey === reportStatus;
      const matchesQuery =
        !query ||
        [
          report.reporterUsername,
          report.reporterDisplayName,
          report.reportedUsername,
          report.reportedDisplayName,
          report.reason,
          report.details,
          report.status,
          String(report.id),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [reportQuery, reportStatus, reports]);

  const usersPageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const eventsPageCount = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PAGE_SIZE));
  const reportsPageCount = Math.max(1, Math.ceil(filteredReports.length / REPORTS_PAGE_SIZE));
  const safeUsersPage = Math.min(usersPage, usersPageCount);
  const safeEventsPage = Math.min(eventsPage, eventsPageCount);
  const safeReportsPage = Math.min(reportsPage, reportsPageCount);

  const pagedUsers = useMemo(
    () => paginate(filteredUsers, safeUsersPage, USERS_PAGE_SIZE),
    [filteredUsers, safeUsersPage],
  );

  const pagedEvents = useMemo(
    () => paginate(filteredEvents, safeEventsPage, EVENTS_PAGE_SIZE),
    [filteredEvents, safeEventsPage],
  );

  const pagedReports = useMemo(
    () => paginate(filteredReports, safeReportsPage, REPORTS_PAGE_SIZE),
    [filteredReports, safeReportsPage],
  );

  const statGroups = useMemo(() => {
    const activeUsers = users.filter((user) => user.isActive).length;
    const inactiveUsers = users.length - activeUsers;
    const upcomingEvents = events.filter((event) => !isPastEvent(event)).length;
    const pastEvents = events.length - upcomingEvents;
    const pendingReports = reports.filter((report) => normalizeStatusKey(report.status) === 'pending').length;
    const reviewedReports = reports.filter((report) => normalizeStatusKey(report.status) === 'reviewed').length;
    const dismissedReports = reports.filter((report) => normalizeStatusKey(report.status) === 'dismissed').length;
    const actionTakenReports = reports.filter((report) => normalizeStatusKey(report.status) === 'actionTaken').length;
    return [
      {
        title: t('admin.nav.users'),
        Icon: Users,
        primary: users.length,
        items: [
          { label: t('admin.stats.activeUsers'), value: activeUsers },
          { label: t('admin.stats.inactiveUsers'), value: inactiveUsers },
        ],
      },
      {
        title: t('admin.nav.events'),
        Icon: CalendarDays,
        primary: events.length,
        items: [
          { label: t('admin.stats.upcomingEvents'), value: upcomingEvents },
          { label: t('admin.stats.pastEvents'), value: pastEvents },
        ],
      },
      {
        title: t('admin.nav.reports'),
        Icon: Flag,
        primary: reports.length,
        items: [
          { label: t('admin.stats.pendingReports'), value: pendingReports },
          { label: t('admin.reports.statuses.reviewed'), value: reviewedReports },
          { label: t('admin.reports.statuses.dismissed'), value: dismissedReports },
          { label: t('admin.reports.statuses.actionTaken'), value: actionTakenReports },
        ],
      },
    ];
  }, [events, reports, t, users]);

  const requestUserAction = (type, user) => {
    if (isSelfUser(user, currentAdminId)) return;

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
      demoteToUser: {
        title: t('admin.confirm.demoteTitle'),
        message: t('admin.confirm.demoteMessage', { username: user.username }),
        confirmText: t('admin.actions.demote'),
      },
      promoteToAdmin: {
        title: t('admin.confirm.promoteTitle'),
        message: t('admin.confirm.promoteMessage', { username: user.username }),
        confirmText: t('admin.actions.promote'),
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

  const updateReportStatus = async (report, status) => {
    setActionLoading(true);
    setNotice('');
    try {
      await adminService.updateReportStatus(report.id, status);
      await loadReports();
      await loadUnreadNotifications();
      setNotice(t('admin.notices.reportUpdated'));
    } catch (error) {
      setNotice(error.message || t('admin.errors.actionFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const requestBanReportedUser = (report) => {
    setConfirmError('');
    setConfirmAction({
      type: 'banReportedUser',
      target: report,
      title: t('admin.confirm.banReportedUserTitle'),
      message: t('admin.confirm.banReportedUserMessage', {
        username: report.reportedUsername,
      }),
      confirmText: t('admin.actions.banReportedUser'),
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
        setActiveStatus('Active');
      } else if (confirmAction.type === 'deactivate') {
        await adminService.deactivateUser(confirmAction.target.id);
        await loadUsers();
        setNotice(t('admin.notices.userDeactivated', { username: confirmAction.target.username }));
        setActiveStatus('Inactive');
      } else if (confirmAction.type === 'deleteUser') {
        await adminService.deleteUser(confirmAction.target.id);
        await loadUsers();
        setNotice(t('admin.notices.userDeleted', { username: confirmAction.target.username }));
      } else if (confirmAction.type === 'deleteEvent') {
        await adminService.deleteEvent(confirmAction.target.id);
        await loadEvents();
        setNotice(t('admin.notices.eventDeleted', { title: confirmAction.target.title }));
      } else if (confirmAction.type === 'banReportedUser') {
        await adminService.deactivateUser(confirmAction.target.reportedUserId);
        await adminService.updateReportStatus(confirmAction.target.id, 'Action taken');
        await loadUsers();
        await loadReports();
        await loadUnreadNotifications();
        setNotice(t('admin.notices.reportedUserBanned', { username: confirmAction.target.reportedUsername }));
      }else if (confirmAction.type === 'demoteToUser') {
        await adminService.demoteToUser(confirmAction.target.id);
        await loadUsers();
        setNotice(t('admin.notices.userDemoted', { username: confirmAction.target.username }));
        setAdminStatus('User');
      }else if (confirmAction.type === 'promoteToAdmin') {
        await adminService.promoteToAdmin(confirmAction.target.id);
        await loadUsers();
        setNotice(t('admin.notices.userPromoted', { username: confirmAction.target.username }));
        setAdminStatus('Admin');
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
            value={activePanel === 'users' ? userQuery : activePanel === 'events' ? eventQuery : reportQuery}
            placeholder={
              activePanel === 'users'
                ? t('admin.search.users')
                : activePanel === 'events'
                  ? t('admin.search.events')
                  : t('admin.search.reports')
            }
            onChange={(event) => {
              if (activePanel === 'users') {
                setUserQuery(event.target.value);
                setUsersPage(1);
              } else if (activePanel === 'events') {
                setEventQuery(event.target.value);
                setEventsPage(1);
              } else {
                setReportQuery(event.target.value);
                setReportsPage(1);
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
            onClick={() => selectPanel('users')}
          />
          <NavSectionButton
            active={activePanel === 'events'}
            title={t('admin.nav.events')}
            count={filteredEvents.length}
            Icon={CalendarDays}
            onClick={() => selectPanel('events')}
          />
          <NavSectionButton
            active={activePanel === 'reports'}
            title={t('admin.nav.reports')}
            count={filteredReports.length}
            Icon={Flag}
            onClick={() => selectPanel('reports')}
          />
        </nav>
        <div className='admin-nav__actions'>
          <ThemeLang variant='app' />
          <NotificationsDropdown
            unread={notificationUnread}
            onUnreadChange={setNotificationUnread}
            onRefreshUnread={loadUnreadNotifications}
          />
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
              loadReports();
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
          {statGroups.map(({ title, primary, items, Icon }) => (
            <article className='admin-stat-group' key={title}>
              <div className='admin-stat-group__main'>
                <Icon size={18} aria-hidden='true' />
                <strong>{primary}</strong>
                <span>{title}</span>
              </div>
              <dl>
                {items.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
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
            onOpenUser={setSelectedUser}
            currentAdminId={currentAdminId}
            t={t}
          />
        ) : activePanel === 'events' ? (
          <AdminEventsPanel
            events={pagedEvents}
            totalEvents={filteredEvents.length}
            page={safeEventsPage}
            pageCount={eventsPageCount}
            loading={eventsLoading}
            error={eventsError}
            status={eventStatus}
            onPageChange={setEventsPage}
            onStatusChange={(nextStatus) => {
              setEventStatus(nextStatus);
              setEventsPage(1);
            }}
            onRetry={loadEvents}
            onDelete={requestEventDelete}
            t={t}
          />
        ) : (
          <AdminReportsPanel
            reports={pagedReports}
            totalReports={filteredReports.length}
            page={safeReportsPage}
            pageCount={reportsPageCount}
            loading={reportsLoading}
            error={reportsError}
            status={reportStatus}
            actionLoading={actionLoading}
            onPageChange={setReportsPage}
            onStatusChange={(nextStatus) => {
              setReportStatus(nextStatus);
              setReportsPage(1);
            }}
            onRetry={loadReports}
            onResolve={(report) => updateReportStatus(report, 'Reviewed')}
            onReject={(report) => updateReportStatus(report, 'Dismissed')}
            onBan={requestBanReportedUser}
            t={t}
          />
        )}
      </main>

      <UserDetailsModal
        user={selectedUser}
        currentAdminId={currentAdminId}
        onClose={() => setSelectedUser(null)}
        onAction={requestUserAction}
        t={t}
        role={adminStatus}
        promoteButtonText={adminStatus === 'Admin' ? t('admin.actions.demote') : t('admin.actions.promote')}
        activity={activeStatus}
        activityButtonText={activeStatus === "Active" ? t('admin.actions.deactivate') : t('admin.actions.activate')}
      />

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        confirmText={confirmAction?.confirmText || t('common.confirm')}
        cancelText={t('common.cancel')}
        variant={
          confirmAction?.type === 'deleteUser' ||
          confirmAction?.type === 'deleteEvent' ||
          confirmAction?.type === 'banReportedUser'
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
  onOpenUser,
  currentAdminId,
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
                      <button
                        type='button'
                        className='admin-link-button'
                        onClick={() => onOpenUser(user)}
                      >
                        <strong>{user.username}</strong>
                      </button>
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
                        <button
                          type='button'
                          onClick={() => onOpenUser(user)}
                        >
                          <Info size={15} aria-hidden='true' />
                          {t('common.view')}
                        </button>
                        {user.isActive ? (
                          <button
                            type='button'
                            onClick={() => onAction('deactivate', user)}
                            disabled={isSelfUser(user, currentAdminId)}
                            title={isSelfUser(user, currentAdminId) ? t('admin.users.selfActionDisabled') : undefined}
                          >
                            <UserX size={15} aria-hidden='true' />
                            {t('admin.actions.deactivate')}
                          </button>
                        ) : (
                          <button
                            type='button'
                            onClick={() => onAction('activate', user)}
                            disabled={isSelfUser(user, currentAdminId)}
                            title={isSelfUser(user, currentAdminId) ? t('admin.users.selfActionDisabled') : undefined}
                          >
                            <UserCheck size={15} aria-hidden='true' />
                            {t('admin.actions.activate')}
                          </button>
                        )}
                        <button
                          type='button'
                          className='admin-danger-action'
                          onClick={() => onAction('deleteUser', user)}
                          disabled={isSelfUser(user, currentAdminId)}
                          title={isSelfUser(user, currentAdminId) ? t('admin.users.selfActionDisabled') : undefined}
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
  status,
  onPageChange,
  onStatusChange,
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
      <div className='admin-toolbar'>
        <select
          className='admin-select'
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label={t('admin.events.filterStatus')}
        >
          <option value='all'>{t('admin.events.filters.all')}</option>
          <option value='upcoming'>{t('admin.events.filters.upcoming')}</option>
          <option value='past'>{t('admin.events.filters.past')}</option>
        </select>
        <span className='admin-toolbar__note'>
          {t('admin.events.hideShowUnavailable')}
        </span>
      </div>
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
                  <div>
                    <dt>{t('admin.events.attendees')}</dt>
                    <dd>{formatAttendees(event, t)}</dd>
                  </div>
                  <div>
                    <dt>{t('admin.events.visibility')}</dt>
                    <dd>{t('admin.events.visible')}</dd>
                  </div>
                  <div>
                    <dt>{t('admin.events.status')}</dt>
                    <dd>{isPastEvent(event) ? t('admin.events.filters.past') : t('admin.events.filters.upcoming')}</dd>
                  </div>
                  <div>
                    <dt>{t('admin.events.type')}</dt>
                    <dd>{event.eventType || t('admin.events.unknown')}</dd>
                  </div>
                </dl>
                <div className='admin-row-actions'>
                  <button type='button' disabled title={t('admin.events.hideShowUnavailable')}>
                    <EyeOff size={15} aria-hidden='true' />
                    {t('admin.actions.hideEvent')}
                  </button>
                </div>
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

function AdminReportsPanel({
  reports,
  totalReports,
  page,
  pageCount,
  loading,
  error,
  status,
  actionLoading,
  onPageChange,
  onStatusChange,
  onRetry,
  onResolve,
  onReject,
  onBan,
  t,
}) {
  return (
    <section className='admin-panel'>
      <PanelHead
        title={t('admin.reports.title')}
        description={t('admin.reports.description', { count: totalReports })}
      />
      <div className='admin-toolbar'>
        <select
          className='admin-select'
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label={t('admin.reports.filterStatus')}
        >
          <option value='all'>{t('admin.reports.statuses.all')}</option>
          <option value='pending'>{t('admin.reports.statuses.pending')}</option>
          <option value='reviewed'>{t('admin.reports.statuses.reviewed')}</option>
          <option value='dismissed'>{t('admin.reports.statuses.dismissed')}</option>
          <option value='actionTaken'>{t('admin.reports.statuses.actionTaken')}</option>
        </select>
      </div>
      <PanelState loading={loading} error={error} empty={!reports.length} onRetry={onRetry} t={t} />
      {!loading && !error && reports.length > 0 && (
        <>
          <div className='admin-report-list'>
            {reports.map((report) => (
              <article className='admin-report-card' key={report.id}>
                <header>
                  <div>
                    <span>{report.reason}</span>
                    <h3>#{report.id} {report.reportedUsername}</h3>
                  </div>
                  <span className={`admin-status admin-status--${normalizeStatusKey(report.status)}`}>
                    {translateReportStatus(report.status, t)}
                  </span>
                </header>
                <dl>
                  <div>
                    <dt>{t('admin.reports.fields.reporter')}</dt>
                    <dd>{formatReportUser(report.reporterUsername, report.reporterDisplayName)}</dd>
                  </div>
                  <div>
                    <dt>{t('admin.reports.fields.reported')}</dt>
                    <dd>{formatReportUser(report.reportedUsername, report.reportedDisplayName)}</dd>
                  </div>
                  <div>
                    <dt>{t('admin.reports.fields.date')}</dt>
                    <dd>{formatDateTime(report.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>{t('admin.reports.fields.reviewed')}</dt>
                    <dd>{report.reviewedAt ? formatDateTime(report.reviewedAt) : t('admin.reports.notReviewed')}</dd>
                  </div>
                </dl>
                <p>{report.details || t('admin.reports.noDetails')}</p>
                <div className='admin-row-actions'>
                  <button
                    type='button'
                    onClick={() => onResolve(report)}
                    disabled={actionLoading || normalizeStatusKey(report.status) !== 'pending'}
                  >
                    {t('admin.actions.resolveReport')}
                  </button>
                  <button
                    type='button'
                    onClick={() => onReject(report)}
                    disabled={actionLoading || normalizeStatusKey(report.status) !== 'pending'}
                  >
                    {t('admin.actions.rejectReport')}
                  </button>
                  <button
                    type='button'
                    className='admin-danger-action'
                    onClick={() => onBan(report)}
                    disabled={actionLoading || normalizeStatusKey(report.status) === 'actionTaken'}
                  >
                    <UserX size={15} aria-hidden='true' />
                    {t('admin.actions.banReportedUser')}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            totalItems={totalReports}
            pageSize={REPORTS_PAGE_SIZE}
            label={t('admin.nav.reports').toLowerCase()}
            onPageChange={onPageChange}
            t={t}
          />
        </>
      )}
    </section>
  );
}



function UserDetailsModal({ user, currentAdminId, onClose, onAction, t, role, promoteButtonText, activity, activityButtonText }) {
  
  const self = isSelfUser(user, currentAdminId);
  const [promoteDemoteAction, setPromoteDemoteAction] = useState("");
  const [activateDeactivateAction, setActivateDeactivateAction] = useState("");
  useEffect(() => {
  promoteButtonText === "Promote to admin" || promoteButtonText === "Unapredi na admina" ? setPromoteDemoteAction('promoteToAdmin') : setPromoteDemoteAction('demoteToUser');
  }, [promoteButtonText]);
  useEffect(() => {
    activityButtonText === "Activate" || activityButtonText === "Aktiviraj" ? setActivateDeactivateAction('activate') : setActivateDeactivateAction('deactivate');
  }, [activityButtonText]);
  console.log(activateDeactivateAction);

  if (!user) return null;

  return (
    <div className='admin-modal' role='presentation' onMouseDown={onClose}>
      <section
        className='admin-modal__card'
        role='dialog'
        aria-modal='true'
        aria-labelledby='admin-user-details-title'
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className='admin-modal__head'>
          <div>
            <span>{t('admin.users.detailsEyebrow')}</span>
            <h2 id='admin-user-details-title'>{user.username}</h2>
          </div>
          <button type='button' onClick={onClose} aria-label={t('common.close')}>
            x
          </button>
        </div>
        <dl className='admin-detail-list'>
          <div>
            <dt>{t('admin.table.id')}</dt>
            <dd>{user.id}</dd>
          </div>
          <div>
            <dt>{t('admin.table.email')}</dt>
            <dd>{user.email || t('profileUi.notSet')}</dd>
          </div>
          <div>
            <dt>{t('admin.table.role')}</dt>
            <dd>{role || t('profileUi.notSet')}</dd>
          </div>
          <div>
            <dt>{t('admin.table.status')}</dt>
            <dd>{activity || t('profileUi.notSet')}</dd>
          </div>
          <div>
            <dt>{t('admin.users.joinedDate')}</dt>
            <dd>{t('admin.unavailable.long')}</dd>
          </div>
          <div>
            <dt>{t('admin.users.reportsCount')}</dt>
            <dd>{t('admin.unavailable.long')}</dd>
          </div>
          <div>
            <dt>{t('admin.users.profileInfo')}</dt>
            <dd>{t('admin.users.profileInfoUnavailable')}</dd>
          </div>
        </dl>
        {self && <p className='admin-modal__warning'>{t('admin.users.selfActionDisabled')}</p>}
        <div className='admin-row-actions admin-modal__actions'>
          {user.role === 'Admin' ? (
            <button type='button' onClick={() => onAction(promoteDemoteAction, user)} disabled={self}>
              <UserX size={15} aria-hidden='true' />
              {promoteButtonText}
            </button>
          ) : user.role === 'User' ?(
            <button type='button' onClick={() => onAction(promoteDemoteAction, user)} disabled={self}>
              <UserCheck size={15} aria-hidden='true' />
              {promoteButtonText}
            </button>
          ) : null}

          {user.isActive ? (
            <button type='button' onClick={() => onAction(activateDeactivateAction, user)} disabled={self}>
              <UserX size={15} aria-hidden='true' />
              {activityButtonText}
            </button>
          ) : (
            <button type='button' onClick={() => onAction(activateDeactivateAction, user)} disabled={self}>
              <UserCheck size={15} aria-hidden='true' />
              {activityButtonText}
            </button>
          )}
          <button
            type='button'
            className='admin-danger-action'
            onClick={() => onAction('deleteUser', user)}
            disabled={self}
          >
            <Trash2 size={15} aria-hidden='true' />
            {t('admin.actions.deleteUser')}
          </button>
        </div>
      </section>
    </div>
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
  return formatDateTime(value);
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAttendees(event, t) {
  const current = event.participantsCount ?? event.ParticipantsCount ?? 0;
  const max = event.maxAttendees ?? event.MaxAttendees;
  return max ? `${current}/${max}` : t('admin.events.attendeesCount', { count: current });
}

function getEventDateValue(event) {
  const date = event.date ?? event.Date;
  const time = event.time ?? event.Time ?? '00:00:00';
  if (!date) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function isPastEvent(event) {
  const value = getEventDateValue(event);
  return value ? value < new Date() : false;
}

function matchesEventStatus(event, status) {
  if (status === 'upcoming') return !isPastEvent(event);
  if (status === 'past') return isPastEvent(event);
  return true;
}

function getCurrentUserId() {
  const payload = readJwtPayload();
  const id =
    payload?.nameid ||
    payload?.sub ||
    payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSelfUser(user, currentAdminId) {
  return currentAdminId != null && Number(user?.id) === currentAdminId;
}

function getRequestedAdminPanel(search) {
  const section = new URLSearchParams(search).get('section');
  return ['users', 'events', 'reports'].includes(section) ? section : '';
}

function normalizeStatusKey(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'action taken') return 'actionTaken';
  return value || 'pending';
}

function translateReportStatus(status, t) {
  const key = normalizeStatusKey(status);
  return t(`admin.reports.statuses.${key}`);
}

function formatReportUser(username, displayName) {
  return displayName ? `${displayName} (@${username})` : `@${username}`;
}

function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export default AdminDashboard;
