import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Monitor, 
  ExternalLink, 
  RefreshCw
} from 'lucide-react';

interface Bot {
  id: string;
  name: string;
  api_url: string;  // e.g., "http://localhost:9010"
  api_port?: number;
  host?: string;
  status?: string;
  strategy?: string;
  exchange?: string;
}

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

export function FreqtradeBots() {
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch bots from database
  const { data: bots, isLoading: botsLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/bots`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      // Filter bots that have api_url
      const validBots = (data.data || []).filter((b: Bot) => b.api_url);
      return validBots;
    }
  });
  
  // Set first bot as default
  useEffect(() => {
    if (bots && bots.length > 0 && !selectedBot) {
      setSelectedBot(bots[0]);
      setIsLoading(false);
    }
  }, [bots, selectedBot]);
  
  const handleBotChange = (botId: string) => {
    const bot = bots?.find((b: Bot) => b.id === botId);
    if (bot) {
      setSelectedBot(bot);
      setIsLoading(true);
    }
  };
  
  if (botsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0f1419]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-500">Загрузка ботов из базы данных...</p>
        </div>
      </div>
    );
  }
  
  if (!bots || bots.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0f1419]">
        <div className="text-center text-gray-500">
          <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Боты с настроенным api_url не найдены</p>
          <p className="text-sm mt-2">Проверьте таблицу 'bots' в базе данных</p>
        </div>
      </div>
    );
  }
  
  // Build dashboard URL
  const getDashboardUrl = (bot: Bot | null) => {
    if (!bot) return '';
    return `${bot.api_url}/dashboard`;
  };
  
  return (
    <div className="fixed inset-0 flex flex-col bg-[#0f1419]" style={{ left: '16rem' }}>
      {/* Compact Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-blue-500" />
          <h1 className="text-lg font-bold text-white">Боты Freqtrade</h1>
          
          {/* Bot Selector */}
          <select
            value={selectedBot?.id || ''}
            onChange={(e) => handleBotChange(e.target.value)}
            className="ml-2 px-3 py-1.5 bg-[#0f1419] border border-[#30363d] rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {bots.map((bot: Bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </select>
          
          {selectedBot?.strategy && (
            <span className="px-2 py-1 bg-blue-900 text-blue-200 rounded-full text-xs">
              {selectedBot.strategy}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {selectedBot && (
            <a
              href={getDashboardUrl(selectedBot)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть дашборд
            </a>
          )}
        </div>
      </div>
      
      {/* Iframe Container - Full width/height */}
      <div className="flex-1 relative bg-[#0f1419] overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f1419] z-10">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-500">Загрузка дашборда {selectedBot?.name}...</p>
            </div>
          </div>
        )}
        
        {selectedBot && (
          <iframe
            src={getDashboardUrl(selectedBot)}
            className="w-full h-full border-0"
            onLoad={() => setIsLoading(false)}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            title={`Freqtrade ${selectedBot.name}`}
          />
        )}
      </div>
    </div>
  );
}
