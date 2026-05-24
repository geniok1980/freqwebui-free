import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, BarChart3, Download } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

interface PairResult {
  rank: number;
  pair: string;
  profit_total: number;
  win_rate: number;
  max_drawdown: number;
  sharpe_ratio: number;
  trade_count: number;
  score: number;
}

interface JobResult {
  job: {
    job_id: string;
    strategy: string;
    mode: string;
    created_at: string;
  };
  summary: {
    total_pairs: number;
    best_pair: string;
    best_profit: number;
    best_sharpe: number;
    avg_profit: number;
    avg_win_rate: number;
  };
  pairs: PairResult[];
}

export function PairlistResults() {
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [selectedJob, setSelectedJob] = useState('');
  
  // Fetch strategies with results
  const { data: strategiesData } = useQuery({
    queryKey: ['pairlist-strategies'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/pairlist-results/strategies`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return res.json();
    }
  });
  
  // Fetch jobs for selected strategy
  const { data: jobsData } = useQuery({
    queryKey: ['pairlist-jobs', selectedStrategy],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const url = selectedStrategy 
        ? `${API_BASE}/pairlist-results/jobs?strategy=${selectedStrategy}`
        : `${API_BASE}/pairlist-results/jobs`;
      const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return res.json();
    },
    enabled: true
  });
  
  // Fetch detailed results
  const { data: resultData } = useQuery<JobResult>({
    queryKey: ['pairlist-result', selectedJob],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/pairlist-results/jobs/${selectedJob}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return (await res.json()) as JobResult;
    },
    enabled: !!selectedJob
  });
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Pairlist Results
        </h2>
      </div>
      
      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={selectedStrategy}
          onChange={(e) => {
            setSelectedStrategy(e.target.value);
            setSelectedJob('');
          }}
          className="px-4 py-2 bg-[#0f1419] border border-[#30363d] rounded-lg text-white"
        >
          <option value="">All Strategies</option>
          {strategiesData?.strategies?.map((s: string) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        
        <select
          value={selectedJob}
          onChange={(e) => setSelectedJob(e.target.value)}
          className="px-4 py-2 bg-[#0f1419] border border-[#30363d] rounded-lg text-white"
        >
          <option value="">Select Run...</option>
          {jobsData?.jobs?.map((job: any) => (
            <option key={job.job_id} value={job.job_id}>
              {job.strategy} - {new Date(job.created_at).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>
      
      {/* Results Display */}
      {resultData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
              <p className="text-gray-400 text-sm">Total Pairs</p>
              <p className="text-2xl font-bold text-white">{resultData.summary?.total_pairs}</p>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
              <p className="text-gray-400 text-sm">Best Profit</p>
              <p className="text-2xl font-bold text-green-400">
                {resultData.summary?.best_profit?.toFixed(2)}%
              </p>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
              <p className="text-gray-400 text-sm">Best Sharpe</p>
              <p className="text-2xl font-bold text-blue-400">
                {resultData.summary?.best_sharpe?.toFixed(2)}
              </p>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
              <p className="text-gray-400 text-sm">Avg Win Rate</p>
              <p className="text-2xl font-bold text-purple-400">
                {resultData.summary?.avg_win_rate?.toFixed(1)}%
              </p>
            </div>
          </div>
          
          {/* Top Pairs Table */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
              <h3 className="font-medium text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Top Performing Pairs
              </h3>
              <button className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0f1419]">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm text-gray-400">Rank</th>
                    <th className="px-4 py-2 text-left text-sm text-gray-400">Pair</th>
                    <th className="px-4 py-2 text-right text-sm text-gray-400">Profit</th>
                    <th className="px-4 py-2 text-right text-sm text-gray-400">Win Rate</th>
                    <th className="px-4 py-2 text-right text-sm text-gray-400">Sharpe</th>
                    <th className="px-4 py-2 text-right text-sm text-gray-400">Trades</th>
                    <th className="px-4 py-2 text-right text-sm text-gray-400">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {resultData.pairs?.map((pair) => (
                    <tr key={pair.rank} className="border-t border-[#30363d] hover:bg-[#0f1419]">
                      <td className="px-4 py-2 text-white font-medium">#{pair.rank}</td>
                      <td className="px-4 py-2 text-white">{pair.pair}</td>
                      <td className={`px-4 py-2 text-right ${pair.profit_total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pair.profit_total >= 0 ? '+' : ''}{pair.profit_total.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        {pair.win_rate.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        {pair.sharpe_ratio.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        {pair.trade_count}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-blue-400">
                        {pair.score.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
