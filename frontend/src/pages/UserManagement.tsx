/**
 * User Management page (Admin only).
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from '../components/common/Toast';
import { useTranslation } from 'react-i18next';

interface User {
  id: string;
  username: string;
  role: string;
  preferences: Record<string, any>;
  created_at: string;
}

export function UserManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('readonly');

  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
  });

  const createUser = useMutation({
    mutationFn: async (userData: { username: string; password: string; role: string }) => {
      const response = await api.post('/users', userData);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Пользователь успешно создан');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Не удалось создать пользователя');
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const response = await api.patch(`/users/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Пользователь успешно обновлен');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Не удалось обновить пользователя');
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.delete(`/users/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Пользователь успешно удален');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Не удалось удалить пользователя');
    },
  });

  const resetForm = () => {
    setFormUsername('');
    setFormPassword('');
    setFormRole('readonly');
  };

  const handleCreate = () => {
    if (!formUsername || !formPassword) {
      toast.error('Требуются логин и пароль');
      return;
    }
    createUser.mutate({
      username: formUsername,
      password: formPassword,
      role: formRole,
    });
  };

  const handleUpdate = () => {
    if (!editingUser) return;
    const data: Record<string, any> = {};
    if (formUsername && formUsername !== editingUser.username) {
      data.username = formUsername;
    }
    if (formPassword) {
      data.password = formPassword;
    }
    if (formRole !== editingUser.role) {
      data.role = formRole;
    }
    if (Object.keys(data).length === 0) {
      toast.info('Нет изменений для сохранения');
      return;
    }
    updateUser.mutate({ id: editingUser.id, data });
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword('');
    setFormRole(user.role);
  };

  const users = (data as { users?: User[] })?.users || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Не удалось загрузить пользователей. Проверьте права администратора.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Управление пользователями</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Добавить пользователя
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Логин
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Роль
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Создан
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user: User) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium mr-3">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {user.username}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      user.role === 'admin'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                        : user.role === 'operator'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString()
                    : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button
                    onClick={() => openEditModal(user)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mr-4"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(user.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Пользователи не найдены
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <Modal
          title="Создать пользователя"
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          isLoading={createUser.isPending}
          loadingText="Создание пользователя..."
        >
          <UserForm
            username={formUsername}
            setUsername={setFormUsername}
            password={formPassword}
            setPassword={setFormPassword}
            role={formRole}
            setRole={setFormRole}
            onSubmit={handleCreate}
            isLoading={createUser.isPending}
            submitLabel="Создать"
            requirePassword
          />
        </Modal>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <Modal
          title="Редактировать пользователя"
          onClose={() => {
            setEditingUser(null);
            resetForm();
          }}
          isLoading={updateUser.isPending}
          loadingText="Сохранение изменений..."
        >
          <UserForm
            username={formUsername}
            setUsername={setFormUsername}
            password={formPassword}
            setPassword={setFormPassword}
            role={formRole}
            setRole={setFormRole}
            onSubmit={handleUpdate}
            isLoading={updateUser.isPending}
            submitLabel="Сохранить изменения"
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal
          title="Удалить пользователя"
          onClose={() => setDeleteConfirm(null)}
          isLoading={deleteUser.isPending}
          loadingText="Удаление пользователя..."
        >
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Вы уверены, что хотите удалить этого пользователя? Это действие нельзя отменить.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteConfirm(null)}
              disabled={deleteUser.isPending}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              Отмена
            </button>
            <button
              onClick={() => deleteUser.mutate(deleteConfirm)}
              disabled={deleteUser.isPending}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg"
            >
              Удалить
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Modal Component
function Modal({
  title,
  children,
  onClose,
  isLoading,
  loadingText,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isLoading?: boolean;
  loadingText?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 relative">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 rounded-lg flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {loadingText || 'Обработка...'}
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// User Form Component
function UserForm({
  username,
  setUsername,
  password,
  setPassword,
  role,
  setRole,
  onSubmit,
  isLoading,
  submitLabel,
  requirePassword = false,
}: {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  role: string;
  setRole: (v: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  submitLabel: string;
  requirePassword?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Логин
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Пароль {!requirePassword && '(оставьте пустым, чтобы не менять)'}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Роль
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="readonly">Только чтение</option>
          <option value="operator">Оператор</option>
          <option value="admin">Админ</option>
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Админ: полный доступ | Оператор: управление ботами | Только чтение: просмотр
        </p>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg"
        >
          {isLoading ? 'Сохранение...' : submitLabel}
        </button>
      </div>
    </div>
  );
}
