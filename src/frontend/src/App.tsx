import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LoginPage } from './pages/Login';
import { ChatPage } from './pages/Chat';
import { authStore } from './features/auth/auth-store';

function getSafeRedirect(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/chat';
}

function ChatRedirect() {
  const location = useLocation();
  const target = `${location.pathname}${location.search}`;
  return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} replace />;
}

function LoginRoute() {
  const location = useLocation();
  const redirect = getSafeRedirect(new URLSearchParams(location.search).get('redirect'));
  const isAuthenticated = authStore.isAuthenticated();
  return isAuthenticated ? <Navigate to={redirect} replace /> : <LoginPage />;
}

function ChatRoute() {
  const isAuthenticated = authStore.isAuthenticated();
  return isAuthenticated ? <ChatPage /> : <ChatRedirect />;
}

function RootRoute() {
  return <Navigate to={authStore.isAuthenticated() ? '/chat' : '/login'} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/chat" element={<ChatRoute />} />
        <Route path="/" element={<RootRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
