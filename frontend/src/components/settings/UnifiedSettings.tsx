import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Moon, Sun, Clock, Server, Lock } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

export function UnifiedSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [message, setMessage] = useState('');
  
  const { data: settingsData, isLoading, refetch } = useQuery({
    queryKey: ['unified-settings'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/settings`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });
  
  useEffect(() => {
    if (settingsData?.settings) {
      setSettings(settingsData.settings);
    }
  }, [settingsData]);
  
  const saveMutation = useMutation({
    mutationFn: async (newSettings: Record<string, any>) => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/settings/batch`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettings)
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      setMessage('✅ Saved!');
      refetch();
      setTimeout(() => setMessage(''), 2000);
    },
    onError: () => setMessage('❌ Failed')
  });
  
  const handleSave = () => saveMutation.mutate(settings);
  const updateSetting = (key: string, value: any) => setSettings(prev => ({ ...prev, [key]: value }));
  
  if (isLoading) return <div className="p-6 text-gray-400">Загрузка...</div>;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Общие настройки</h2>
        <button onClick={handleSave} disabled={saveMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
          <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Сохранение...' : 'Сохранить все'}
        </button>
      </div>
      
      {message && <div className={`p-3 rounded ${message.startsWith('✅') ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'}`}>{message}</div>}
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Refresh Interval */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Clock className="w-4 h-4" /> Интервал обновления
            </label>
            <div className="flex items-center gap-4">
              <input type="range" min="30" max="300" step="30" value={parseInt(settings.refresh_interval) || 30} onChange={(e) => updateSetting('refresh_interval', e.target.value)} className="flex-1" />
              <span className="text-gray-900 dark:text-white min-w-[50px]">{settings.refresh_interval || 30}s</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Интервал обновления дашборда в секундах</p>
          </div>
          
          {/* Theme */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {settings.theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} Тема
            </label>
            <select value={settings.theme || 'dark'} onChange={(e) => updateSetting('theme', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="dark">🌙 Темная</option>
              <option value="light">☀️ Светлая</option>
              <option value="system">💻 Системная</option>
            </select>
          </div>
          
        </div>
      </div>
      
      {/* Discovery Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-blue-500" /> Настройки обнаружения
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">IP хоста</label>
            <input type="text" value={settings.discovery_host_ip || ''} onChange={(e) => updateSetting('discovery_host_ip', e.target.value)} placeholder="localhost" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Логин API</label>
            <input type="text" value={settings.api_username || ''} onChange={(e) => updateSetting('api_username', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Пароль API</label>
            <input type="password" value={settings.api_password || ''} onChange={(e) => updateSetting('api_password', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
