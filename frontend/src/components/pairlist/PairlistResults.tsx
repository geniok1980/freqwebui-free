import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, BarChart3 } from 'lucide-react';

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
  const { data: resultData, isLoading } = useQuery<JobResult>({
    queryKey: ['pairlist-result', selectedJob],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/pairlist-results/jobs/${selectedJob}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return res.json();
    },
    enabled: !!selectedJob
  });
  
  const formatPercent = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h2 className="text-xl font-bold text-white">Pairlist Results</h2>
        </div>
        
        <div className="flex gap-4">
          <select
            value={selectedStrategy}
            onChange={(e) => { setSelectedStrategy(e.target.value); setSelectedJob(''); }}
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
            {jobsData?.jobs?.map((j: any) => (
              <option key={j.job_id} value={j.job_id}>
                {j.strategy} - {new Date(j.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {isLoading && (
        <div className="text-center py-8 text-gray-400">Loading results...</div>
      )}
      
      {resultData?.summary && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
              <div className="text-gray-400 text-sm">Total Pairs</div>
              <div className="text-2xl font-bold text-white">{resultData.summary.total_pairs}</div>
            </div>
            
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
              <div className="text-gray-400 text-sm">Best Pair</div>
              <div className="text-lg font-bold text-green-400 truncate">{resultData.summary.best_pair}</div>
              <div className="text-sm text-green-500">{formatPercent(resultData.summary.best_profit)}</div>
            </div>
            
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
              <div className="text-gray-400 text-sm">Avg Profit</div>
              <div className={`text-2xl font-bold ${resultData.summary.avg_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPercent(resultData.summary.avg_profit)}
              </div>
            </div>
            
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
              <div className="text-gray-400 text-sm">Avg Win Rate</div>
              <div className="text-2xl font-bold text-blue-400">{resultData.summary.avg_win_rate.toFixed(1)}%</div>
            </div>
          </div>
          
          {/* Top Pairs Table */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#30363d] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-white">Top Performing Pairs</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0f1419]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Rank</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Pair</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Profit</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Win Rate</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Sharpe</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Trades</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363d]">
                  {resultData.pairs?.map((pair) => (
                    <tr key={pair.rank} className="hover:bg-[#0f1419]/50">
                      <td className="px-4 py-3 text-white">#{pair.rank}</td>
                      <td className="px-4 py-3 font-medium text-white">{pair.pair}</td>
                      <td className={`px-4 py-3 text-right ${pair.profit_total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPercent(pair.profit_total)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{pair.win_rate.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-gray-300">{pair.sharpe_ratio.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{pair.trade_count}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-400">{pair.score.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      
      {!selectedJob && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Select a strategy and run to view results</p>
        </div>
      )}
    </div>
  );
}
