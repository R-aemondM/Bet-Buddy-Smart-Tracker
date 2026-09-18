
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ClipboardPaste, X, Edit3, Folder, Globe, Trophy } from 'lucide-react';
import { BetType, Leg, LegStatus, Slip, SlipStatus, Currency, CURRENCY_SYMBOLS } from '../types';

interface NewSlipFormProps {
  initialData?: Slip;
  onSave: (slip: Slip) => void;
  onCancel: () => void;
  currency: Currency;
  availableFolders: string[];
  availableLeagues: string[];
}

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

export const NewSlipForm: React.FC<NewSlipFormProps> = ({ initialData, onSave, onCancel, currency, availableFolders, availableLeagues }) => {
  const [stake, setStake] = useState<string>(() => {
    if (initialData) return initialData.stake.toString();
    const saved = localStorage.getItem('smartbet_draft_stake');
    return saved || '10';
  });
  
  const [totalOdds, setTotalOdds] = useState<string>(() => {
    if (initialData) return initialData.odds.toString();
    const saved = localStorage.getItem('smartbet_draft_odds');
    return saved || '1.00';
  });

  const [folder, setFolder] = useState<string>(() => {
    if (initialData) return initialData.folder || '';
    return '';
  });

  const [legs, setLegs] = useState<Leg[]>(() => {
    if (initialData) return initialData.legs;
    const saved = localStorage.getItem('smartbet_draft_legs');
    if (saved) return JSON.parse(saved);
    return [{
      id: generateId(),
      matchName: '',
      league: '',
      date: new Date().toISOString().split('T')[0],
      type: BetType.MATCH_WINNER,
      selection: 'Home',
      status: LegStatus.PENDING,
    }];
  });

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const symbol = CURRENCY_SYMBOLS[currency];
  const isEditing = !!initialData;

  useEffect(() => {
    if (!isEditing) {
      localStorage.setItem('smartbet_draft_stake', stake);
      localStorage.setItem('smartbet_draft_odds', totalOdds);
      localStorage.setItem('smartbet_draft_legs', JSON.stringify(legs));
    }
  }, [stake, totalOdds, legs, isEditing]);

  const clearDraft = () => {
    localStorage.removeItem('smartbet_draft_stake');
    localStorage.removeItem('smartbet_draft_odds');
    localStorage.removeItem('smartbet_draft_legs');
  };

  const addMatchLeg = () => {
    setLegs([
      ...legs,
      {
        id: generateId(),
        matchName: '',
        league: '',
        date: new Date().toISOString().split('T')[0],
        type: BetType.MATCH_WINNER,
        selection: 'Home',
        status: LegStatus.PENDING,
      }
    ]);
  };

  const addOutrightLeg = () => {
    setLegs([
      ...legs,
      {
        id: generateId(),
        matchName: '',
        league: '',
        date: new Date().toISOString().split('T')[0],
        type: BetType.OUTRIGHT,
        selection: 'Winner',
        status: LegStatus.PENDING,
      }
    ]);
  };

  const addLeg = addMatchLeg;

  const removeLeg = (id: string) => {
    if (legs.length > 1) {
      setLegs(legs.filter(l => l.id !== id));
    }
  };

  const updateLeg = (id: string, field: keyof Leg, value: any) => {
    setLegs(legs.map(l => {
      if (l.id === id) {
        const updated = { ...l, [field]: value };
        if (field === 'type') {
           if (value === BetType.MATCH_WINNER) updated.selection = 'Home';
           if (value === BetType.FIRST_TEAM_TO_SCORE) updated.selection = 'Home';
           if (value === BetType.HALF_TIME_WINNER) updated.selection = 'Home';
           if (value === BetType.HALF_TIME_1ST_CORNER) updated.selection = 'Home';
           if (value === BetType.BTTS) updated.selection = 'Yes';
           if (value === BetType.SENDING_OFF) updated.selection = 'Yes';
           if (value === BetType.OVER_UNDER) updated.selection = 'Over 2.5';
           if (value === BetType.DOUBLE_CHANCE) updated.selection = '1X';
           if (value === BetType.DRAW_NO_BET) updated.selection = 'Home';
           if (value === BetType.WIN_EITHER_HALF) updated.selection = 'Home - Yes/No';
           if (value === BetType.HANDICAP) updated.selection = 'Home (-0.5)';
           if (value === BetType.CORNER_HANDICAP) updated.selection = 'Home (-0.5)';
           if (value === BetType.TOTAL_CORNERS) updated.selection = 'Over 9.5';
           if (value === BetType.CORNER_1X2) updated.selection = 'Home';
           if (value === BetType.WINNING_MARGIN) updated.selection = 'Home By 1';
           if (value === BetType.HALVES_BTTS) updated.selection = 'No/No';
           if (value === BetType.TEAM_TOTAL) updated.selection = 'Home Over 0.5';
           if (value === BetType.TEN_MINS_1X2) updated.selection = 'Home (1-10\')';
           if (value === BetType.MATCH_RESULT_AND_BTTS) updated.selection = 'Home & Yes';
           if (value === BetType.ODD_EVEN) updated.selection = 'Odd';
           if (value === BetType.BOOKINGS) updated.selection = 'Over 3.5';
           if (value === BetType.BOOKINGS_1X2) updated.selection = 'Home';
           if (value === BetType.EXACT_GOALS) updated.selection = '2 Goals';
           if (value === BetType.GOAL_RANGE) updated.selection = '2-3 Goals';
           if (value === BetType.ONE_UP || value === BetType.TWO_UP || value === BetType.THREE_UP) updated.selection = 'Home';
           if (value === BetType.OUTRIGHT) updated.selection = 'Winner';
        }
        return updated;
      }
      return l;
    }));
  };

  const parseTeams = (matchName: string) => {
    const parts = matchName.split(/\s+v\s+|\s+vs\.?\s+|\s+-\s+|\s+–\s+/i);
    return {
      home: parts[0]?.trim() || 'Home',
      away: parts[1]?.trim() || 'Away'
    };
  };

  const handleNumericChange = (value: string, setter: (v: string) => void) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setter(value);
    }
  };

  const handleImport = () => {
    if (!importText.trim()) return;

    try {
      const lines = importText.split('\n').map(l => l.trim()).filter(l => l !== '');
      const newLegs: Leg[] = [];
      let calculatedOdds = 1;
      let i = 0;

      while (i < lines.length) {
        const selectionRaw = lines[i];
        const oddsRaw = lines[i+1];
        const marketRaw = lines[i+2];
        const matchRaw = lines[i+3];

        if (!selectionRaw || !oddsRaw || !marketRaw || !matchRaw) {
          i++; 
          continue;
        }

        const oddsVal = parseFloat(oddsRaw.replace(/[^0-9.]/g, ''));
        if (isNaN(oddsVal)) { i++; continue; }

        // Find the start of the next block dynamically
        let nextI = lines.length;
        for (let k = i + 4; k < lines.length - 3; k++) {
          const possibleOdds = parseFloat(lines[k+1].replace(/[^0-9.]/g, ''));
          const possibleMatch = lines[k+3];
          const hasSeparator = possibleMatch && /\s+v\s+|\s+vs\.?\s+|\s+-\s+|\s+–\s+/i.test(possibleMatch);
          if (!isNaN(possibleOdds) && hasSeparator) {
            nextI = k;
            break;
          }
        }

        let dateRaw = new Date().toISOString().split('T')[0];
        // Scan metadata lines between the current match raw and the start of the next block for dates
        for (let k = i + 4; k < nextI; k++) {
          const metaLine = lines[k];
          if (!metaLine) continue;
          const lowerDT = metaLine.toLowerCase();
          if (lowerDT.includes('today')) {
            dateRaw = new Date().toISOString().split('T')[0];
          } else if (lowerDT.includes('tomorrow')) {
            const d = new Date(); d.setDate(d.getDate() + 1); dateRaw = d.toISOString().split('T')[0];
          } else {
            const match = metaLine.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
            if (match) {
              const d = new Date(`${match[1]} ${match[2]} ${new Date().getFullYear()}`);
              if (!isNaN(d.getTime())) dateRaw = d.toISOString().split('T')[0];
            }
          }
        }

        calculatedOdds *= oddsVal;
        
        // Smart Selection Cleaning
        let selection = selectionRaw.trim();
        const overUnderMatch = selection.match(/(Over|Under)\s*\(?(\d+\.?\d*)\)?/i);
        if (overUnderMatch) {
          selection = `${overUnderMatch[1].charAt(0).toUpperCase() + overUnderMatch[1].slice(1).toLowerCase()} ${overUnderMatch[2]}`;
        } else {
          selection = selection.split(' (')[0].trim(); // Remove suffix comments
        }

        const mUpper = marketRaw.toUpperCase();
        const { home, away } = parseTeams(matchRaw);
        let type = BetType.MATCH_WINNER;

        if (mUpper.includes('FIRST TEAM TO SCORE') || mUpper.includes('FIRST TO SCORE')) {
          type = BetType.FIRST_TEAM_TO_SCORE;
        } else if (mUpper.includes('BOTH TEAMS TO SCORE') || mUpper.includes('BTTS') || mUpper.includes('GG/NG')) {
          type = BetType.BTTS;
        } else if (mUpper.includes('TOTAL') || mUpper.includes('OVER/UNDER') || mUpper.includes('GOALS')) {
          if (mUpper.includes('BOOKING') || mUpper.includes('CARD')) type = BetType.BOOKINGS;
          else if (mUpper.includes('CORNER')) type = BetType.TOTAL_CORNERS;
          else if (mUpper.includes(home.toUpperCase()) || mUpper.includes(away.toUpperCase())) {
            type = BetType.TEAM_TOTAL;
            const chosenTeam = mUpper.includes(home.toUpperCase()) ? 'Home' : 'Away';
            const cleanSel = selection.replace(/^(Over|Under)\s+/i, '');
            selection = `${chosenTeam} ${cleanSel.includes('Over') || cleanSel.includes('Under') ? cleanSel : 'Over ' + cleanSel}`;
          } else {
            type = BetType.OVER_UNDER;
          }
        } else if (mUpper.includes('BOOKING') || mUpper.includes('CARD')) {
          if (mUpper.includes('1X2') || mUpper.includes('RESULT')) type = BetType.BOOKINGS_1X2;
          else type = BetType.BOOKINGS;
        } else if (mUpper.includes('CORNER')) {
          if (mUpper.includes('1X2') || mUpper.includes('RESULT')) type = BetType.CORNER_1X2;
          else if (mUpper.includes('HANDICAP')) type = BetType.CORNER_HANDICAP;
          else type = BetType.TOTAL_CORNERS;
        } else if (mUpper.includes('DOUBLE CHANCE')) type = BetType.DOUBLE_CHANCE;
        else if (mUpper.includes('DRAW NO BET') || mUpper.includes('DNB')) type = BetType.DRAW_NO_BET;
        else if (mUpper.includes('RED CARD') || mUpper.includes('SENDING OFF')) type = BetType.SENDING_OFF;
        else if (mUpper.includes('EXACT GOAL') || mUpper.includes('NUMBER OF GOALS')) type = BetType.EXACT_GOALS;
        else if (mUpper.includes('GOAL RANGE') || mUpper.includes('GOALS RANGE') || mUpper.includes('GOAL INTERVAL')) type = BetType.GOAL_RANGE;
        else if (mUpper.includes('OUTRIGHT') || mUpper.includes('FUTURES') || mUpper.includes('TOURNAMENT') || mUpper.includes('CHAMPION')) type = BetType.OUTRIGHT;

        // Selection Matching for Team Names
        if ([BetType.MATCH_WINNER, BetType.DRAW_NO_BET, BetType.CORNER_1X2, BetType.BOOKINGS_1X2, BetType.FIRST_TEAM_TO_SCORE].includes(type)) {
          const cleanSel = selection.toLowerCase().trim();
          const cleanHome = home.toLowerCase().trim();
          const cleanAway = away.toLowerCase().trim();
          
          if (cleanSel === cleanHome || cleanSel.includes(cleanHome) || cleanHome.includes(cleanSel)) selection = 'Home';
          else if (cleanSel === cleanAway || cleanSel.includes(cleanAway) || cleanAway.includes(cleanSel)) selection = 'Away';
          else if (cleanSel.includes('draw') || cleanSel === 'x') selection = 'Draw';
          else if (cleanSel.includes('none') || cleanSel.includes('no goal') || cleanSel.includes('no score') || cleanSel.includes('neither')) selection = 'No Goal';
        }

        newLegs.push({ id: generateId(), matchName: matchRaw, date: dateRaw, type, selection, status: LegStatus.PENDING });
        i = nextI;
      }

      if (newLegs.length > 0) {
        setLegs(newLegs);
        setTotalOdds(calculatedOdds.toFixed(2));
        setShowImport(false);
        setImportText('');
      } else {
        alert("Couldn't find valid bet selections.");
      }
    } catch (e) {
      alert("Error parsing bet slip.");
    }
  };

  const calculateSlipStatus = (legs: Leg[]): SlipStatus => {
    if (legs.some(l => l.status === LegStatus.LOST)) return SlipStatus.LOST;
    if (legs.some(l => l.status === LegStatus.PENDING)) return SlipStatus.PENDING;
    if (legs.every(l => l.status === LegStatus.VOID)) return SlipStatus.VOID;
    return SlipStatus.WON;
  };

  const handleSave = () => {
    if (legs.length === 0) {
      alert("Please add at least one match or outright selection.");
      return;
    }
    if (legs.some(l => !l.matchName)) {
      alert("Please enter a match or tournament name for all selections.");
      return;
    }
    const numStake = parseFloat(stake) || 0;
    const numOdds = parseFloat(totalOdds) || 1;
    onSave({
      id: initialData ? initialData.id : generateId(),
      createdAt: initialData ? initialData.createdAt : Date.now(),
      legs,
      stake: numStake,
      odds: numOdds,
      potentialReturn: numStake * numOdds,
      status: initialData ? calculateSlipStatus(legs) : SlipStatus.PENDING,
      folder: folder.trim() || undefined
    });
    clearDraft();
  };

  const matchLegs = legs.filter(l => l.type !== BetType.OUTRIGHT);
  const outrightLegs = legs.filter(l => l.type === BetType.OUTRIGHT);

  return (
    <div className="bg-surface rounded-xl shadow-xl border border-borderBase overflow-hidden relative transition-colors">
      <div className="p-6 border-b border-borderBase flex justify-between items-center bg-inputBg">
        <h2 className="text-xl font-bold text-textMain flex items-center gap-2">
          {isEditing ? <Edit3 className="text-primary" /> : <Plus className="text-primary" />} 
          {isEditing ? 'Edit Bet Slip' : 'Create New Bet Slip'}
        </h2>
        <button onClick={() => setShowImport(true)} className="text-xs flex items-center gap-1 bg-surface border border-borderBase hover:bg-background text-textMain px-3 py-1.5 rounded transition-colors">
          <ClipboardPaste size={14} /> Import
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-inputBg/50 p-4 rounded-lg border border-borderBase">
            <label className="text-sm font-medium text-textMain mb-2 flex items-center gap-2"><Folder size={16} className="text-primary" /> Betting Folder</label>
            <input type="text" list="folders-list" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="e.g. Accumulator..." className="w-full bg-surface border border-borderBase rounded px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary" />
            <datalist id="folders-list">{availableFolders.map(f => <option key={f} value={f} />)}</datalist>
            <datalist id="leagues-list">{availableLeagues.map(l => <option key={l} value={l} />)}</datalist>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-textMuted uppercase tracking-wider flex items-center gap-2">
              Match Selections
            </label>
          </div>
          {matchLegs.length === 0 && (
            <p className="text-xs text-textMuted italic py-1">No individual match selections added yet.</p>
          )}
          {matchLegs.map((leg) => {
            const { home, away } = parseTeams(leg.matchName);
            return (
              <div key={leg.id} className="p-4 bg-background rounded-lg border border-borderBase hover:border-textMuted transition-colors space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-5 space-y-1">
                    <label className="text-xs text-textMuted font-bold uppercase">Match Name</label>
                    <input type="text" value={leg.matchName} onChange={(e) => updateLeg(leg.id, 'matchName', e.target.value)} placeholder="e.g. Man City vs Arsenal" className="w-full bg-inputBg border border-borderBase rounded px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-xs text-textMuted font-bold uppercase">League / Competition</label>
                    <input type="text" list="leagues-list" value={leg.league || ''} onChange={(e) => updateLeg(leg.id, 'league', e.target.value)} placeholder="e.g. EPL, UCL..." className="w-full bg-inputBg border border-borderBase rounded px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-xs text-textMuted font-bold uppercase">Date</label>
                    <input type="date" value={leg.date} onChange={(e) => updateLeg(leg.id, 'date', e.target.value)} className="w-full bg-inputBg border border-borderBase rounded px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div className="md:col-span-1 flex items-end justify-center pb-1">
                    <button onClick={() => removeLeg(leg.id)} disabled={legs.length === 1} className="p-2 rounded hover:bg-danger/20 text-danger/80 transition-colors disabled:opacity-30"><Trash2 size={18} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-textMuted font-bold uppercase">Market</label>
                    <select value={leg.type} onChange={(e) => updateLeg(leg.id, 'type', e.target.value)} className="w-full bg-inputBg border border-borderBase rounded px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary">
                      <optgroup label="Outrights">
                        <option value={BetType.OUTRIGHT}>Outrights</option>
                      </optgroup>
                      <optgroup label="Popular">
                        <option value={BetType.MATCH_WINNER}>1X2 (Full Time)</option>
                        <option value={BetType.FIRST_TEAM_TO_SCORE}>First Team To Score</option>
                        <option value={BetType.BTTS}>BTTS</option>
                        <option value={BetType.OVER_UNDER}>Over/Under Goals</option>
                      </optgroup>
                      <optgroup label="Goals">
                        <option value={BetType.TEAM_TOTAL}>Team Totals</option>
                        <option value={BetType.EXACT_GOALS}>Exact Goals</option>
                        <option value={BetType.GOAL_RANGE}>Goal Range</option>
                      </optgroup>
                      <optgroup label="Corners">
                        <option value={BetType.CORNER_1X2}>Corner 1X2</option>
                        <option value={BetType.CORNER_HANDICAP}>Corner Handicap</option>
                        <option value={BetType.TOTAL_CORNERS}>Total Corners (O/U)</option>
                      </optgroup>
                      <optgroup label="Cards & Events">
                        <option value={BetType.SENDING_OFF}>Sending Off (Red Card)</option>
                        <option value={BetType.BOOKINGS_1X2}>Bookings 1X2</option>
                        <option value={BetType.BOOKINGS}>Total Bookings (O/U)</option>
                      </optgroup>
                      <optgroup label="Early Payout">
                        <option value={BetType.ONE_UP}>1 Up Early Payout</option>
                        <option value={BetType.TWO_UP}>2 Up Early Payout</option>
                        <option value={BetType.THREE_UP}>3 Up Early Payout</option>
                      </optgroup>
                      <optgroup label="Halves">
                        <option value={BetType.HALF_TIME_WINNER}>1st Half - 1X2</option>
                        <option value={BetType.HALF_TIME_1ST_CORNER}>1st Half - 1st Corner</option>
                        <option value={BetType.WIN_EITHER_HALF}>Win Either Half</option>
                      </optgroup>
                      <optgroup label="Others">
                        <option value={BetType.ODD_EVEN}>Total Goals - Odd/Even</option>
                        <option value={BetType.MATCH_RESULT_AND_BTTS}>1X2 & Both Teams To Score</option>
                        <option value={BetType.TEN_MINS_1X2}>10 Minutes - 1X2 (1-10')</option>
                        <option value={BetType.HANDICAP}>Handicap (2-Way)</option>
                        <option value={BetType.DOUBLE_CHANCE}>Double Chance</option>
                        <option value={BetType.DRAW_NO_BET}>Draw No Bet</option>
                        <option value={BetType.WINNING_MARGIN}>Winning Margin</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-textMuted font-bold uppercase">Selection</label>
                    {leg.type === BetType.OUTRIGHT ? (
                      <div className="relative">
                        <input
                          type="text"
                          list={`outright-options-${leg.id}`}
                          value={leg.selection}
                          onChange={(e) => updateLeg(leg.id, 'selection', e.target.value)}
                          placeholder="e.g. Arsenal (Winner), Real Madrid, Top 4..."
                          className="w-full bg-inputBg border border-borderBase rounded px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary"
                        />
                        <datalist id={`outright-options-${leg.id}`}>
                          {home && home !== 'Home' && <option value={`${home} (Winner)`} />}
                          {away && away !== 'Away' && <option value={`${away} (Winner)`} />}
                          <option value="Winner / Champion" />
                          <option value="Top 4 Finish" />
                          <option value="To Reach Final" />
                          <option value="To Qualify" />
                          <option value="Relegation" />
                        </datalist>
                      </div>
                    ) : (
                    <select value={leg.selection} onChange={(e) => updateLeg(leg.id, 'selection', e.target.value)} className="w-full bg-inputBg border border-borderBase rounded px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary">
                      {leg.type === BetType.MATCH_WINNER && (
                        <>
                          <option value="Home">Home Win (1)</option>
                          <option value="Draw">Draw (X)</option>
                          <option value="Away">Away Win (2)</option>
                        </>
                      )}
                      {leg.type === BetType.FIRST_TEAM_TO_SCORE && (
                        <>
                          <option value="Home">{home} (Home Team)</option>
                          <option value="Away">{away} (Away Team)</option>
                          <option value="No Goal">No Goal</option>
                        </>
                      )}
                      {leg.type === BetType.HALF_TIME_WINNER && (
                        <>
                          <option value="Home">1st Half Home Win (1)</option>
                          <option value="Draw">1st Half Draw (X)</option>
                          <option value="Away">1st Half Away Win (2)</option>
                        </>
                      )}
                      {leg.type === BetType.HALF_TIME_1ST_CORNER && (
                        <>
                          <option value="Home">{home} (1st Corner)</option>
                          <option value="Away">{away} (1st Corner)</option>
                          <option value="Neither">Neither / No Corners</option>
                        </>
                      )}
                      {([BetType.ONE_UP, BetType.TWO_UP, BetType.THREE_UP].includes(leg.type as BetType)) && (
                        <>
                          <option value="Home">{home} (Home)</option>
                          <option value="Away">{away} (Away)</option>
                        </>
                      )}
                      {leg.type === BetType.BTTS && (
                        <>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </>
                      )}
                      {leg.type === BetType.SENDING_OFF && (
                        <>
                          <option value="Yes">Yes (Red Card Shown)</option>
                          <option value="No">No (No Red Card)</option>
                        </>
                      )}
                      {leg.type === BetType.ODD_EVEN && (
                        <>
                          <option value="Odd">Odd</option>
                          <option value="Even">Even</option>
                        </>
                      )}
                      {leg.type === BetType.CORNER_1X2 && (
                        <>
                          <option value="Home">{home} (Most Corners)</option>
                          <option value="Draw">Draw (Same Corners)</option>
                          <option value="Away">{away} (Most Corners)</option>
                        </>
                      )}
                      {leg.type === BetType.BOOKINGS_1X2 && (
                        <>
                          <option value="Home">{home} (Most Cards)</option>
                          <option value="Draw">Draw (Same Cards)</option>
                          <option value="Away">{away} (Most Cards)</option>
                        </>
                      )}
                      {leg.type === BetType.BOOKINGS && (
                        <>
                          <optgroup label="Over Thresholds">
                            <option value="Over 1.5">Over 1.5</option>
                            <option value="Over 2.5">Over 2.5</option>
                            <option value="Over 3.5">Over 3.5</option>
                            <option value="Over 4.5">Over 4.5</option>
                            <option value="Over 5.5">Over 5.5</option>
                          </optgroup>
                          <optgroup label="Under Thresholds">
                            <option value="Under 1.5">Under 1.5</option>
                            <option value="Under 2.5">Under 2.5</option>
                            <option value="Under 3.5">Under 3.5</option>
                            <option value="Under 4.5">Under 4.5</option>
                            <option value="Under 5.5">Under 5.5</option>
                          </optgroup>
                        </>
                      )}
                      {leg.type === BetType.TOTAL_CORNERS && (
                        <>
                          <optgroup label="Over Thresholds">
                            <option value="Over 7.5">Over 7.5</option>
                            <option value="Over 8.5">Over 8.5</option>
                            <option value="Over 9.5">Over 9.5</option>
                            <option value="Over 10.5">Over 10.5</option>
                            <option value="Over 11.5">Over 11.5</option>
                          </optgroup>
                          <optgroup label="Under Thresholds">
                            <option value="Under 7.5">Under 7.5</option>
                            <option value="Under 8.5">Under 8.5</option>
                            <option value="Under 9.5">Under 9.5</option>
                            <option value="Under 10.5">Under 10.5</option>
                            <option value="Under 11.5">Under 11.5</option>
                          </optgroup>
                        </>
                      )}
                      {leg.type === BetType.MATCH_RESULT_AND_BTTS && (
                        <>
                          <optgroup label={home}>
                            <option value="Home & Yes">Home & Yes</option>
                            <option value="Home & No">Home & No</option>
                          </optgroup>
                          <optgroup label="Draw">
                            <option value="Draw & Yes">Draw & Yes</option>
                            <option value="Draw & No">Draw & No</option>
                          </optgroup>
                          <optgroup label={away}>
                            <option value="Away & Yes">Away & Yes</option>
                            <option value="Away & No">Away & No</option>
                          </optgroup>
                        </>
                      )}
                      {leg.type === BetType.TEN_MINS_1X2 && (
                        <>
                          <option value={`Home (1-10')`}>{home} (1-10')</option>
                          <option value={`Draw (1-10')`}>Draw (1-10')</option>
                          <option value={`Away (1-10')`}>{away} (1-10')</option>
                        </>
                      )}
                      {leg.type === BetType.HANDICAP && (
                        <>
                          <optgroup label={home}>
                            <option value="Home (-3.5)">Home (-3.5)</option>
                            <option value="Home (-2.5)">Home (-2.5)</option>
                            <option value="Home (-1.5)">Home (-1.5)</option>
                            <option value="Home (-0.5)">Home (-0.5)</option>
                            <option value="Home (+0.5)">Home (+0.5)</option>
                            <option value="Home (+1.5)">Home (+1.5)</option>
                            <option value="Home (+2.5)">Home (+2.5)</option>
                            <option value="Home (+3.5)">Home (+3.5)</option>
                          </optgroup>
                          <optgroup label={away}>
                            <option value="Away (-3.5)">Away (-3.5)</option>
                            <option value="Away (-2.5)">Away (-2.5)</option>
                            <option value="Away (-1.5)">Away (-1.5)</option>
                            <option value="Away (-0.5)">Away (-0.5)</option>
                            <option value="Away (+0.5)">Away (+0.5)</option>
                            <option value="Away (+1.5)">Away (+1.5)</option>
                            <option value="Away (+2.5)">Away (+2.5)</option>
                            <option value="Away (+3.5)">Away (+3.5)</option>
                          </optgroup>
                        </>
                      )}
                      {leg.type === BetType.CORNER_HANDICAP && (
                        <>
                          <optgroup label={`${home} Corners`}>
                            <option value="Home (-3.5)">Home (-3.5)</option>
                            <option value="Home (-2.5)">Home (-2.5)</option>
                            <option value="Home (-1.5)">Home (-1.5)</option>
                            <option value="Home (-0.5)">Home (-0.5)</option>
                            <option value="Home (+0.5)">Home (+0.5)</option>
                            <option value="Home (+1.5)">Home (+1.5)</option>
                            <option value="Home (+2.5)">Home (+2.5)</option>
                            <option value="Home (+3.5)">Home (+3.5)</option>
                          </optgroup>
                          <optgroup label={`${away} Corners`}>
                            <option value="Away (-3.5)">Away (-3.5)</option>
                            <option value="Away (-2.5)">Away (-2.5)</option>
                            <option value="Away (-1.5)">Away (-1.5)</option>
                            <option value="Away (-0.5)">Away (-0.5)</option>
                            <option value="Away (+0.5)">Away (+0.5)</option>
                            <option value="Away (+1.5)">Away (+1.5)</option>
                            <option value="Away (+2.5)">Away (+2.5)</option>
                            <option value="Away (+3.5)">Away (+3.5)</option>
                          </optgroup>
                        </>
                      )}
                      {leg.type === BetType.WIN_EITHER_HALF && (
                        <>
                          <optgroup label={home}>
                            <option value="Home - Yes/Yes">Yes/Yes (Win Both)</option>
                            <option value="Home - Yes/No">Yes/No (1st Only)</option>
                            <option value="Home - No/Yes">No/Yes (2nd Only)</option>
                            <option value="Home - No/No">No/No (Win Neither)</option>
                          </optgroup>
                          <optgroup label={away}>
                            <option value="Away - Yes/Yes">Yes/Yes (Win Both)</option>
                            <option value="Away - Yes/No">Yes/No (1st Only)</option>
                            <option value="Away - No/Yes">No/Yes (2nd Only)</option>
                            <option value="Away - No/No">No/No (Win Neither)</option>
                          </optgroup>
                        </>
                      )}
                      {leg.type === BetType.TEAM_TOTAL && (
                        <>
                          <optgroup label={home}>
                            <option value="Home Over 0.5">Over 0.5</option>
                            <option value="Home Under 0.5">Under 0.5</option>
                            <option value="Home Over 1.5">Over 1.5</option>
                            <option value="Home Under 1.5">Under 1.5</option>
                            <option value="Home Over 2.5">Over 2.5</option>
                            <option value="Home Under 2.5">Under 2.5</option>
                          </optgroup>
                          <optgroup label={away}>
                            <option value="Away Over 0.5">Over 0.5</option>
                            <option value="Away Under 0.5">Under 0.5</option>
                            <option value="Away Over 1.5">Over 1.5</option>
                            <option value="Away Under 1.5">Under 1.5</option>
                            <option value="Away Over 2.5">Over 2.5</option>
                            <option value="Away Under 2.5">Under 2.5</option>
                          </optgroup>
                        </>
                      )}
                      {leg.type === BetType.OVER_UNDER && (
                        <>
                          <optgroup label="Over Thresholds">
                            <option value="Over 0.5">Over 0.5</option>
                            <option value="Over 1.5">Over 1.5</option>
                            <option value="Over 2.5">Over 2.5</option>
                            <option value="Over 3.5">Over 3.5</option>
                          </optgroup>
                          <optgroup label="Under Thresholds">
                            <option value="Under 0.5">Under 0.5</option>
                            <option value="Under 1.5">Under 1.5</option>
                            <option value="Under 2.5">Under 2.5</option>
                            <option value="Under 3.5">Under 3.5</option>
                          </optgroup>
                        </>
                      )}
                      {leg.type === BetType.EXACT_GOALS && (
                        <>
                          <option value="0 Goals">0 Goals</option>
                          <option value="1 Goal">1 Goal</option>
                          <option value="2 Goals">2 Goals</option>
                          <option value="3 Goals">3 Goals</option>
                          <option value="4 Goals">4 Goals</option>
                          <option value="5 Goals">5 Goals</option>
                          <option value="6+ Goals">6+ Goals</option>
                        </>
                      )}
                      {leg.type === BetType.GOAL_RANGE && (
                        <>
                          <option value="0-1 Goals">0-1 Goals</option>
                          <option value="1-2 Goals">1-2 Goals</option>
                          <option value="2-3 Goals">2-3 Goals</option>
                          <option value="3-4 Goals">3-4 Goals</option>
                          <option value="4-5 Goals">4-5 Goals</option>
                          <option value="2-4 Goals">2-4 Goals</option>
                          <option value="3-5 Goals">3-5 Goals</option>
                          <option value="5+ Goals">5+ Goals</option>
                        </>
                      )}
                      {!([BetType.MATCH_WINNER, BetType.FIRST_TEAM_TO_SCORE, BetType.HALF_TIME_WINNER, BetType.HALF_TIME_1ST_CORNER, BetType.BTTS, BetType.SENDING_OFF, BetType.TEAM_TOTAL, BetType.OVER_UNDER, BetType.EXACT_GOALS, BetType.GOAL_RANGE, BetType.WIN_EITHER_HALF, BetType.HANDICAP, BetType.CORNER_HANDICAP, BetType.TEN_MINS_1X2, BetType.MATCH_RESULT_AND_BTTS, BetType.ODD_EVEN, BetType.BOOKINGS, BetType.BOOKINGS_1X2, BetType.CORNER_1X2, BetType.TOTAL_CORNERS, BetType.ONE_UP, BetType.TWO_UP, BetType.THREE_UP, BetType.OUTRIGHT].includes(leg.type as BetType)) && (
                        <option value={leg.selection}>{leg.selection}</option>
                      )}
                    </select>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <button type="button" onClick={addMatchLeg} className="w-full py-3 border border-dashed border-borderBase rounded-lg text-textMuted hover:text-textMain hover:bg-inputBg transition-all flex items-center justify-center gap-2"><Plus size={18} /> Add Match</button>
        </div>

        {/* Outrights */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-textMuted uppercase tracking-wider flex items-center gap-2">
              <Trophy size={16} className="text-warning" />
              Outrights
            </label>
          </div>

          {outrightLegs.length === 0 && (
            <p className="text-xs text-textMuted italic py-1">No outright tournament or season selections added yet.</p>
          )}

          {outrightLegs.map((leg) => (
            <div key={leg.id} className="p-4 bg-background rounded-lg border border-borderBase hover:border-warning/50 transition-colors space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5 space-y-1">
                  <label className="text-xs text-textMuted font-bold uppercase">Tournament / Competition</label>
                  <input
                    type="text"
                    value={leg.matchName}
                    onChange={(e) => updateLeg(leg.id, 'matchName', e.target.value)}
                    placeholder="e.g. Premier League 2024/25, Champions League"
                    className="w-full bg-inputBg border border-borderBase rounded px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs text-textMuted font-bold uppercase">Sport / Category</label>
                  <input
                    type="text"
                    list="leagues-list"
                    value={leg.league || ''}
                    onChange={(e) => updateLeg(leg.id, 'league', e.target.value)}
                    placeholder="e.g. Football, Basketball..."
                    className="w-full bg-inputBg border border-borderBase rounded px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs text-textMuted font-bold uppercase">Settlement Date</label>
                  <input
                    type="date"
                    value={leg.date}
                    onChange={(e) => updateLeg(leg.id, 'date', e.target.value)}
                    className="w-full bg-inputBg border border-borderBase rounded px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="md:col-span-1 flex items-end justify-center pb-1">
                  <button
                    type="button"
                    onClick={() => removeLeg(leg.id)}
                    disabled={legs.length === 1}
                    className="p-2 rounded hover:bg-danger/20 text-danger/80 transition-colors disabled:opacity-30"
                    title="Remove Outright"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-textMuted font-bold uppercase">Selection / Backed Outcome</label>
                <div className="relative">
                  <input
                    type="text"
                    list={`outright-options-${leg.id}`}
                    value={leg.selection}
                    onChange={(e) => updateLeg(leg.id, 'selection', e.target.value)}
                    placeholder="e.g. Arsenal (Winner), Real Madrid, Top 4..."
                    className="w-full bg-inputBg border border-borderBase rounded px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary"
                  />
                  <datalist id={`outright-options-${leg.id}`}>
                    <option value="Winner / Champion" />
                    <option value="Top 4 Finish" />
                    <option value="To Reach Final" />
                    <option value="To Qualify" />
                    <option value="Relegation" />
                  </datalist>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addOutrightLeg}
            className="w-full py-3 border border-dashed border-borderBase hover:border-warning/60 rounded-lg text-textMuted hover:text-warning hover:bg-warning/5 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Add Outright
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-borderBase">
           <div className="space-y-1">
              <label className="text-xs font-bold text-textMuted uppercase">Stake ({symbol})</label>
              <input type="text" inputMode="decimal" value={stake} onChange={(e) => handleNumericChange(e.target.value, setStake)} className="w-full bg-inputBg border border-borderBase rounded px-4 py-3 text-textMain font-bold focus:outline-none focus:border-primary" />
           </div>
           <div className="space-y-1">
              <label className="text-xs font-bold text-textMuted uppercase">Total Odds</label>
              <input type="text" inputMode="decimal" value={totalOdds} onChange={(e) => handleNumericChange(e.target.value, setTotalOdds)} className="w-full bg-inputBg border border-borderBase rounded px-4 py-3 text-textMain font-bold focus:outline-none focus:border-primary" />
           </div>
        </div>
        
        <div className="bg-primary/10 rounded-lg p-4 flex justify-between items-center border border-primary/20">
          <span className="text-primary font-medium">Potential Return</span>
          <span className="text-2xl font-bold text-primary">{symbol}{((parseFloat(stake) || 0) * (parseFloat(totalOdds) || 0)).toFixed(2)}</span>
        </div>

        <div className="flex gap-4 justify-end pt-4">
          <button onClick={onCancel} className="px-6 py-3 text-textMuted hover:text-textMain">Cancel</button>
          <button onClick={handleSave} className="px-8 py-3 rounded-lg font-bold bg-primary hover:bg-blue-600 text-white shadow-lg transition-all flex items-center gap-2"><Save size={18} /> Save Bet Slip</button>
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-[60] bg-background/95 flex items-center justify-center p-6 animate-fade-in">
           <div className="w-full max-w-lg bg-surface border border-borderBase rounded-xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-textMain font-bold flex items-center gap-2"><ClipboardPaste size={18} className="text-primary" /> Import Selections</h3>
                 <button onClick={() => setShowImport(false)} className="text-textMuted hover:text-textMain"><X size={20} /></button>
              </div>
              <textarea 
                value={importText} 
                onChange={(e) => setImportText(e.target.value)} 
                placeholder={`Selection (e.g. Over (2.5))\nOdds (e.g. 1.34)\nMarket (e.g. Total (1.5))\nMatch (e.g. Team A - Team B)\nDate (e.g. Today 17:00)`} 
                className="w-full h-64 bg-inputBg border border-borderBase rounded-lg p-4 text-xs font-mono text-textMain focus:outline-none focus:border-primary resize-none" 
              />
              <div className="mt-4 flex justify-end gap-3">
                 <button onClick={() => { setShowImport(false); setImportText(''); }} className="px-4 py-2 text-textMuted font-medium">Cancel</button>
                 <button onClick={handleImport} className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 transition-colors shadow-lg">Import Selections</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
