
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, PlusCircle, History, Wallet, TrendingUp, Trophy, Settings as SettingsIcon, Sun, Moon, Trash2, X, BarChart3, FolderOpen, Edit2, Check, Plus, Coins, ArrowUpCircle, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { Slip, SlipStatus, Stats, Currency, CURRENCY_SYMBOLS, Leg, LegStatus } from './types';
import { StatsCard } from './components/StatsCard';
import { SlipList, cleanNotes } from './components/SlipList';
import { NewSlipForm } from './components/NewSlipForm';
import { StatisticsPanel } from './components/StatisticsPanel';
import { validateSlipWithGemini, validateLegsWithGemini } from './services/geminiService';

const DEFAULT_LEAGUES = [
  'EPL', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 
  'UCL', 'UEL', 'MLS', 'Eredivisie', 'Championship'
];

const STARTING_BALANCE = 1000;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'active' | 'settled' | 'create' | 'stats'>('dashboard');
  
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  } | null>(null);

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; isDanger?: boolean }
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(null);
      },
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      isDanger: options?.isDanger !== false,
    });
  };

  const [slips, setSlips] = useState<Slip[]>(() => {
    const saved = localStorage.getItem('smartbet_slips');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('smartbet_theme') as 'light' | 'dark') || 'dark';
  });

  const [currency, setCurrency] = useState<Currency>(() => {
    return (localStorage.getItem('smartbet_currency') as Currency) || 'ZAR';
  });

  const [startingBalance, setStartingBalance] = useState<number>(() => {
    const savedStarting = localStorage.getItem('smartbet_starting_balance');
    if (savedStarting !== null) return parseFloat(savedStarting);

    // Migration fallback
    const savedBankroll = localStorage.getItem('smartbet_bankroll');
    if (savedBankroll !== null) {
      const slipsSaved = localStorage.getItem('smartbet_slips');
      const parsedSlips: Slip[] = slipsSaved ? JSON.parse(slipsSaved) : [];
      const wonReturns = parsedSlips
        .filter(s => s.status === SlipStatus.WON)
        .reduce((acc, s) => acc + s.potentialReturn, 0);
      const activeAndSettledStaked = parsedSlips
        .filter(s => s.status !== SlipStatus.VOID)
        .reduce((acc, s) => acc + s.stake, 0);
      
      const val = parseFloat(savedBankroll) - wonReturns + activeAndSettledStaked;
      localStorage.setItem('smartbet_starting_balance', val.toString());
      return val;
    }
    return STARTING_BALANCE;
  });

  const [customLeagues, setCustomLeagues] = useState<string[]>(() => {
    const saved = localStorage.getItem('smartbet_custom_leagues');
    return saved ? JSON.parse(saved) : DEFAULT_LEAGUES;
  });

  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [showSettings, setShowSettings] = useState(false);
  const [editingSlip, setEditingSlip] = useState<Slip | null>(null);
  const [newLeagueInput, setNewLeagueInput] = useState('');
  const [isEditingBalance, setIsEditingBalance] = useState(false);

  const [isAutochecking, setIsAutochecking] = useState(false);
  const [autocheckProgress, setAutocheckProgress] = useState({ current: 0, total: 0 });
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const slipsRef = React.useRef(slips);

  useEffect(() => {
    slipsRef.current = slips;
  }, [slips]);



  const wonReturns = React.useMemo(() => {
    return slips
      .filter(s => s.status === SlipStatus.WON)
      .reduce((acc, s) => acc + s.potentialReturn, 0);
  }, [slips]);

  const activeAndSettledStaked = React.useMemo(() => {
    return slips
      .filter(s => s.status !== SlipStatus.VOID)
      .reduce((acc, s) => acc + s.stake, 0);
  }, [slips]);

  const bankroll = React.useMemo(() => {
    return startingBalance + wonReturns - activeAndSettledStaked;
  }, [startingBalance, wonReturns, activeAndSettledStaked]);

  const [balanceInput, setBalanceInput] = useState(bankroll.toString());

  const [stats, setStats] = useState<Stats>({
    totalSlips: 0, wins: 0, losses: 0, winRate: 0,
    totalStaked: 0, totalReturned: 0, profit: 0, roi: 0
  });

  const uniqueFolders = React.useMemo(() => {
    const folders = new Set<string>();
    slips.forEach(s => { if (s.folder) folders.add(s.folder); });
    return Array.from(folders).sort();
  }, [slips]);

  useEffect(() => { localStorage.setItem('smartbet_slips', JSON.stringify(slips)); }, [slips]);
  
  useEffect(() => {
    localStorage.setItem('smartbet_starting_balance', startingBalance.toString());
  }, [startingBalance]);

  useEffect(() => {
    localStorage.setItem('smartbet_bankroll', bankroll.toString());
    if (!isEditingBalance) setBalanceInput(bankroll.toString());
  }, [bankroll, isEditingBalance]);

  useEffect(() => {
    localStorage.setItem('smartbet_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => { localStorage.setItem('smartbet_currency', currency); }, [currency]);
  useEffect(() => { localStorage.setItem('smartbet_custom_leagues', JSON.stringify(customLeagues)); }, [customLeagues]);

  useEffect(() => {
    const settledSlips = slips.filter(s => s.status === SlipStatus.WON || s.status === SlipStatus.LOST || s.status === SlipStatus.VOID);
    const totalSlips = settledSlips.filter(s => s.status !== SlipStatus.VOID).length;
    const wins = settledSlips.filter(s => s.status === SlipStatus.WON).length;
    const losses = settledSlips.filter(s => s.status === SlipStatus.LOST).length;
    const winRate = totalSlips > 0 ? (wins / totalSlips) * 100 : 0;
    
    const totalStaked = slips.reduce((acc, s) => acc + s.stake, 0);
    const totalReturned = settledSlips.filter(s => s.status === SlipStatus.WON).reduce((acc, s) => acc + s.potentialReturn, 0);
    const voidReturned = settledSlips.filter(s => s.status === SlipStatus.VOID).reduce((acc, s) => acc + s.stake, 0);
    
    const settledStaked = settledSlips.reduce((acc, s) => acc + s.stake, 0);
    const profit = (totalReturned + voidReturned) - settledStaked;
    const roi = (settledStaked - voidReturned) > 0 ? (profit / (settledStaked - voidReturned)) * 100 : 0;

    setStats({ totalSlips, wins, losses, winRate, totalStaked, totalReturned, profit, roi });
  }, [slips]);

  const calculateSlipStatus = (legs: Leg[]): SlipStatus => {
    if (legs.some(l => l.status === LegStatus.LOST)) return SlipStatus.LOST;
    if (legs.some(l => l.status === LegStatus.PENDING)) return SlipStatus.PENDING;
    if (legs.every(l => l.status === LegStatus.VOID)) return SlipStatus.VOID;
    return SlipStatus.WON;
  };

  const triggerAutoCheck = async () => {
    const pendingSlips = slipsRef.current.filter(s => s.status === SlipStatus.PENDING);
    if (pendingSlips.length === 0 || isAutochecking) return;
    
    setIsAutochecking(true);
    setAutocheckProgress({ current: 0, total: pendingSlips.length });
    
    // Gather all legs of all pending slips that are PENDING.
    // Once a leg is settled, it doesn't need validation anymore.
    const allPendingLegs: Leg[] = [];
    const legIdToSlipIdMap = new Map<string, string>();
    
    pendingSlips.forEach(slip => {
      slip.legs.forEach(leg => {
        if (leg.status === LegStatus.PENDING) {
          allPendingLegs.push(leg);
          legIdToSlipIdMap.set(leg.id, slip.id);
        }
      });
    });

    if (allPendingLegs.length === 0) {
      // Recalculate slip statuses directly if there are no pending legs but slips are pending
      setSlips(prevSlips => {
        return prevSlips.map(slip => {
          if (slip.status === SlipStatus.PENDING) {
            const newStatus = calculateSlipStatus(slip.legs);
            if (slip.status !== newStatus) {
              return { ...slip, status: newStatus };
            }
          }
          return slip;
        });
      });
      setIsAutochecking(false);
      return;
    }

    // Batch the pending legs to process them.
    // Batch size of 10 legs minimizes total API roundtrips and prevents rate limit spikes.
    const BATCH_SIZE = 10;
    const legBatches: Leg[][] = [];
    for (let i = 0; i < allPendingLegs.length; i += BATCH_SIZE) {
      legBatches.push(allPendingLegs.slice(i, i + BATCH_SIZE));
    }

    let processedLegsCount = 0;

    for (let b = 0; b < legBatches.length; b++) {
      const batch = legBatches[b];
      
      try {
        const response = await validateLegsWithGemini(batch);
        setGeminiError(null);

        // Update the slips atomically using functional state update
        const batchUpdates = Array.isArray(response?.results) ? response.results : [];
        const batchSources = Array.isArray(response?.sources) ? response.sources : [];

        if (batchUpdates.length > 0) {
          setSlips(prevSlips => {
            return prevSlips.map(slip => {
              // Find if this slip has any leg updates in this batch
              const updatesForThisSlip = batchUpdates.filter(update => {
                const updatedSlipId = legIdToSlipIdMap.get(update.legId);
                return updatedSlipId === slip.id;
              });

              if (updatesForThisSlip.length === 0) {
                return slip; // No changes for this slip in this batch
              }

              // If the slip itself was manually settled/confirmed during execution, do not touch it
              if (slip.status !== SlipStatus.PENDING) {
                return slip;
              }

              let slipLegsUpdated = false;
              const updatedLegs = slip.legs.map(leg => {
                const update = updatesForThisSlip.find(u => u.legId === leg.id);
                if (update) {
                  const rawStatus = (update.status || '').toUpperCase().trim();
                  let status: LegStatus = LegStatus.PENDING;
                  if (rawStatus === 'WON') status = LegStatus.WON;
                  else if (rawStatus === 'LOST') status = LegStatus.LOST;
                  else if (rawStatus === 'VOID') status = LegStatus.VOID;

                  // Once confirmed/locked, do not return to PENDING and do not override existing settled state
                  const isCurrentlyConfirmed = leg.status === LegStatus.WON || leg.status === LegStatus.LOST || leg.status === LegStatus.VOID;
                  if (isCurrentlyConfirmed) {
                    return leg;
                  }

                  const safeScore = typeof update.score === 'string' ? update.score : (update.score ? String(update.score) : '');
                  const safeReason = typeof (update as any).reason === 'string' ? (update as any).reason : '';

                  if (leg.status !== status || leg.resultScore !== safeScore) {
                    slipLegsUpdated = true;
                  }

                  return {
                    ...leg,
                    status,
                    resultScore: safeScore,
                    notes: cleanNotes(safeReason || leg.notes)
                  };
                }
                return leg;
              });

              if (slipLegsUpdated) {
                const newStatus = calculateSlipStatus(updatedLegs);
                return {
                  ...slip,
                  legs: updatedLegs,
                  status: newStatus,
                  groundingUrls: Array.from(new Set([...(slip.groundingUrls || []), ...batchSources]))
                };
              }

              return slip;
            });
          });
        }

      } catch (err: any) {
        const errMsg = String(err?.message || err);
        const isQuota = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('exhausted') || errMsg.includes('RESOURCE_EXHAUSTED');
        const isLeaked = errMsg.includes('leaked') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('403');
        const isInvalidKey = errMsg.includes('invalid') || errMsg.includes('API_KEY_INVALID');
        const isMissingKey = errMsg.includes('configured') || errMsg.includes('missing');

        if (isInvalidKey) {
          console.error(`Autocheck batch failed (invalid key):`, errMsg);
          setGeminiError('invalid_key');
        } else if (isLeaked) {
          console.error(`Autocheck batch failed (leaked key):`, errMsg);
          setGeminiError('leaked_key');
        } else if (isQuota) {
          console.warn(`Autocheck batch suspended due to API quota limit:`, errMsg);
          setGeminiError('quota');
        } else if (isMissingKey) {
          console.error(`Autocheck batch failed (missing key):`, errMsg);
          setGeminiError('missing_key');
        } else {
          console.error(`Autocheck batch failed:`, err);
          setGeminiError('api_error');
        }
        break; // Stop calling more batches once an error is encountered
      }

      processedLegsCount += batch.length;
      const estimatedSlipsCompleted = Math.min(
        pendingSlips.length,
        Math.round((processedLegsCount / allPendingLegs.length) * pendingSlips.length)
      );
      setAutocheckProgress({ current: estimatedSlipsCompleted, total: pendingSlips.length });

      // If we have more batches, wait a safe throttle delay to respect free-tier per-minute rate limits
      if (b < legBatches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3500));
      }
    }
    
    setIsAutochecking(false);
  };



  const handleSaveSlip = (savedSlip: Slip) => {
    const existing = slips.find(s => s.id === savedSlip.id);
    if (existing) {
      setSlips(slips.map(s => s.id === savedSlip.id ? savedSlip : s));
    } else {
      setSlips([savedSlip, ...slips]);
    }
    setEditingSlip(null);
    if (savedSlip.status === SlipStatus.PENDING) {
      setActiveTab('active');
    } else {
      setActiveTab('settled');
    }
  };

  const handleUpdateSlip = (updatedSlip: Slip) => {
    setSlips(slips.map(s => s.id === updatedSlip.id ? updatedSlip : s));
  };

  const handleDeleteSlip = (slipId: string) => {
    const slipToDelete = slips.find(s => s.id === slipId);
    if (!slipToDelete) return;

    triggerConfirm(
      "Delete Bet Slip?",
      "Are you sure you want to delete this bet slip? This action cannot be undone.",
      () => {
        if (slipToDelete.status !== SlipStatus.PENDING) {
          // If the slip is complete (WON, LOST, or VOID), we adjust startingBalance
          // so that the current bankroll value remains unchanged after deletion.
          const oldBankroll = bankroll;
          const updatedSlips = slips.filter(s => s.id !== slipId);
          
          const newWonReturns = updatedSlips
            .filter(s => s.status === SlipStatus.WON)
            .reduce((acc, s) => acc + s.potentialReturn, 0);
            
          const newActiveAndSettledStaked = updatedSlips
            .filter(s => s.status !== SlipStatus.VOID)
            .reduce((acc, s) => acc + s.stake, 0);
            
          const newStartingBalance = oldBankroll - newWonReturns + newActiveAndSettledStaked;
          
          setStartingBalance(newStartingBalance);
          setSlips(updatedSlips);
        } else {
          // If it is pending, we just delete it (refunding the stake naturally)
          setSlips(slips.filter(s => s.id !== slipId));
        }
      },
      { confirmText: "Delete", isDanger: true }
    );
  };
  
  const handleEditSlip = (slip: Slip) => {
    if (slip.status !== SlipStatus.PENDING) {
      alert("This slip is confirmed and locked. It cannot be edited.");
      return;
    }
    setEditingSlip(slip);
    setActiveTab('create');
  };

  const handleResetStats = () => {
    triggerConfirm(
      "Reset All Data?",
      "Are you sure you want to reset all data? This will permanently wipe all your bet slips, statistics, customized leagues, and restore the default virtual balance.",
      () => {
        setSlips([]);
        setStartingBalance(STARTING_BALANCE);
        setCustomLeagues(DEFAULT_LEAGUES);
        setSelectedFolder('All');
        setEditingSlip(null);
        setIsEditingBalance(false);
        setBalanceInput(STARTING_BALANCE.toString());
        
        localStorage.setItem('smartbet_slips', JSON.stringify([]));
        localStorage.setItem('smartbet_starting_balance', STARTING_BALANCE.toString());
        localStorage.setItem('smartbet_bankroll', STARTING_BALANCE.toString());
        localStorage.setItem('smartbet_custom_leagues', JSON.stringify(DEFAULT_LEAGUES));
        
        setShowSettings(false);
      },
      { confirmText: "Reset Everything", isDanger: true }
    );
  };

  const handleSetBalance = () => {
    const val = parseFloat(balanceInput);
    if (!isNaN(val)) {
      const newStarting = val - wonReturns + activeAndSettledStaked;
      setStartingBalance(newStarting);
      setIsEditingBalance(false);
    }
  };

  const handleAddLeague = () => {
    const trimmed = newLeagueInput.trim();
    if (trimmed && !customLeagues.includes(trimmed)) {
      setCustomLeagues([...customLeagues, trimmed]);
      setNewLeagueInput('');
    }
  };

  const handleRemoveLeague = (league: string) => setCustomLeagues(customLeagues.filter(l => l !== league));

  const handleRenameFolder = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    if (uniqueFolders.includes(trimmed)) {
      triggerConfirm(
        "Merge Folders?",
        `A folder named "${trimmed}" already exists. Do you want to merge all bets from "${oldName}" into "${trimmed}"?`,
        () => {
          setSlips(slips.map(s => s.folder === oldName ? { ...s, folder: trimmed } : s));
          if (selectedFolder === oldName) setSelectedFolder(trimmed);
        },
        { confirmText: "Merge", isDanger: false }
      );
    } else {
      setSlips(slips.map(s => s.folder === oldName ? { ...s, folder: trimmed } : s));
      if (selectedFolder === oldName) setSelectedFolder(trimmed);
    }
  };

  const handleDeleteFolder = (folderName: string) => {
    triggerConfirm(
      "Ungroup Folder Bets?",
      `Are you sure you want to ungroup all bets in "${folderName}"? The bets themselves will not be deleted.`,
      () => {
        setSlips(slips.map(s => s.folder === folderName ? { ...s, folder: undefined } : s));
        if (selectedFolder === folderName) setSelectedFolder('All');
      },
      { confirmText: "Ungroup", isDanger: true }
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 transition-colors duration-300">
      <header className="bg-surface border-b border-borderBase sticky top-0 z-50 transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="bg-primary p-1.5 rounded-lg"><TrendingUp className="text-white" size={20} /></div>
             <h1 className="text-xl font-bold text-textMain tracking-tight">SmartBet<span className="text-primary">Tracker</span></h1>
          </div>
          <div className="hidden md:flex items-center gap-1 bg-inputBg p-1 rounded-lg border border-borderBase">
             <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="Overview" />
             <NavButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} icon={Wallet} label="Active" badge={slips.filter(s => s.status === SlipStatus.PENDING).length} />
             <NavButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={BarChart3} label="Analytics" />
             <NavButton active={activeTab === 'settled'} onClick={() => setActiveTab('settled')} icon={History} label="History" />
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-inputBg border border-borderBase px-3 py-1.5 rounded-lg">
              <div className="bg-success/20 text-success p-1 rounded"><Coins size={14} /></div>
              <div className="flex flex-col leading-none">
                <span className="text-[10px] text-textMuted font-bold uppercase">Balance</span>
                <span className="text-sm font-bold text-textMain">{CURRENCY_SYMBOLS[currency]}{bankroll.toFixed(2)}</span>
              </div>
            </div>
            {isAutochecking && (
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-2.5 py-1.5 rounded-lg text-xs font-bold animate-pulse" title={`AI checking pending bets: ${autocheckProgress.current}/${autocheckProgress.total}`}>
                <RefreshCw size={12} className="animate-spin text-primary" />
                <span className="hidden lg:inline">Checking ({autocheckProgress.current}/{autocheckProgress.total})</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg text-textMuted hover:text-textMain hover:bg-inputBg transition-colors"><SettingsIcon size={20} /></button>
              <button onClick={() => { setEditingSlip(null); setActiveTab('create'); }} className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"><PlusCircle size={18} /> <span className="hidden sm:inline">New Bet</span></button>
            </div>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-borderBase rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-borderBase flex justify-between items-center bg-inputBg">
               <h3 className="font-bold text-textMain flex items-center gap-2"><SettingsIcon size={18} className="text-primary" /> Settings</h3>
               <button onClick={() => setShowSettings(false)} className="text-textMuted hover:text-textMain"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
               <div className="space-y-3">
                 <div className="flex justify-between items-center">
                   <span className="text-textMain font-medium flex items-center gap-2"><Wallet size={16} className="text-primary" /> Demo Balance</span>
                   {!isEditingBalance && <button onClick={() => setIsEditingBalance(true)} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider">Edit Manually</button>}
                 </div>
                 {isEditingBalance ? (
                   <div className="flex gap-2 animate-fade-in">
                     <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted font-bold">{CURRENCY_SYMBOLS[currency]}</span>
                        <input type="number" value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)} className="w-full bg-inputBg border border-primary rounded-lg pl-8 pr-3 py-2 text-textMain font-bold focus:outline-none" autoFocus />
                     </div>
                     <button onClick={handleSetBalance} className="bg-primary text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"><Check size={20} /></button>
                     <button onClick={() => setIsEditingBalance(false)} className="bg-inputBg border border-borderBase text-textMuted p-2 rounded-lg hover:text-textMain transition-colors"><X size={20} /></button>
                   </div>
                 ) : (
                   <div className="flex items-center justify-between bg-inputBg p-3 rounded-lg border border-borderBase"><span className="text-lg font-bold text-textMain">{CURRENCY_SYMBOLS[currency]}{bankroll.toFixed(2)}</span></div>
                 )}
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-textMain font-medium">Appearance</span>
                 <div className="flex bg-inputBg rounded-lg p-1 border border-borderBase">
                    <button onClick={() => setTheme('light')} className={`p-2 rounded flex items-center gap-2 text-xs font-bold transition-all ${theme === 'light' ? 'bg-surface shadow text-primary' : 'text-textMuted'}`}><Sun size={14} /> Light</button>
                    <button onClick={() => setTheme('dark')} className={`p-2 rounded flex items-center gap-2 text-xs font-bold transition-all ${theme === 'dark' ? 'bg-surface shadow text-primary' : 'text-textMuted'}`}><Moon size={14} /> Dark</button>
                 </div>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-textMain font-medium">Currency</span>
                 <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="bg-inputBg border border-borderBase rounded-lg px-3 py-1.5 text-textMain text-sm focus:outline-none focus:border-primary">
                   <option value="ZAR">ZAR (R)</option><option value="USD">USD ($)</option><option value="GBP">GBP (£)</option><option value="EUR">EUR (€)</option>
                 </select>
               </div>

               <div className="space-y-3 pt-4 border-t border-borderBase">
                  <span className="text-textMain font-medium flex items-center gap-2"><Trophy size={16} className="text-primary" /> Manage Leagues</span>
                  <div className="flex gap-2">
                    <input type="text" placeholder="e.g. Champions League" value={newLeagueInput} onChange={(e) => setNewLeagueInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddLeague()} className="flex-1 bg-inputBg border border-borderBase rounded-lg px-3 py-2 text-sm text-textMain focus:outline-none focus:border-primary" />
                    <button onClick={handleAddLeague} className="bg-primary text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"><Plus size={20} /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {customLeagues.map(league => (
                      <div key={league} className="flex items-center gap-1 bg-inputBg border border-borderBase px-3 py-1 rounded-full text-xs text-textMain group">{league}<button onClick={() => handleRemoveLeague(league)} className="text-textMuted hover:text-danger ml-1"><X size={12} /></button></div>
                    ))}
                  </div>
               </div>
               <div className="space-y-3 pt-4 border-t border-borderBase">
                  <span className="text-textMain font-medium flex items-center gap-2"><FolderOpen size={16} /> Manage Folders</span>
                  <div className="bg-background/50 rounded-lg border border-borderBase p-2 max-h-48 overflow-y-auto space-y-2">
                    {uniqueFolders.length === 0 ? <p className="text-xs text-textMuted italic text-center py-2">No folders yet.</p> : uniqueFolders.map(folder => <FolderRow key={folder} name={folder} onRename={handleRenameFolder} onDelete={handleDeleteFolder} />)}
                  </div>
               </div>
               <div className="border-t border-borderBase pt-6">
                 <button onClick={handleResetStats} className="w-full py-3 rounded-lg border border-danger/30 text-danger hover:bg-danger hover:text-white transition-all font-bold flex items-center justify-center gap-2"><Trash2 size={18} /> Reset All Data</button>
               </div>
            </div>
          </div>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-borderBase z-40 px-6 py-3 flex justify-between items-center">
        <MobileNavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="Overview" />
        <MobileNavButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} icon={Wallet} label="Active" badge={slips.filter(s => s.status === SlipStatus.PENDING).length} />
        <MobileNavButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={BarChart3} label="Analytics" />
        <MobileNavButton active={activeTab === 'create'} onClick={() => { setEditingSlip(null); setActiveTab('create'); }} icon={PlusCircle} label="New" />
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {geminiError && (
          <div className="mb-6 p-4 rounded-xl border border-warning/30 bg-warning/5 text-textMain flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-warning/15 text-warning shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="font-bold text-textMain">
                  {geminiError === 'quota'
                    ? 'Gemini API Quota Exceeded (429)'
                    : geminiError === 'invalid_key'
                    ? 'Gemini API Key Invalid'
                    : geminiError === 'leaked_key'
                    ? 'Gemini API Key Revoked by Google'
                    : geminiError === 'missing_key'
                    ? 'Gemini API Key Missing'
                    : 'Gemini Verification Service Unavailable'}
                </h4>
                <p className="text-sm text-textMuted mt-0.5 leading-relaxed">
                  {geminiError === 'quota'
                    ? "Your Gemini API free-tier quota is currently exhausted (429 rate limit). Automatic background checks are temporarily paused. You can still settle your bet slips manually using the manual settlement (Gavel) icon on any active slip."
                    : geminiError === 'invalid_key'
                    ? "The configured GEMINI_API_KEY appears to be invalid or incomplete. Please check your key in Google AI Studio and update the environment variable in Netlify."
                    : geminiError === 'leaked_key'
                    ? "Google automatically blocked this Gemini API key because it was exposed in the public code/repository. A fresh GEMINI_API_KEY needs to be generated in Google AI Studio. In the meantime, you can manually settle any bet slip using the Gavel icon."
                    : geminiError === 'missing_key'
                    ? "No GEMINI_API_KEY was found in your deployment environment. You can settle your bet slips manually using the Gavel icon."
                    : "The Gemini verification service is experiencing connection issues. You can click 'Retry' to check again, or manually settle any active bet slip at any time."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <button
                onClick={() => {
                  setGeminiError(null);
                  triggerAutoCheck();
                }}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-blue-600 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={12} /> Retry
              </button>
              <button
                onClick={() => setGeminiError(null)}
                className="px-3 py-1.5 rounded-lg bg-inputBg border border-borderBase text-textMuted hover:text-textMain text-xs font-bold transition-all cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {uniqueFolders.length > 0 && activeTab !== 'create' && (
          <div className="mb-6 overflow-x-auto pb-2 scrollbar-hide">
             <div className="flex gap-2">
               <button onClick={() => setSelectedFolder('All')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${selectedFolder === 'All' ? 'bg-primary text-white border-primary' : 'bg-surface text-textMuted border-borderBase hover:bg-inputBg'}`}>All Bets</button>
               {uniqueFolders.map(folder => (
                 <button key={folder} onClick={() => setSelectedFolder(folder)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border flex items-center gap-2 transition-all ${selectedFolder === folder ? 'bg-primary text-white border-primary' : 'bg-surface text-textMuted border-borderBase hover:bg-inputBg'}`}><FolderOpen size={14} /> {folder}</button>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <StatsCard title="Virtual Balance" value={bankroll.toFixed(2)} isMoney currency={currency} icon={Coins} color="text-success" />
               <StatsCard title="Net Profit" value={stats.profit.toFixed(2)} isMoney currency={currency} icon={Wallet} color={stats.profit >= 0 ? 'text-success' : 'text-danger'} />
               <StatsCard title="Win Rate" value={`${stats.winRate.toFixed(1)}%`} icon={Trophy} color="text-warning" />
               <StatsCard title="ROI" value={`${stats.roi.toFixed(1)}%`} icon={TrendingUp} color={stats.roi >= 0 ? 'text-success' : 'text-danger'} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-textMain flex items-center gap-2"><History className="text-textMuted" size={20} /> Recent Activity</h2></div>
                <SlipList slips={slips.filter(s => selectedFolder === 'All' || s.folder === selectedFolder).slice(0, 5)} onUpdateSlip={handleUpdateSlip} onEditSlip={handleEditSlip} onDeleteSlip={handleDeleteSlip} currency={currency} />
              </div>
              <div className="space-y-6">
                 <div className="bg-surface p-6 rounded-xl border border-borderBase">
                    <h3 className="text-textMain font-bold mb-4">Accuracy</h3>
                    <div className="space-y-4">
                       <div className="flex justify-between text-sm"><span className="text-textMuted">Wins</span><span className="text-success font-bold">{stats.wins}</span></div>
                       <div className="w-full bg-inputBg rounded-full h-2"><div className="bg-success h-2 rounded-full" style={{ width: `${stats.totalSlips ? (stats.wins/stats.totalSlips)*100 : 0}%` }}></div></div>
                       <div className="flex justify-between text-sm"><span className="text-textMuted">Losses</span><span className="text-danger font-bold">{stats.losses}</span></div>
                        <div className="w-full bg-inputBg rounded-full h-2"><div className="bg-danger h-2 rounded-full" style={{ width: `${stats.totalSlips ? (stats.losses/stats.totalSlips)*100 : 0}%` }}></div></div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="max-w-3xl mx-auto animate-fade-in">
             <NewSlipForm initialData={editingSlip || undefined} onSave={handleSaveSlip} onCancel={() => { setEditingSlip(null); setActiveTab('dashboard'); }} currency={currency} availableFolders={uniqueFolders} availableLeagues={customLeagues} />
          </div>
        )}

        {activeTab === 'stats' && <StatisticsPanel slips={slips.filter(s => selectedFolder === 'All' || s.folder === selectedFolder)} currency={currency} startingBalance={startingBalance} />}
        {activeTab === 'active' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-textMain">Active Slips</h2>
              {slips.some(s => s.status === SlipStatus.PENDING) && (
                <button
                  type="button"
                  onClick={triggerAutoCheck}
                  disabled={isAutochecking}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 disabled:opacity-50 transition-all shadow-sm"
                  title="Manually trigger AI check for all pending bet slips"
                >
                  <RefreshCw size={12} className={isAutochecking ? "animate-spin" : ""} />
                  {isAutochecking ? "Checking..." : "Check All"}
                </button>
              )}
            </div>
            <SlipList slips={slips.filter(s => s.status === SlipStatus.PENDING && (selectedFolder === 'All' || s.folder === selectedFolder))} onUpdateSlip={handleUpdateSlip} onEditSlip={handleEditSlip} onDeleteSlip={handleDeleteSlip} currency={currency} />
          </div>
        )}
        {activeTab === 'settled' && <div className="space-y-4 animate-fade-in"><h2 className="text-xl font-bold text-textMain mb-6">History</h2><SlipList slips={slips.filter(s => s.status !== SlipStatus.PENDING && (selectedFolder === 'All' || s.folder === selectedFolder))} onUpdateSlip={handleUpdateSlip} onEditSlip={handleEditSlip} onDeleteSlip={handleDeleteSlip} currency={currency} /></div>}
      </main>

      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[200] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-borderBase rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${confirmDialog.isDanger ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
                <AlertTriangle size={24} />
              </div>
              <h3 className="font-bold text-textMain text-lg">{confirmDialog.title}</h3>
            </div>
            <p className="text-sm text-textMuted leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg bg-inputBg border border-borderBase text-textMuted hover:text-textMain text-sm font-semibold transition-colors"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors ${
                  confirmDialog.isDanger
                    ? 'bg-danger hover:bg-red-600 shadow-lg shadow-red-500/10'
                    : 'bg-primary hover:bg-blue-600 shadow-lg shadow-blue-500/10'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FolderRow = ({ name, onRename, onDelete }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(name);
  const handleSave = () => { if (val.trim() && val.trim() !== name) onRename(name, val); setIsEditing(false); };
  if (isEditing) return <div className="flex gap-2 items-center bg-inputBg p-2 rounded border border-primary"><input className="flex-1 bg-transparent border-none outline-none text-sm text-textMain" value={val} onChange={e => setVal(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setIsEditing(false); setVal(name); }}} /><button onClick={handleSave} className="text-success hover:bg-success/10 p-1 rounded"><Check size={14}/></button><button onClick={() => { setIsEditing(false); setVal(name); }} className="text-danger hover:bg-danger/10 p-1 rounded"><X size={14}/></button></div>;
  return <div className="flex justify-between items-center bg-inputBg p-2 rounded border border-borderBase hover:border-textMuted transition-colors group"><span className="text-sm text-textMain">{name}</span><div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity"><button onClick={() => setIsEditing(true)} className="text-textMuted hover:text-primary p-1"><Edit2 size={14}/></button><button onClick={() => onDelete(name)} className="text-textMuted hover:text-danger p-1"><Trash2 size={14}/></button></div></div>;
};

const NavButton = ({ active, onClick, icon: Icon, label, badge }: any) => <button onClick={onClick} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${active ? 'bg-inputBg text-textMain shadow-sm border border-borderBase' : 'text-textMuted hover:text-textMain hover:bg-inputBg'}`}><Icon size={16} /> {label}{badge > 0 && <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">{badge}</span>}</button>;
const MobileNavButton = ({ active, onClick, icon: Icon, label, badge }: any) => <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-primary' : 'text-textMuted'}`}><div className="relative"><Icon size={24} />{badge > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-surface">{badge}</span>}</div><span className="text-[10px] font-medium">{label}</span></button>;

export default App;
