import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login, register } from '../features/auth/api';
import { authStore } from '../features/auth/auth-store';
import './Login.css';

function getSafeRedirect(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/chat';
}

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = getSafeRedirect(new URLSearchParams(location.search).get('redirect'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const data = isLogin
        ? await login({ email: form.email, password: form.password })
        : await register(form);

      authStore.setSession(data.token, data.user);
      navigate(redirect, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Chat App</h1>
        <h2>{isLogin ? 'Login' : 'Register'}</h2>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={e => setForm({...form, username: e.target.value})}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm({...form, email: e.target.value})}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm({...form, password: e.target.value})}
            required
          />

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={submitting}>{isLogin ? 'Login' : 'Register'}</button>
        </form>

        <p onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
        </p>
      </div>
    </div>
  );
}
