// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

// Searchable Strategy Selector Component
function StrategySelector({ strategies, selected, onSelect }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  
  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Handle strategies that might not have a name property
  const validStrategies = strategies.filter(s => s && s.name);
  
  const filtered = validStrategies.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );
  
  const selectedName = validStrategies.find(s => s.name === selected)?.name || 'Select a strategy...';
  
  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white cursor-pointer flex justify-between items-center"
      >
        <span className={selected ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
          {selectedName}
        </span>
        <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-hidden">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              placeholder="Search strategies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">{filtered.length} of {validStrategies.length} shown</p>
          </div>
          <div className="overflow-y-auto max-h-64">
            {filtered.map((s, idx) => (
              <div
                key={`${s.name}-${idx}`}
                onClick={() => { onSelect(s.name); setIsOpen(false); setSearch(''); }}
                className={`px-4 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 ${
                  selected === s.name ? 'bg-blue-100 dark:bg-blue-900/50 font-medium' : ''
                }`}
              >
                {s.name}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-2 text-gray-500 text-sm">No matches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const WORKFLOW_STEPS = [
  { id: 'stop_trade', label: 'Stop Trade', icon: '🛑', description: 'Stop trading' },
  { id: 'download_data', label: 'Download Data', icon: '⬇️', description: 'Fetch data' },
  { id: 'backtest', label: 'Backtest', icon: '📊', description: 'Test strategy' },
  { id: 'hyperopt', label: 'Hyperopt', icon: '🔍', description: 'Optimize params' },
  { id: 'extract_best', label: 'Extract Best', icon: '✨', description: 'Get best config' },
  { id: 'restart_trade', label: 'Restart Trade', icon: '🚀', description: 'Deploy' },
];

export function WorkflowControl() {
  const [bots, setBots] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [selectedBot, setSelectedBot] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [config, setConfig] = useState({
    steps: ['backtest', 'hyperopt'],
    epochs: 30,
    auto_promote: true,
    max_drawdown_threshold: 2.0,
  });

  // Load bots and strategies
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    
    fetch(`${API_BASE}/bots`, { headers: { 'Authorization': 'Bearer ' + token }})
      .then(r => r.json())
      .then(data => setBots(data.data || []))
      .catch(console.error);
      
    // Add cache-buster to force fresh data
    fetch(`${API_BASE}/strategy-lab/strategies?_=${Date.now()}`, { 
      headers: { 'Authorization': 'Bearer ' + token },
      cache: 'no-cache'
    })
      .then(r => r.json())
      .then(data => {
        const strategiesList = Array.isArray(data) ? data : (data.data || data.strategies || []);
        console.log('Workflow Control - Strategies loaded:', strategiesList.length);
        console.log('Strategy names:', strategiesList.map(s => s.name).sort());
        setStrategies(strategiesList);
      })
      .catch(err => {
        console.error('Failed to load strategies:', err);
        setStrategies([]);
      });
  }, []);

  // Check status when bot selected
  useEffect(() => {
    if (!selectedBot) return;
    
    const checkStatus = () => {
      const token = localStorage.getItem('access_token');
      fetch(`${API_BASE}/strategy-lab/bots/${selectedBot}/workflow-status`, {
        headers: { 'Authorization': 'Bearer ' + token }
      })
        .then(r => r.json())
        .then(data => setWorkflowStatus(data))
        .catch(() => setWorkflowStatus({ status: 'idle' }));
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [selectedBot]);

  const toggleStep = (stepId) => {
    setConfig(prev => ({
      ...prev,
      steps: prev.steps.includes(stepId)
        ? prev.steps.filter(s => s !== stepId)
        : [...prev.steps, stepId]
    }));
  };

  const startWorkflow = async () => {
    if (!selectedStrategy) {
      setMessage('Please select a strategy first!');
      return;
    }
    setLoading(true);
    setMessage('Starting...');
    try {
      const token = localStorage.getItem('access_token');
      const payload = {
        ...config,
        strategy: selectedStrategy,
        bot_id: selectedBot || null
      };
      const res = await fetch(`${API_BASE}/strategy-lab/workflow/start`, {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setMessage('Workflow started: ' + data.message);
      } else {
        const err = await res.text();
        setMessage('Failed: ' + err);
      }
    } catch (e) {
      setMessage('Error: ' + e.message);
    }
    setLoading(false);
  };

  const stopWorkflow = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      await fetch(`${API_BASE}/strategy-lab/bots/${selectedBot}/workflow/stop`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      setMessage('Stopped');
    } catch (e) {
      setMessage('Error: ' + e.message);
    }
    setLoading(false);
  };

  const isRunning = workflowStatus?.status === 'running';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">⚙️ Workflow Control</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Automate: stop → download → backtest → hyperopt → deploy</p>
        </div>
        <Link to="/strategy-lab" className="text-blue-600 dark:text-blue-400">← Back</Link>
      </div>

      {/* Bot & Strategy Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Bot (for results)</label>
          <select
            value={selectedBot}
            onChange={(e) => setSelectedBot(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">-- Select a bot --</option>
            {bots.map(bot => (
              <option key={bot.id} value={bot.id}>{bot.name}</option>
            ))}
          </select>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Strategy to Optimize <span className="text-blue-600 font-bold">({strategies.length} loaded)</span>
          </label>
          <StrategySelector strategies={strategies} selected={selectedStrategy} onSelect={setSelectedStrategy} />
          {strategies.length === 0 && (
            <p className="text-sm text-red-500 mt-2">⚠️ No strategies loaded. Check console for errors.</p>
          )}
          {/* DEBUG: Show all strategy names */}
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
              Debug: Show all {strategies.length} strategies
            </summary>
            <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded max-h-32 overflow-y-auto">
              {strategies.map(s => s.name).sort().map(name => (
                <div key={name} className={name === 'AlexNexusForgeV78' ? 'text-green-600 font-bold' : 'text-gray-600'}>
                  {name} {name === 'AlexNexusForgeV78' && '✓'}
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>

      {selectedStrategy && (
        <>
          {/* Status & Start/Stop Button */}
          <div className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 p-6 mb-6 ${
            isRunning ? 'border-orange-500' : 'border-green-500'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Status: <span className={isRunning ? 'text-orange-600' : 'text-green-600'}>
                    {workflowStatus?.status || 'idle'}
                  </span>
                </h3>
                {workflowStatus?.current_step && (
                  <p className="text-sm text-gray-500 mt-1">Current: {workflowStatus.current_step}</p>
                )}
                {message && <p className="text-sm text-blue-600 mt-1">{message}</p>}
              </div>
              
              <button
                onClick={isRunning ? stopWorkflow : startWorkflow}
                disabled={loading}
                className={`px-6 py-3 rounded-lg font-medium text-white ${
                  isRunning 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                } disabled:opacity-50`}
              >
                {loading ? '...' : isRunning ? '🛑 Stop' : '▶️ Start Workflow'}
              </button>
            </div>
          </div>

          {/* Steps Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Workflow Steps</h3>
            <div className="space-y-3">
              {WORKFLOW_STEPS.map((step) => {
                const isEnabled = config.steps.includes(step.id);
                return (
                  <label key={step.id} className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isEnabled 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700 opacity-60'
                  }`}>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleStep(step.id)}
                      disabled={isRunning}
                      className="w-5 h-5"
                    />
                    <span className="text-2xl">{step.icon}</span>
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 dark:text-white">{step.label}</span>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{step.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Settings</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Epochs</label>
                <input
                  type="number"
                  value={config.epochs}
                  onChange={(e) => setConfig({...config, epochs: parseInt(e.target.value)})}
                  disabled={isRunning}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Max DD %</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.max_drawdown_threshold}
                  onChange={(e) => setConfig({...config, max_drawdown_threshold: parseFloat(e.target.value)})}
                  disabled={isRunning}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.auto_promote}
                    onChange={(e) => setConfig({...config, auto_promote: e.target.checked})}
                    disabled={isRunning}
                    className="w-5 h-5"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Auto-promote</span>
                </label>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
