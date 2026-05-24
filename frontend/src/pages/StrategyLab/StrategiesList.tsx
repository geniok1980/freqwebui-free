import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { strategyLabApi, type Strategy } from '../../services/strategyLabApi';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

export function StrategiesList() {
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [actionType, setActionType] = useState<'backtest' | 'hyperopt' | null>(null);
  const [epochs, setEpochs] = useState(30);
  const [message, setMessage] = useState('');
  
  // Fetch strategies
  const { data: strategies, isLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => strategyLabApi.getStrategies(),
  });
  
  // Run workflow mutation (handles both backtest and hyperopt)
  const runWorkflow = useMutation({
    mutationFn: async ({ strategy, steps, epochs }: any) => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/strategy-lab/workflow/start`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          strategy,
          steps,
          epochs,
          auto_promote: true
        })
      });
      if (!res.ok) throw new Error('Failed to start');
      return res.json();
    },
    onSuccess: (data) => {
      setMessage(`✅ ${actionType === 'backtest' ? 'Backtest' : 'Hyperopt'} started! Job ID: ${data.job_id || 'N/A'}`);
      setSelectedStrategy(null);
      setActionType(null);
    },
    onError: (err: any) => {
      setMessage(`❌ Error: ${err.message}`);
    }
  });
  
  const handleAction = (strategy: Strategy, action: 'backtest' | 'hyperopt') => {
    setSelectedStrategy(strategy);
    setActionType(action);
    setMessage('');
  };
  
  const confirmAction = () => {
    if (!selectedStrategy || !actionType) return;
    
    const steps = actionType === 'backtest' 
      ? ['backtest'] 
      : ['hyperopt'];
    
    runWorkflow.mutate({
      strategy: selectedStrategy.name,
      steps,
      epochs
    });
  };
  
  // Group strategies by family
  const groupedStrategies = strategies?.reduce((acc: Record<string, Strategy[]>, strategy: Strategy) => {
    const family = strategy.family || 'Other';
    if (!acc[family]) acc[family] = [];
    acc[family].push(strategy);
    return acc;
  }, {} as Record<string, Strategy[]>) || {};
  
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📋 Strategies</h1>
        <span className="text-gray-500">{strategies?.length || 0} strategies</span>
      </div>
      
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}
      
      <div className="space-y-6">
        {Object.entries(groupedStrategies).map(([family, familyStrategies]) => (
          <div key={family} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">📁 {family}</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Version</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                    <th className="text-right py-3 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {familyStrategies.map((strategy: Strategy) => (
                    <tr 
                      key={strategy.name}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-4 px-6">
                        <span className="font-medium text-gray-900 dark:text-white">{strategy.name}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{strategy.version}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-500 truncate max-w-xs block">
                          {strategy.description || 'No description'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAction(strategy, 'backtest')}
                            disabled={runWorkflow.isPending}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                          >
                            <span>📊</span> Backtest
                          </button>
                          <button
                            onClick={() => handleAction(strategy, 'hyperopt')}
                            disabled={runWorkflow.isPending}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                          >
                            <span>🔍</span> Hyperopt
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      
      {/* Action Modal */}
      {selectedStrategy && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {actionType === 'backtest' ? '📊 Backtest' : '🔍 Hyperopt'} {selectedStrategy.name}
            </h3>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {actionType === 'backtest'
                ? 'Run backtest to evaluate strategy performance across historical data.'
                : 'Run hyperopt to optimize strategy parameters for best performance.'}
            </p>
            
            {actionType === 'hyperopt' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Epochs: <span className="text-blue-600 font-bold">{epochs}</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={epochs}
                  onChange={(e) => setEpochs(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>10</span>
                  <span>100</span>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <button
                onClick={confirmAction}
                disabled={runWorkflow.isPending}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {runWorkflow.isPending ? 'Starting...' : `Run ${actionType === 'backtest' ? 'Backtest' : 'Hyperopt'}`}
              </button>
              <button
                onClick={() => { setSelectedStrategy(null); setActionType(null); }}
                disabled={runWorkflow.isPending}
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
