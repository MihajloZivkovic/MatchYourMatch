import { Outlet } from 'react-router-dom';
import AppNavbar from './AppNavbar';
import AppFooter from './AppFooter';
import FloatingChat from '../components/chat/FloatingChat';
import './app-global.css';
import './app-polish.css';

function AppShell(props) {
  return (
    <div className="app-shell">
      <div className="app-shell__bg" aria-hidden="true">
        <span className="app-shell__grain" />
        <span className="app-shell__glow app-shell__glow--tl" />
        <span className="app-shell__glow app-shell__glow--br" />
      </div>
      <AppNavbar picture={props.userProfile.profilePicture} />
      <main className="app-shell__main">
        <Outlet />
        <AppFooter />
      </main>
      <FloatingChat />
    </div>
  );
}

export default AppShell;
