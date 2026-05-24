import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function Signup() {
  const navigate = useNavigate();
  const { signup, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await signup({
        username: username.trim(),
        password: password.trim(),
        tenant_name: tenantName.trim(),
        tenant_slug: tenantSlug.trim(),
      });
      navigate('/');
    } catch {
      // store already handles errors
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-6 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Регистрация SaaS</h1>
        {error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            placeholder="Логин"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            placeholder="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            placeholder="Название компании/тенанта"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            required
          />
          <input
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            placeholder="tenant-slug"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Создание аккаунта...' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
