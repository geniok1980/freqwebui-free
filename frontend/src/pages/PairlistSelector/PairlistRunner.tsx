import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { strategyLabApi } from '../../services/strategyLabApi';
import { Monitor, ExternalLink, RefreshCw } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

const MODES = [
  { id: 'ml_training', label: '🤖 ML-обучение', description: 'Обучение ML-моделей по каждой паре' },
  { id: 'fullbacktest_batch', label: '⚡ Полный бэктест (пакетный)', description: 'Быстрый пакетный бэктест всех пар сразу' },
  { id: 'fullbacktest_individual', label: '🔬 Полный бэктест (индивидуальный)', description: 'Детальный бэктест по каждой паре (медленнее)' },
];

export function PairlistRunner() {
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [selectedMode, setSelectedMode] = useState('fullbacktest_batch');
  const [nPairs, setNPairs] = useState(50);
  const [downloadDays, setDownloadDays] = useState(60);
  const [backtestDays, setBacktestDays] = useState('');
  const [configFile, setConfigFile] = useState('config-pairlist.json');
  const [maxPairs, setMaxPairs] = useState(500);
  const [message, setMessage] = useState('');
  
  const { data: strategies } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => strategyLabApi.getStrategies(),
  });
  
  const { data: jobs, refetch: refetchJobs } = useQuery({
    queryKey: ['pairlist-jobs'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/pairlist-selector/jobs`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return res.json();
    },
    refetchInterval: 5000,
  });
  
  const runMutation = useMutation({
    mutationFn: async (params: any) => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/pairlist-selector/run`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      if (!res.ok) throw new Error('Не удалось запустить');
      return res.json();
    },
    onSuccess: () => {
      setMessage('✅ Оптимизатор pairlist запущен!');
      refetchJobs();
    },
    onError: (err: any) => {
      setMessage(`❌ Error: ${err.message}`);
    }
  });
  
  const handleRun = () => {
    if (!selectedStrategy) {
      setMessage('❌ Выберите стратегию');
      return;
    }
    runMutation.mutate({
      strategy: selectedStrategy,
      mode: selectedMode,
      n_pairs: nPairs,
      download_days: downloadDays,
      backtest_days: backtestDays ? parseInt(backtestDays) : null,
      config_file: configFile,
      max_pairs: maxPairs
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Configuration Form */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Strategy & Mode */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">Стратегия</label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f1419] border border-[#30363d] rounded-lg text-white"
            >
              <option value="">-- Выберите стратегию --</option>
              {strategies?.map((s: any) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">Режим оценки</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MODES.map((mode) => (
                <label
                  key={mode.id}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedMode === mode.id
                      ? 'bg-blue-900/20 border-blue-500'
                      : 'bg-[#0f1419] border-[#30363d] hover:bg-[#1a2332]'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={mode.id}
                    checked={selectedMode === mode.id}
                    onChange={(e) => setSelectedMode(e.target.value)}
                    className="mb-2"
                  />
                  <span className="font-medium text-white">{mode.label}</span>
                  <p className="text-sm text-gray-400 mt-1">{mode.description}</p>
                </label>
              ))}
            </div>
          </div>
          
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">Файл конфигурации</label>
            <input
              type="text"
              value={configFile}
              onChange={(e) => setConfigFile(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f1419] border border-[#30363d] rounded-lg text-white"
            />
          </div>
        </div>
        
        {/* Parameters */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
          <h3 className="text-lg font-medium text-white mb-6">Параметры</h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Целевые пары: {nPairs}</label>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={nPairs}
                onChange={(e) => setNPairs(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-300 mb-2">Макс. пар для оценки: {maxPairs}</label>
              <input
                type="range"
                min="100"
                max="1000"
                step="100"
                value={maxPairs}
                onChange={(e) => setMaxPairs(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-300 mb-2">Дни загрузки</label>
              <input
                type="number"
                min="30"
                max="365"
                value={downloadDays}
                onChange={(e) => setDownloadDays(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-[#0f1419] border border-[#30363d] rounded-lg text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-300 mb-2">Дни бэктеста (необязательно)</label>
              <input
                type="number"
                placeholder="Все доступные данные"
                value={backtestDays}
                onChange={(e) => setBacktestDays(e.target.value)}
                className="w-full px-4 py-2 bg-[#0f1419] border border-[#30363d] rounded-lg text-white"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Run Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleRun}
          disabled={runMutation.isPending || !selectedStrategy}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold rounded-lg text-lg"
        >
          {runMutation.isPending ? '🚀 Запуск...' : '🚀 Запустить оптимизатор pairlist'}
        </button>
        
        {message && (
          <span className={message.startsWith('✅') ? 'text-green-400' : 'text-red-400'}>{message}</span>
        )}
      </div>
      
      {/* Running Jobs */}
      {jobs?.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
          <h3 className="text-lg font-medium text-white mb-4">Запущенные задачи</h3>
          <div className="space-y-3">
            {jobs.map((job: any) => (
              <div
                key={job.job_id}
                className={`p-4 rounded-lg border ${
                  job.status === 'running' ? 'bg-orange-900/20 border-orange-500' :
                  job.status === 'completed' ? 'bg-green-900/20 border-green-500' :
                  'bg-red-900/20 border-red-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{job.strategy}</span>
                  <span className={`px-2 py-1 text-xs rounded ${
                    job.status === 'running' ? 'bg-orange-600' :
                    job.status === 'completed' ? 'bg-green-600' : 'bg-red-600'
                  } text-white`}>{job.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
