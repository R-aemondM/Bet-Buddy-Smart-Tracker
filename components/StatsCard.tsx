import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Currency, CURRENCY_SYMBOLS } from '../types';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
  currency?: Currency;
  isMoney?: boolean;
}

export const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  color = "text-primary", 
  currency = 'ZAR',
  isMoney = false
}) => {
  const displayValue = isMoney 
    ? `${CURRENCY_SYMBOLS[currency]}${value}` 
    : value;

  return (
    <div className="bg-surface rounded-xl p-6 shadow-lg border border-borderBase transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-textMuted text-sm font-medium uppercase tracking-wider">{title}</h3>
        <div className={`p-2 rounded-lg bg-inputBg ${color}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="flex items-end space-x-2">
        <span className="text-2xl font-bold text-textMain">{displayValue}</span>
      </div>
    </div>
  );
};