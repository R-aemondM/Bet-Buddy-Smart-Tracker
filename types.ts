export enum BetType {
  MATCH_WINNER = '1X2',
  FIRST_TEAM_TO_SCORE = 'FIRST_TEAM_TO_SCORE',
  BTTS = 'BTTS',
  OVER_UNDER = 'OVER_UNDER',
  DOUBLE_CHANCE = 'DOUBLE_CHANCE',
  DRAW_NO_BET = 'DRAW_NO_BET',
  TOTAL_CORNERS = 'TOTAL_CORNERS',
  CORNER_1X2 = 'CORNER_1X2',
  CORNER_HANDICAP = 'CORNER_HANDICAP',
  HANDICAP = 'HANDICAP',
  BOOKINGS = 'BOOKINGS',
  BOOKINGS_1X2 = 'BOOKINGS_1X2',
  SENDING_OFF = 'SENDING_OFF',
  EXACT_GOALS = 'EXACT_GOALS',
  GOAL_RANGE = 'GOAL_RANGE',
  ODD_EVEN = 'ODD_EVEN',
  WINNING_MARGIN = 'WINNING_MARGIN',
  TEAM_TOTAL = 'TEAM_TOTAL',
  
  // Halves Markets
  HALF_TIME_WINNER = '1ST_HALF_1X2',
  HALF_TIME_DOUBLE_CHANCE = '1ST_HALF_DC',
  HALF_TIME_BTTS = '1ST_HALF_BTTS',
  HALVES_BTTS = '1ST_2ND_HALF_BTTS', // e.g. Yes/Yes
  HALF_TIME_1ST_GOAL = '1ST_HALF_1ST_GOAL',
  HALF_TIME_1ST_CORNER = '1ST_HALF_1ST_CORNER',
  HALF_TIME_WINNER_AND_BTTS = '1ST_HALF_1X2_BTTS',
  WIN_EITHER_HALF = 'WIN_EITHER_HALF',

  // Time-based Markets
  TEN_MINS_1X2 = '10_MIN_1X2',

  // Combined Markets
  MATCH_RESULT_AND_BTTS = '1X2_BTTS',

  // Early Payout / Up Markets
  ONE_UP = '1UP',
  TWO_UP = '2UP',
  THREE_UP = '3UP',
}

export enum LegStatus {
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST',
  VOID = 'VOID'
}

export enum SlipStatus {
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST',
  VOID = 'VOID'
}

export type Currency = 'USD' | 'GBP' | 'ZAR' | 'EUR';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  GBP: '£',
  ZAR: 'R',
  EUR: '€'
};

export interface Leg {
  id: string;
  matchName: string; // e.g., "Arsenal vs Liverpool"
  league?: string; // e.g. "Premier League"
  date: string; // YYYY-MM-DD
  type: BetType;
  selection: string; // e.g., "Home", "Yes", "Over 2.5", "Home -1.5"
  status: LegStatus;
  resultScore?: string; // e.g., "2-1"
  notes?: string;
}

export interface Slip {
  id: string;
  createdAt: number;
  legs: Leg[];
  stake: number;
  odds: number;
  potentialReturn: number;
  status: SlipStatus;
  groundingUrls?: string[]; // URLs used for verification
  folder?: string; // Category/Folder name
}

export interface ValidationResult {
  legId: string;
  status: LegStatus;
  score: string;
}

export interface Stats {
  totalSlips: number;
  wins: number;
  losses: number;
  winRate: number;
  totalStaked: number;
  totalReturned: number;
  profit: number;
  roi: number;
}

export function formatMarketName(type: string): string {
  if (!type) return '';
  const specificMappings: Record<string, string> = {
    '1X2': '1X2',
    'FIRST_TEAM_TO_SCORE': 'First Team To Score',
    'BTTS': 'Both Teams To Score',
    'OVER_UNDER': 'Over/Under',
    'DOUBLE_CHANCE': 'Double Chance',
    'DRAW_NO_BET': 'Draw No Bet',
    'TOTAL_CORNERS': 'Total Corners',
    'CORNER_1X2': 'Corner 1X2',
    'CORNER_HANDICAP': 'Corner Handicap',
    'HANDICAP': 'Handicap',
    'BOOKINGS': 'Bookings',
    'BOOKINGS_1X2': 'Bookings 1X2',
    'SENDING_OFF': 'Sending Off',
    'EXACT_GOALS': 'Exact Goals',
    'GOAL_RANGE': 'Goal Range',
    'ODD_EVEN': 'Odd/Even',
    'WINNING_MARGIN': 'Winning Margin',
    'TEAM_TOTAL': 'Team Total',
    '1ST_HALF_1X2': '1st Half 1X2',
    '1ST_HALF_DC': '1st Half Double Chance',
    '1ST_HALF_BTTS': '1st Half BTTS',
    '1ST_2ND_HALF_BTTS': '1st & 2nd Half BTTS',
    '1ST_HALF_1ST_GOAL': '1st Half 1st Goal',
    '1ST_HALF_1ST_CORNER': '1st Half 1st Corner',
    '1ST_HALF_1X2_BTTS': '1st Half 1X2 & BTTS',
    'WIN_EITHER_HALF': 'Win Either Half',
    '10_MIN_1X2': '10 Mins 1X2',
    '1X2_BTTS': '1X2 & BTTS',
    '1UP': '1 Up Early Payout',
    '2UP': '2 Up Early Payout',
    '3UP': '3 Up Early Payout',
  };

  const key = type.toUpperCase().trim();
  if (specificMappings[key]) {
    return specificMappings[key];
  }

  // Generic fallback:
  let formatted = type.replace(/OVER_UNDER/gi, 'Over/Under');
  formatted = formatted.replace(/OVERUNDER/gi, 'Over/Under');
  formatted = formatted.replace(/_/g, ' ');
  formatted = formatted.replace(/over under/gi, 'Over/Under');

  return formatted
    .split(' ')
    .map(word => {
      if (word.toUpperCase() === 'BTTS') return 'BTTS';
      if (word.toUpperCase() === '1X2') return '1X2';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/Over\/under/g, 'Over/Under');
}
