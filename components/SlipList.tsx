
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Trophy, XCircle, Clock, Check, Pencil, Gavel, Save, X, Ban, Folder, Info, Activity, Trash2, Lock } from 'lucide-react';
import { Slip, SlipStatus, Leg, LegStatus, Currency, CURRENCY_SYMBOLS, formatMarketName } from '../types';
import { validateSlipWithGemini, validateLegsWithGemini } from '../services/geminiService';

export const cleanNotes = (notes: any): string => {
  if (!notes || typeof notes !== 'string') return '';
  let cleaned = notes;
  
  // Clean variations of "the status is pending per run 2" or "the status is pending per rule 2"
  cleaned = cleaned.replace(/the status is pending per rule(s)? \d+/gi, '');
  cleaned = cleaned.replace(/the status is pending per run(s)? \d+/gi, '');
  cleaned = cleaned.replace(/status is pending per rule(s)? \d+/gi, '');
  cleaned = cleaned.replace(/status is pending per run(s)? \d+/gi, '');
  cleaned = cleaned.replace(/the status is pending/gi, '');
  cleaned = cleaned.replace(/status is pending/gi, '');
  
  // Clean leftover prefix/suffix characters & double spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^\s*[\s,.-]+\s*/, '');
  cleaned = cleaned.replace(/\s*[\s,.-]+\s*$/, '');
  
  return cleaned.trim();
};

interface SlipListProps {
  slips: Slip[];
  onUpdateSlip: (updatedSlip: Slip) => void;
  onEditSlip?: (slip: Slip) => void;
  onDeleteSlip?: (slipId: string) => void;
  currency: Currency;
}

export const SlipList: React.FC<SlipListProps> = ({ slips, onUpdateSlip, onEditSlip, onDeleteSlip, currency }) => {
  const symbol = CURRENCY_SYMBOLS[currency];

  if (slips.length === 0) {
    return (
      <div className="text-center py-20 bg-surface rounded-xl border border-borderBase">
        <div className="inline-block p-4 rounded-full bg-inputBg mb-4"><Trophy className="text-textMuted" size={32} /></div>
        <h3 className="text-lg font-medium text-textMain">No bets found</h3>
        <p className="text-textMuted">Create a new bet slip to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {slips.map(slip => (
        <SlipCard key={slip.id} slip={slip} onUpdate={onUpdateSlip} onEdit={onEditSlip} onDelete={onDeleteSlip} symbol={symbol} />
      ))}
    </div>
  );
};

interface SlipCardProps {
  slip: Slip;
  onUpdate: (slip: Slip) => void;
  onEdit?: (slip: Slip) => void;
  onDelete?: (slipId: string) => void;
  symbol: string;
}

const SlipCard: React.FC<SlipCardProps> = ({ slip, onUpdate, onEdit, onDelete, symbol }) => {
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingLegs, setCheckingLegs] = useState<Set<string>>(new Set());
  const [isSettling, setIsSettling] = useState(false);
  const [editedLegs, setEditedLegs] = useState<Leg[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getStatusColor = (status: SlipStatus | LegStatus) => {
    switch (status) {
      case 'WON': return 'text-success bg-success/10 border-success/20';
      case 'LOST': return 'text-danger bg-danger/10 border-danger/20';
      case 'VOID': return 'text-warning bg-warning/10 border-warning/20';
      default: return 'text-textMuted bg-inputBg border-borderBase';
    }
  };

  const getStatusIcon = (status: SlipStatus | LegStatus) => {
    switch (status) {
      case 'WON': return <Check size={16} />;
      case 'LOST': return <XCircle size={16} />;
      case 'PENDING': return <Clock size={16} />;
      case 'VOID': return <Ban size={16} />;
      default: return null;
    }
  };

  const calculateSlipStatus = (legs: Leg[]): SlipStatus => {
    if (legs.some(l => l.status === LegStatus.LOST)) return SlipStatus.LOST;
    if (legs.some(l => l.status === LegStatus.PENDING)) return SlipStatus.PENDING;
    if (legs.every(l => l.status === LegStatus.VOID)) return SlipStatus.VOID;
    return SlipStatus.WON;
  };

  const handleAICheck = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (checking || slip.legs.length === 0) return;
    setChecking(true);
    setErrorMessage(null);
    try {
      const pendingLegs = slip.legs.filter(l => l.status === LegStatus.PENDING);
      if (pendingLegs.length === 0) {
        const newStatus = calculateSlipStatus(slip.legs);
        onUpdate({ ...slip, status: newStatus });
        return;
      }
      const response = await validateLegsWithGemini(pendingLegs);
      const results = Array.isArray(response?.results) ? response.results : [];
      const sources = Array.isArray(response?.sources) ? response.sources : [];
      const updatedLegs = slip.legs.map(leg => {
        const update = results.find(r => r.legId === leg.id);
        if (update) {
          const rawStatus = (update.status || '').toUpperCase().trim();
          let status: LegStatus = LegStatus.PENDING;
          if (rawStatus === 'WON') status = LegStatus.WON;
          else if (rawStatus === 'LOST') status = LegStatus.LOST;
          else if (rawStatus === 'VOID') status = LegStatus.VOID;

          const isCurrentlyConfirmed = leg.status === LegStatus.WON || leg.status === LegStatus.LOST || leg.status === LegStatus.VOID;
          if (isCurrentlyConfirmed && status === LegStatus.PENDING) {
            // Once confirmed/locked, do not return to PENDING
            return leg;
          }

          const safeScore = typeof update.score === 'string' ? update.score : (update.score ? String(update.score) : '');
          const safeReason = typeof (update as any).reason === 'string' ? (update as any).reason : '';
          return { ...leg, status, resultScore: safeScore, notes: cleanNotes(safeReason || leg.notes) };
        }
        return leg;
      });
      const newStatus = calculateSlipStatus(updatedLegs);
      onUpdate({ ...slip, legs: updatedLegs, status: newStatus, groundingUrls: Array.from(new Set([...(slip.groundingUrls || []), ...sources])) });
    } catch (error: any) {
      console.error("AI check error:", error);
      const msg = String(error?.message || error);
      if (msg.includes('leaked') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
        setErrorMessage("API key reported as leaked and revoked by Google. Settle manually or update GEMINI_API_KEY.");
      } else if (msg.includes('configured') || msg.includes('missing') || msg.includes('API key')) {
        setErrorMessage("Gemini API key is not configured. Please settle manually or configure GEMINI_API_KEY.");
      } else if (msg.includes('429') || msg.includes('quota') || msg.includes('exhausted') || msg.includes('LIMIT')) {
        setErrorMessage("Gemini API quota exceeded (429 rate limit). Please settle this slip manually.");
      } else {
        setErrorMessage("Verification failed. Please check connection or settle manually with the Gavel icon.");
      }
    } finally {
      setChecking(false);
    }
  };

  const handleLegAICheck = async (legId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (checkingLegs.has(legId)) return;
    setCheckingLegs(prev => new Set(prev).add(legId));
    setErrorMessage(null);
    try {
      const legToCheck = slip.legs.find(l => l.id === legId);
      if (!legToCheck) return;
      const response = await validateLegsWithGemini([legToCheck]);
      const results = Array.isArray(response?.results) ? response.results : [];
      const sources = Array.isArray(response?.sources) ? response.sources : [];
      const update = results.find(r => r.legId === legId);
      if (update) {
        const rawStatus = (update.status || '').toUpperCase().trim();
        let status: LegStatus = LegStatus.PENDING;
        if (rawStatus === 'WON') status = LegStatus.WON;
        else if (rawStatus === 'LOST') status = LegStatus.LOST;
        else if (rawStatus === 'VOID') status = LegStatus.VOID;

        const isCurrentlyConfirmed = legToCheck.status === LegStatus.WON || legToCheck.status === LegStatus.LOST || legToCheck.status === LegStatus.VOID;
        if (isCurrentlyConfirmed && status === LegStatus.PENDING) {
          // Keep currently confirmed state
          return;
        }

        const safeScore = typeof update.score === 'string' ? update.score : (update.score ? String(update.score) : '');
        const safeReason = typeof (update as any).reason === 'string' ? (update as any).reason : '';
        const updatedLegs = slip.legs.map(l => l.id === legId ? { ...l, status, resultScore: safeScore, notes: cleanNotes(safeReason || l.notes) } : l);
        onUpdate({ ...slip, legs: updatedLegs, status: calculateSlipStatus(updatedLegs), groundingUrls: Array.from(new Set([...(slip.groundingUrls || []), ...sources])) });
      }
    } catch (error: any) {
      console.error("AI leg check error:", error);
      const msg = String(error?.message || error);
      if (msg.includes('leaked') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
        setErrorMessage("API key reported as leaked by Google. Settle manually or update GEMINI_API_KEY.");
      } else if (msg.includes('configured') || msg.includes('missing') || msg.includes('API key')) {
        setErrorMessage("Gemini API key is not configured. Please settle manually.");
      } else if (msg.includes('429') || msg.includes('quota') || msg.includes('exhausted') || msg.includes('LIMIT')) {
        setErrorMessage("Gemini API quota exceeded (429 rate limit). Please settle this leg manually.");
      } else {
        setErrorMessage("Failed to fetch score. Please try again or settle manually.");
      }
    } finally {
      setCheckingLegs(prev => { const next = new Set(prev); next.delete(legId); return next; });
    }
  };

  const startSettling = (e: React.MouseEvent) => { e.stopPropagation(); setEditedLegs([...slip.legs]); setIsSettling(true); setExpanded(true); };
  const cancelSettling = (e: React.MouseEvent) => { e.stopPropagation(); setIsSettling(false); };
  const saveSettlement = (e: React.MouseEvent) => { e.stopPropagation(); const newStatus = calculateSlipStatus(editedLegs); onUpdate({ ...slip, legs: editedLegs, status: newStatus }); setIsSettling(false); };

  const updateLegStatus = (legId: string, status: LegStatus) => {
    setEditedLegs(prev => prev.map(l => l.id === legId ? { ...l, status } : l));
  };
  const updateLegScore = (legId: string, score: string) => setEditedLegs(prev => prev.map(l => l.id === legId ? { ...l, resultScore: score } : l));

  return (
    <div className={`bg-surface rounded-xl border transition-all overflow-hidden ${slip.status === SlipStatus.WON ? 'border-success/30 shadow-success/5' : slip.status === SlipStatus.LOST ? 'border-danger/30' : 'border-borderBase'}`}>
      <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-inputBg transition-colors" onClick={() => !isSettling && setExpanded(!expanded)}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${getStatusColor(slip.status)}`}>{getStatusIcon(slip.status)}</div>
          <div>
             <div className="flex items-center gap-2 flex-wrap">
               <h4 className="font-bold text-textMain text-lg">{slip.legs.length} Match Accumulator</h4>
               {slip.folder && <span className="flex items-center gap-1 text-[10px] font-bold text-textMuted uppercase tracking-wide bg-inputBg border border-borderBase px-2 py-0.5 rounded-full"><Folder size={10} /> {slip.folder}</span>}
               <span className="text-xs text-textMuted font-mono">{new Date(slip.createdAt).toLocaleDateString()}</span>
             </div>
             <p className="text-textMuted text-sm">Stake: <span className="text-textMain font-medium">{symbol}{slip.stake}</span> • Odds: <span className="text-textMain font-medium">{slip.odds}</span> • Return: <span className={`font-bold ${slip.status === 'WON' ? 'text-success' : 'text-primary'}`}>{symbol}{slip.potentialReturn.toFixed(2)}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSettling ? (
            <div className="flex gap-2">
               <button onClick={cancelSettling} className="p-2 rounded-lg bg-surface border border-borderBase text-textMuted hover:text-textMain transition-colors"><X size={18} /></button>
               <button onClick={saveSettlement} className="px-4 py-2 rounded-lg bg-primary text-white font-bold flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-lg"><Save size={18} /> Save</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {slip.status === SlipStatus.PENDING ? (
                <>
                  <button onClick={startSettling} className="p-2 rounded-lg text-textMuted hover:text-primary hover:bg-primary/10 transition-colors" title="Manual Settle"><Gavel size={16} /></button>
                  {slip.legs.some(l => l.status === LegStatus.PENDING) && (
                    <button onClick={handleAICheck} disabled={checking} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${checking ? 'bg-inputBg text-textMuted' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}><RefreshCw size={14} className={checking ? "animate-spin" : ""} />{checking ? 'Checking...' : 'Check'}</button>
                  )}
                  {onEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(slip); }} className="p-2 rounded-lg text-textMuted hover:text-textMain transition-all" title="Edit Slip"><Pencil size={14} /></button>}
                </>
              ) : (
                <>
                  <button onClick={startSettling} className="p-2 rounded-lg text-textMuted hover:text-primary hover:bg-primary/10 transition-colors" title="Manual Settle (Override)"><Gavel size={16} /></button>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-textMuted bg-inputBg border border-borderBase px-2.5 py-1.5 rounded-lg select-none" title="This slip is settled and locked. Click Gavel to manually override.">
                    <Lock size={12} className="text-textMuted/70" /> Locked
                  </span>
                </>
              )}
              {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(slip.id); }} className="p-2 rounded-lg text-textMuted hover:text-danger transition-all" title="Delete Slip"><Trash2 size={14} /></button>}
              <div className="pl-2 border-l border-borderBase ml-2">{expanded ? <ChevronUp className="text-textMuted" size={20} /> : <ChevronDown className="text-textMuted" size={20} />}</div>
            </div>
          )}
        </div>
      </div>
      {errorMessage && (
        <div className="mx-5 mb-4 p-3 rounded-lg border border-danger/30 bg-danger/5 text-xs text-textMain flex items-center justify-between gap-2 animate-fade-in shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-danger shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setErrorMessage(null); }} className="text-textMuted hover:text-textMain shrink-0 cursor-pointer"><X size={14} /></button>
        </div>
      )}
      {expanded && (
        <div className="border-t border-borderBase bg-background/30 p-4">
          <div className="space-y-2">
             {(isSettling ? editedLegs : slip.legs).map((leg) => {
                const scoreStr = typeof leg.resultScore === 'string' ? leg.resultScore : (leg.resultScore ? String(leg.resultScore) : '');
                const isLive = Boolean(scoreStr && !scoreStr.includes('FT') && !scoreStr.includes('PPD'));
                return (
                  <div key={leg.id} className={`flex flex-col md:flex-row md:items-center justify-between p-3 rounded-lg border ${isSettling ? 'bg-surface border-primary/30 shadow-sm' : 'bg-inputBg border-borderBase'}`}>
                    <div className="flex-1 mb-3 md:mb-0">
                        <div className="flex justify-between items-start"><h5 className="text-textMain font-medium">{leg.matchName}</h5>{!isSettling && <span className="text-xs text-textMuted">{leg.date}</span>}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {leg.league && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              {leg.league}
                            </span>
                          )}
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-surface border border-borderBase text-textMuted">{formatMarketName(leg.type)}</span>
                          <span className="text-sm text-primary font-medium">Bet: {leg.selection}</span>
                        </div>
                        {isSettling ? (
                          <div className="mt-3"><label className="text-[10px] uppercase text-textMuted font-bold mb-1 block">Manual Result</label><input type="text" value={leg.resultScore || ''} onChange={(e) => updateLegScore(leg.id, e.target.value)} className="w-full md:w-48 bg-inputBg border border-borderBase rounded px-2 py-1 text-sm text-textMain" /></div>
                        ) : (
                          <div className="flex flex-col gap-1 mt-2">
                            {scoreStr ? (
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isLive ? 'bg-warning/20 text-warning animate-pulse' : 'bg-inputBg text-textMain'}`}>
                                  {isLive && <Activity size={10} className="inline mr-1" />}
                                  {scoreStr}
                                </span>
                              </div>
                            ) : null}
                            {cleanNotes(leg.notes) ? <div className="text-[10px] text-textMuted italic flex items-center gap-1"><Info size={10} className="text-primary" /> {cleanNotes(leg.notes)}</div> : null}
                          </div>
                        )}
                    </div>
                    <div className="ml-0 md:ml-4 flex items-center gap-3">
                        {!isSettling && slip.status === SlipStatus.PENDING && leg.status === LegStatus.PENDING && (
                          <button onClick={(e) => handleLegAICheck(leg.id, e)} disabled={checkingLegs.has(leg.id)} className={`p-1.5 rounded-lg border transition-all ${checkingLegs.has(leg.id) ? 'bg-inputBg text-textMuted' : 'bg-surface hover:text-primary'}`} title="Verify this selection with AI"><RefreshCw size={12} className={checkingLegs.has(leg.id) ? "animate-spin" : ""} /></button>
                        )}
                        {isSettling ? (
                          <div className="flex gap-1 bg-inputBg p-1 rounded-lg border border-borderBase">
                            <button onClick={() => updateLegStatus(leg.id, LegStatus.WON)} className={`p-1.5 rounded ${leg.status === LegStatus.WON ? 'bg-success text-white' : 'text-textMuted'}`} title="Won"><Check size={14} /></button>
                            <button onClick={() => updateLegStatus(leg.id, LegStatus.LOST)} className={`p-1.5 rounded ${leg.status === LegStatus.LOST ? 'bg-danger text-white' : 'text-textMuted'}`} title="Lost"><XCircle size={14} /></button>
                            <button onClick={() => updateLegStatus(leg.id, LegStatus.VOID)} className={`p-1.5 rounded ${leg.status === LegStatus.VOID ? 'bg-warning text-white' : 'text-textMuted'}`} title="Void"><Ban size={14} /></button>
                            <button 
                              onClick={() => updateLegStatus(leg.id, LegStatus.PENDING)} 
                              className={`p-1.5 rounded ${leg.status === LegStatus.PENDING ? 'bg-surface text-textMain' : 'text-textMuted'}`}
                              title="Set as Pending"
                            >
                              <Clock size={14} />
                            </button>
                          </div>
                        ) : <span className={`text-xs font-bold px-2 py-1 rounded border min-w-[70px] text-center ${getStatusColor(leg.status)}`}>{leg.status}</span>}
                    </div>
                  </div>
                );
             })}
          </div>
        </div>
      )}
    </div>
  );
};
