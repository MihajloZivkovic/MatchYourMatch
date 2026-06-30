import { Link, Navigate, useLocation } from 'react-router-dom';
import { isOrganizerSession } from '../services/guestSession';

function OrganizerRoute({ children }) {
  const location = useLocation();

  if (!isOrganizerSession()) {
    return <OrganizerAccessDenied from={location.pathname} />;
  }

  return children;
}

function OrganizerAccessDenied({ from }) {
  if (from === '/app/events/create' || /\/app\/events\/\d+\/edit/.test(from || '')) {
    return (
      <Navigate
        to="/app/events"
        replace
        state={{ organizerOnly: true, from }}
      />
    );
  }

  return (
    <div className="organizer-access-denied">
      <section>
        <span>MYM ORGANIZER</span>
        <h1>Access denied</h1>
        <p>Organizer tools are available only to organizer accounts.</p>
        <Link to="/app/events">Back to events</Link>
      </section>
    </div>
  );
}

export default OrganizerRoute;
