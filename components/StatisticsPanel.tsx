import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  PieChart, 
  BarChart3, 
  DollarSign, 
  Activity,
  Percent,
  Globe,
  Folder
} from 'lucide-react';
import { Slip, SlipStatus, LegStatus, BetType, Currency, CURRENCY_SYMBOLS, formatMarketName } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  currencySymbol: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, currencySymbol }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data.status === 'START') {
      return (
        <div className="bg-surface border border-borderBase p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-bold text-textMain">Starting Point</p>
          <p className="text-textMuted">Balance: {currencySymbol}{data.balance.toFixed(2)}</p>
          <p className="text-textMuted">Cumulative P/L: {currencySymbol}0.00</p>
        </div>
      );
    }
    const isProfit = data.slipProfit >= 0;
    const isCumulativeProfit = data.profit >= 0;
    
    return (
      <div className="bg-surface border border-borderBase p-4 rounded-xl shadow-xl space-y-2 max-w-[240px] z-50">
        <div className="flex justify-between items-center gap-4">
          <span className="font-bold text-textMain text-sm">{data.name}</span>
          <span className="text-[10px] text-textMuted font-mono">{data.date}</span>
        </div>
        <div className="border-t border-borderBase pt-2 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-textMuted">Folder:</span>
            <span className="font-medium text-textMain truncate max-w-[120px]">{data.folder}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-textMuted">Status:</span>
            <span className={`font-bold ${
              data.status === 'WON' ? 'text-success' : 
              data.status === 'LOST' ? 'text-danger' : 
              'text-textMuted'
            }`}>{data.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-textMuted">Stake / Odds:</span>
            <span className="font-mono text-textMain">{currencySymbol}{data.stake} @ {data.odds.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-borderBase/50 pt-1.5">
            <span className="text-textMuted">Slip P/L:</span>
            <span className={`font-mono font-bold ${isProfit ? 'text-success' : 'text-danger'}`}>
              {isProfit ? '+' : ''}{currencySymbol}{data.slipProfit.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between border-t border-borderBase/50 pt-1.5">
            <span className="text-textMuted">Balance:</span>
            <span className="font-mono text-textMain font-semibold">{currencySymbol}{data.balance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-borderBase pt-1 mt-1">
            <span className="text-textMuted">Cumulative P/L:</span>
            <span className={`font-mono font-bold ${isCumulativeProfit ? 'text-success' : 'text-danger'}`}>
              {isCumulativeProfit ? '+' : ''}{currencySymbol}{data.profit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface StatisticsPanelProps {
  slips: Slip[];
  currency: Currency;
  startingBalance?: number;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ slips, currency, startingBalance = 1000 }) => {
  const symbol = CURRENCY_SYMBOLS[currency];

  const stats = useMemo(() => {
    const settledSlips = slips.filter(s => s.status === SlipStatus.WON || s.status === SlipStatus.LOST);
    const settledLegs = settledSlips.flatMap(s => s.legs).filter(l => l.status === LegStatus.WON || l.status === LegStatus.LOST);
    
    // Financials
    const totalStaked = slips.reduce((acc, s) => acc + s.stake, 0);
    const totalReturned = settledSlips
      .filter(s => s.status === SlipStatus.WON)
      .reduce((acc, s) => acc + s.potentialReturn, 0);
    const settledStaked = settledSlips.reduce((acc, s) => acc + s.stake, 0);
    const profit = totalReturned - settledStaked;
    const roi = settledStaked > 0 ? (profit / settledStaked) * 100 : 0;
    
    // Slip Stats
    const totalSettledCount = settledSlips.length;
    const wins = settledSlips.filter(s => s.status === SlipStatus.WON).length;
    const winRate = totalSettledCount > 0 ? (wins / totalSettledCount) * 100 : 0;
    const avgOdds = totalSettledCount > 0 
      ? settledSlips.reduce((acc, s) => acc + s.odds, 0) / totalSettledCount 
      : 0;

    // Market Performance (Leg based)
    const marketStats: Record<string, { total: number; wins: number }> = {};
    
    Object.values(BetType).forEach(type => {
      marketStats[type] = { total: 0, wins: 0 };
    });

    settledLegs.forEach(leg => {
      if (!marketStats[leg.type]) marketStats[leg.type] = { total: 0, wins: 0 };
      marketStats[leg.type].total += 1;
      if (leg.status === LegStatus.WON) {
        marketStats[leg.type].wins += 1;
      }
    });

    // League Performance (Leg based)
    const leagueStats: Record<string, { total: number; wins: number }> = {};

    settledLegs.forEach(leg => {
      const leagueKey = leg.league ? leg.league.trim() : 'Unspecified';
      if (!leagueStats[leagueKey]) leagueStats[leagueKey] = { total: 0, wins: 0 };
      leagueStats[leagueKey].total += 1;
      if (leg.status === LegStatus.WON) {
        leagueStats[leagueKey].wins += 1;
      }
    });

    const activeLeagues = Object.entries(leagueStats)
      .map(([name, data]) => ({
        name,
        total: data.total,
        wins: data.wins,
        rate: (data.wins / data.total) * 100
      }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total); // Sort by accuracy rate first, then by volume

    // Folder Performance (Slip based)
    const folderStats: Record<string, { totalSlips: number; wins: number; totalStaked: number; totalReturned: number; profit: number }> = {};

    settledSlips.forEach(s => {
      const folderKey = s.folder && s.folder.trim() ? s.folder.trim() : 'General';
      if (!folderStats[folderKey]) {
        folderStats[folderKey] = { totalSlips: 0, wins: 0, totalStaked: 0, totalReturned: 0, profit: 0 };
      }
      folderStats[folderKey].totalSlips += 1;
      folderStats[folderKey].totalStaked += s.stake;
      if (s.status === SlipStatus.WON) {
        folderStats[folderKey].wins += 1;
        folderStats[folderKey].totalReturned += s.potentialReturn;
      }
      folderStats[folderKey].profit = folderStats[folderKey].totalReturned - folderStats[folderKey].totalStaked;
    });

    const activeFolders = Object.entries(folderStats)
      .map(([name, data]) => ({
        name,
        totalSlips: data.totalSlips,
        wins: data.wins,
        totalStaked: data.totalStaked,
        totalReturned: data.totalReturned,
        profit: data.profit,
        winRate: data.totalSlips > 0 ? (data.wins / data.totalSlips) * 100 : 0,
        roi: data.totalStaked > 0 ? (data.profit / data.totalStaked) * 100 : 0
      }))
      .sort((a, b) => b.profit - a.profit || b.winRate - a.winRate || b.totalSlips - a.totalSlips);

    // Filter out markets with no bets
    const activeMarkets = Object.entries(marketStats)
      .filter(([_, data]) => data.total > 0)
      .map(([type, data]) => ({
        type,
        total: data.total,
        wins: data.wins,
        rate: (data.wins / data.total) * 100
      }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total); // Sort by accuracy rate first, then by volume

    // Recent Form (Last 10 settled)
    const form = settledSlips
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10)
      .map(s => s.status);

    // Chronological progression for graph (oldest to newest)
    const chronologicalSlips = [...settledSlips]
      .sort((a, b) => a.createdAt - b.createdAt);

    let cumulativeProfit = 0;
    const chartData = [
      { name: 'Start', date: 'Initial', balance: Number(startingBalance.toFixed(2)), profit: 0, slipProfit: 0, stake: 0, odds: 0, status: 'START', folder: 'General' },
      ...chronologicalSlips.map((s, index) => {
        let slipProfit = 0;
        if (s.status === SlipStatus.WON) {
          slipProfit = s.potentialReturn - s.stake;
        } else if (s.status === SlipStatus.LOST) {
          slipProfit = -s.stake;
        } else if (s.status === SlipStatus.VOID) {
          slipProfit = 0;
        }
        cumulativeProfit += slipProfit;
        
        const dateStr = new Date(s.createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric'
        });

        return {
          name: `Bet #${index + 1}`,
          date: dateStr,
          balance: Number((startingBalance + cumulativeProfit).toFixed(2)),
          profit: Number(cumulativeProfit.toFixed(2)),
          slipProfit: Number(slipProfit.toFixed(2)),
          stake: s.stake,
          odds: s.odds,
          status: s.status,
          folder: s.folder || 'General'
        };
      })
    ];

    return {
      totalStaked,
      profit,
      roi,
      winRate,
      avgOdds,
      activeMarkets,
      activeLeagues,
      activeFolders,
      form,
      totalSettledCount,
      chartData
    };
  }, [slips, startingBalance]);

  if (stats.totalSettledCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-xl border border-borderBase text-center">
        <div className="p-4 rounded-full bg-inputBg mb-4">
          <BarChart3 className="text-textMuted" size={32} />
        </div>
        <h3 className="text-xl font-bold text-textMain">No Statistics Available</h3>
        <p className="text-textMuted max-w-sm mt-2">
          Start betting and settling your slips to see detailed performance analytics here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Key Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Net Profit" 
          value={`${symbol}${stats.profit.toFixed(2)}`} 
          subValue={`${stats.roi.toFixed(1)}% ROI`}
          icon={DollarSign}
          positive={stats.profit >= 0}
        />
        <StatCard 
          label="Win Rate" 
          value={`${stats.winRate.toFixed(1)}%`} 
          subValue={`${stats.activeMarkets.reduce((acc, m) => acc + m.wins, 0)} legs won`}
          icon={Target}
          color="text-blue-500"
        />
        <StatCard 
          label="Turnover" 
          value={`${symbol}${stats.totalStaked.toFixed(2)}`} 
          subValue="Total Staked"
          icon={Activity}
          color="text-purple-500"
        />
        <StatCard 
          label="Avg. Odds" 
          value={stats.avgOdds.toFixed(2)} 
          subValue="Per Slip"
          icon={Percent}
          color="text-orange-500"
        />
      </div>

      {/* Profit & Loss Performance Curve */}
      <div className="bg-surface rounded-xl border border-borderBase p-6">
        <h3 className="text-lg font-bold text-textMain mb-2 flex items-center gap-2">
          <TrendingUp size={20} className="text-primary" /> Profit & Loss Performance Curve
        </h3>
        <p className="text-xs text-textMuted mb-6">
          Track your cumulative net return progression across all settled bet slips.
        </p>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={stats.chartData}
              margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
            >
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey="name" 
                stroke="#94a3b8" 
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#94a3b8" 
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${symbol}${value}`}
              />
              <Tooltip 
                content={<CustomTooltip currencySymbol={symbol} />}
                cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <ReferenceLine y={startingBalance} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} />
              <Line
                type="monotone"
                dataKey="balance"
                stroke={stats.profit >= 0 ? "#10b981" : "#ef4444"}
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 1, fill: "#1e293b" }}
                activeDot={{ r: 6, strokeWidth: 0, fill: stats.profit >= 0 ? "#10b981" : "#ef4444" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Folder Performance */}
        <div className="bg-surface rounded-xl border border-borderBase p-6">
          <h3 className="text-lg font-bold text-textMain mb-6 flex items-center gap-2">
            <Folder size={20} className="text-textMuted" /> Folder Performance
          </h3>
          <div className="space-y-6 max-h-[300px] overflow-y-auto pr-2">
            {stats.activeFolders.map((folder, idx) => (
              <div key={folder.name} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                    <span className="font-medium text-textMain truncate">{folder.name}</span>
                    {idx === 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase">Best</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-textMuted text-xs">{folder.wins}/{folder.totalSlips} Won</span>
                    <span className={`font-bold font-mono text-xs ${folder.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                      {folder.profit >= 0 ? '+' : ''}{symbol}{folder.profit.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-inputBg rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${folder.winRate >= 50 ? 'bg-success' : 'bg-danger'}`}
                    style={{ width: `${Math.max(folder.winRate, 5)}%` }}
                  />
                </div>
              </div>
            ))}
            {stats.activeFolders.length === 0 && (
              <p className="text-sm text-textMuted italic">No folder data available yet.</p>
            )}
          </div>
        </div>

        {/* Market Performance */}
        <div className="bg-surface rounded-xl border border-borderBase p-6">
          <h3 className="text-lg font-bold text-textMain mb-6 flex items-center gap-2">
            <PieChart size={20} className="text-textMuted" /> Market Accuracy
          </h3>
          <div className="space-y-6 max-h-[300px] overflow-y-auto pr-2">
            {stats.activeMarkets.map((market) => (
              <div key={market.type} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-textMain">{formatMarketName(market.type)}</span>
                  <div className="flex gap-4">
                    <span className="text-textMuted text-xs">{market.wins}/{market.total} Won</span>
                    <span className={`font-bold ${market.rate >= 50 ? 'text-success' : 'text-danger'}`}>
                      {market.rate.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-inputBg rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${market.rate >= 50 ? 'bg-success' : 'bg-danger'}`}
                    style={{ width: `${market.rate}%` }}
                  />
                </div>
              </div>
            ))}
            {stats.activeMarkets.length === 0 && (
                <p className="text-sm text-textMuted italic">No market data available yet.</p>
            )}
          </div>
        </div>
        
        {/* League Performance */}
        <div className="bg-surface rounded-xl border border-borderBase p-6">
          <h3 className="text-lg font-bold text-textMain mb-6 flex items-center gap-2">
            <Globe size={20} className="text-textMuted" /> League Accuracy
          </h3>
          <div className="space-y-6 max-h-[300px] overflow-y-auto pr-2">
            {stats.activeLeagues.map((league) => (
              <div key={league.name} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-textMain truncate max-w-[150px]">{league.name}</span>
                  <div className="flex gap-4">
                    <span className="text-textMuted text-xs">{league.wins}/{league.total} Won</span>
                    <span className={`font-bold ${league.rate >= 50 ? 'text-success' : 'text-danger'}`}>
                      {league.rate.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-inputBg rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${league.rate >= 50 ? 'bg-success' : 'bg-danger'}`}
                    style={{ width: `${league.rate}%` }}
                  />
                </div>
              </div>
            ))}
            {stats.activeLeagues.length === 0 && (
                <p className="text-sm text-textMuted italic">No league data available yet.</p>
            )}
          </div>
        </div>

        {/* Recent Form */}
        <div className="bg-surface rounded-xl border border-borderBase p-6">
          <h3 className="text-lg font-bold text-textMain mb-6 flex items-center gap-2">
            <Activity size={20} className="text-textMuted" /> Recent Form
          </h3>
          
          <div className="flex flex-wrap gap-2 mb-6">
            {stats.form.map((status, idx) => (
              <div 
                key={idx}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                  status === SlipStatus.WON ? 'bg-success text-white border-success' :
                  status === SlipStatus.LOST ? 'bg-danger text-white border-danger' :
                  'bg-inputBg text-textMuted border-borderBase'
                }`}
                title={status}
              >
                {status === SlipStatus.WON ? 'W' : status === SlipStatus.LOST ? 'L' : 'V'}
              </div>
            ))}
          </div>

          <div className="p-4 bg-inputBg rounded-lg border border-borderBase space-y-3">
            <h4 className="text-sm font-medium text-textMuted">Insights</h4>
            {stats.profit >= 0 ? (
              <p className="text-sm text-textMain">
                You are currently <span className="text-success font-bold">Profitable</span>. 
                Your best performing market is <span className="font-bold">{stats.activeMarkets[0] ? formatMarketName(stats.activeMarkets[0].type) : 'N/A'}</span>.
              </p>
            ) : (
              <p className="text-sm text-textMain">
                You are currently <span className="text-danger font-bold">Down</span>. 
                Consider reviewing your strategy on <span className="font-bold">{stats.activeMarkets[stats.activeMarkets.length - 1] ? formatMarketName(stats.activeMarkets[stats.activeMarkets.length - 1].type) : 'N/A'}</span> bets.
              </p>
            )}
            {stats.activeFolders.length > 0 && (
              <p className="text-sm text-textMain border-t border-borderBase/50 pt-2">
                📁 Your best performing betting folder is <span className="font-bold">{stats.activeFolders[0].name}</span> with <span className={`font-bold ${stats.activeFolders[0].profit >= 0 ? 'text-success' : 'text-danger'}`}>{stats.activeFolders[0].profit >= 0 ? '+' : ''}{symbol}{stats.activeFolders[0].profit.toFixed(2)}</span> profit ({stats.activeFolders[0].winRate.toFixed(0)}% win rate).
              </p>
            )}
            {stats.activeLeagues.length > 0 && (
              <p className="text-sm text-textMain border-t border-borderBase/50 pt-2">
                🏆 Your best performing league is <span className="font-bold">{stats.activeLeagues[0].name}</span> with a <span className="text-success font-bold">{stats.activeLeagues[0].rate.toFixed(0)}%</span> win rate ({stats.activeLeagues[0].wins}/{stats.activeLeagues[0].total} legs won).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Internal Helper for Cards
const StatCard = ({ label, value, subValue, icon: Icon, positive, color }: any) => {
  const textColor = positive === true ? 'text-success' : positive === false ? 'text-danger' : color || 'text-textMain';
  
  return (
    <div className="bg-surface p-6 rounded-xl border border-borderBase shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <span className="text-textMuted text-xs font-bold uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg bg-inputBg ${color || (positive === true ? 'text-success' : positive === false ? 'text-danger' : 'text-textMuted')}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="flex flex-col">
        <span className={`text-2xl font-bold ${textColor}`}>{value}</span>
        <span className="text-xs text-textMuted mt-1">{subValue}</span>
      </div>
    </div>
  );
};
