import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AppNavbar from './AppNavbar';
import AppFooter from './AppFooter';
import FloatingChat from '../components/chat/FloatingChat';
import { ChatProvider } from '../context/ChatContext';
import { isGuestSession, isOrganizerSession } from '../services/guestSession';
import './app-global.css';
import './app-polish.css';

function AppShell(props) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const isChatRoute = location.pathname === '/app/chat';
  const isGuest = isGuestSession();
  const isOrganizer = !isGuest && isOrganizerSession();

  if (!token) {
    return <Navigate to='/' replace />;
  }

  return (
    <div className="app-shell">
      <div className="app-shell__bg" aria-hidden="true">
        <span className="app-shell__grain" />
        <span className="app-shell__glow app-shell__glow--tl" />
        <span className="app-shell__glow app-shell__glow--br" />
      </div>
      <AppNavbar picture={props.userProfile?.profilePicture} currentUser={props.currentUser} />
      <ChatProvider>
        <main className={`app-shell__main${isChatRoute ? ' app-shell__main--chat' : ''}`}>
          <Outlet />
          {!isChatRoute && <AppFooter />}
        </main>
        {!isGuest && !isOrganizer && !isChatRoute && <FloatingChat />}
      </ChatProvider>
    </div>
  );
}

export default AppShell;
