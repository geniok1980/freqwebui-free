import { useState, useEffect } from 'react';
import { Save, Server, Info, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

export function DiscoverySettings() {
  const { t } = useTranslation();
  const [hostIp, setHostIp] = useState('');
  const [apiUsername, setApiUsername] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Load current settings
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    
    // Load all settings
    fetch(`${API_BASE}/settings/system`, {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(settings => {
        const settingsMap = settings.reduce((acc: any, s: any) => {
          acc[s.key] = s.value;
          return acc;
        }, {});
        
        if (settingsMap.discovery_host_ip) setHostIp(settingsMap.discovery_host_ip);
        if (settingsMap.api_username) setApiUsername(settingsMap.api_username);
        // Don't load password for security
      })
      .catch(() => {});
  }, []);
  
  const save = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('access_token');
      
      // Save host IP
      await fetch(`${API_BASE}/settings/system`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'discovery_host_ip',
          value: hostIp
        })
      });
      
      // Save username if provided
      if (apiUsername) {
        await fetch(`${API_BASE}/settings/system`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            key: 'api_username',
            value: apiUsername
          })
        });
      }
      
      // Save password if provided
      if (apiPassword) {
        await fetch(`${API_BASE}/settings/system`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            key: 'api_password',
            value: apiPassword
          })
        });
      }
      
      setMessage(t('settings.saved'));
      setApiPassword(''); // Clear password after save
    } catch (e) {
      setMessage(t('settings.saveFailed') + ': ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Server className="w-6 h-6 text-blue-500" />
        <h3 className="text-lg font-bold text-white">{t('settings.discoverySettings')}</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            {t('settings.discoveryHostIpLabel')}
          </label>
          <input
            type="text"
            value={hostIp}
            onChange={(e) => setHostIp(e.target.value)}
            placeholder="localhost"
            className="w-full px-4 py-2 bg-[#0f1419] border border-[#30363d] rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            {t('settings.discoveryHostIpHint')}
          </p>
        </div>
        
        {/* API Authentication */}
        <div className="pt-4 border-t border-[#30363d]">
          <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {t('settings.apiAuth')}
          </label>
          
          <div className="space-y-3">
            <input
              type="text"
              value={apiUsername}
              onChange={(e) => setApiUsername(e.target.value)}
              placeholder={t('settings.apiLogin')}
              className="w-full px-4 py-2 bg-[#0f1419] border border-[#30363d] rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <input
              type="password"
              value={apiPassword}
              onChange={(e) => setApiPassword(e.target.value)}
              placeholder={t('settings.apiPasswordPlaceholder')}
              className="w-full px-4 py-2 bg-[#0f1419] border border-[#30363d] rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {t('settings.apiCredentialsHint')}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {loading ? t('settings.saving') : t('common.save')}
          </button>
          
          {message && (
            <span className={message.startsWith('✅') ? 'text-green-400' : 'text-red-400'}>
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
