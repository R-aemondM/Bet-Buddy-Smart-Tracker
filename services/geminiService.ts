import { GoogleGenAI } from "@google/genai";
import { Slip, Leg, LegStatus, ValidationResult } from "../types";

let aiClient: GoogleGenAI | null = null;

const getAiClient = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = (typeof process !== 'undefined' && process.env) 
      ? (process.env.API_KEY || process.env.GEMINI_API_KEY || '') 
      : '';
    if (!apiKey) {
      throw new Error("Gemini API key is not configured. Please set GEMINI_API_KEY.");
    }
    aiClient = new GoogleGenAI({ 
      apiKey
    });
  }
  return aiClient;
};

export interface ValidationResponse {
  results: ValidationResult[];
  sources: string[];
}

/**
 * Validates arbitrary legs using Gemini 3 Flash.
 * Enforces strict settlement only for finished matches.
 */
export const validateLegsWithGemini = async (legs: Leg[]): Promise<ValidationResponse> => {
  const ai = getAiClient();

  const legsDescription = legs.map(leg => {
    const parts = leg.matchName.split(/\s+v\s+|\s+vs\.?\s+|\s+-\s+/i);
    const home = parts[0]?.trim() || 'Home';
    const away = parts[1]?.trim() || 'Away';
    
    return `ID:${leg.id}|Match:${home} vs ${away}|Date:${leg.date}|Market:${leg.type}|Selection:${leg.selection}`;
  }).join('\n');

  const prompt = `
    Find current scores and match statuses for these sports matches.
    
    CRITICAL SETTLEMENT RULES:
    1. ONLY return status "WON" or "LOST" if the match is officially FINISHED (FT / Full Time). EXCEPT for cases where the outcome is already mathematically guaranteed or meets special payout rules, even if the match is currently LIVE (e.g., HT, 70th minute, etc.):
       - FIRST_TEAM_TO_SCORE: Can be settled immediately as "WON" or "LOST" once any team scores a goal in the match. If the match ends (FT) and no goals are scored (0-0), it is settled as "No Goal". If no goal has been scored yet and the match is still LIVE or NOT STARTED, it must remain "PENDING".
       - 1ST_HALF_1X2 (HALF_TIME_WINNER): Can be settled as "WON" or "LOST" immediately once the match reaches Half Time (HT) or is in the second half/finished, since the first half is completed and the half-time score is final.
       - 1ST_HALF_1ST_CORNER (HALF_TIME_1ST_CORNER): Can be settled immediately as "WON" or "LOST" once a corner kick is awarded in the first half (deciding which team got the first corner of the game). If the first half is finished (HT, FT, etc.) and no corners were taken in the first half, it is settled as "Neither". Otherwise, if no corner has been taken yet and the match is in the first half, it must remain "PENDING".
       - EARLY PAYOUT (ONE_UP, TWO_UP, or THREE_UP): Must be settled as "WON" immediately if the backed team meets the early payout threshold (goes 1, 2, or 3 goals ahead respectively) at any point in the match, even if it is currently LIVE.
       - BTTS (Both Teams to Score): If the selection is "Yes" and both teams have already scored (e.g., current live score is 1-1, 2-1, etc.), the selection is already "WON" immediately. If the selection is "No" and both teams have scored, it is already "LOST" immediately.
       - OVER / UNDER markets (OVER_UNDER, TOTAL_CORNERS, BOOKINGS, etc.):
         * If the selection is "Over X" (e.g. "Over 2.5 goals", "Over 8.5 corners", "Over 3.5 bookings") and the current tally has already exceeded that value (e.g., 3 goals, 9 corners, 4 bookings), it is "WON" immediately.
         * If the selection is "Under X" and the current tally has already exceeded that value, it is "LOST" immediately.
         * Conversely, if the selection is "Under X" and the current tally has NOT exceeded that value, it MUST remain "PENDING" until Full Time, because more goals/corners/bookings could still occur.
       - SENDING_OFF (Red Card): If the selection is "Yes" and a red card has already been shown in the match, it is "WON" immediately.
    2. If the match is LIVE (e.g. 35th minute), or NOT STARTED, the status MUST be "PENDING", unless one of the guaranteed live settlement conditions above has been satisfied.
    3. If the match is POSTPONED or CANCELLED, status is "VOID".
    4. NEVER reference rules, rule numbers (like "rule 1"), or phrasing like "per rule" in the reason. Keep reasons natural, descriptive, and focused on the real-world match events/scores (e.g., "Match is live 2-1; both teams have scored, making BTTS Yes a win").
    5. Market Verification Logic:
       - 1X2: Result at FT.
       - FIRST_TEAM_TO_SCORE: Settle based on which team scored the first goal of the match. "Home" means the Home team scored first, "Away" means the Away team scored first, "No Goal" means the match ended 0-0 with no goals.
       - 1ST_HALF_1X2 (HALF_TIME_WINNER): Settle based on the score at Half Time (HT). 'Home' means the Home team was leading at HT, 'Away' means the Away team was leading at HT, 'Draw' means the score was tied at HT.
       - 1ST_HALF_1ST_CORNER (HALF_TIME_1ST_CORNER): Settle based on which team received the first corner kick of the match in the first half. "Home" means the Home team took the first corner, "Away" means the Away team took the first corner, "Neither" means no corners were taken by either team in the first half.
       - BTTS: Both scored at FT?
       - SENDING_OFF: WON if at least one player was shown a Red Card (direct or second yellow). "Yes" selection wins if card shown, "No" selection wins if no card shown.
       - OVER_UNDER: Total goals at FT.
       - EXACT_GOALS: Total match goals at FT matching the selected exact goal count (e.g. "2 Goals", "3 Goals", or "6+ Goals").
       - GOAL_RANGE: Total match goals at FT falling within the selected range (e.g. "0-1 Goals", "2-3 Goals", "4-5 Goals", "2-4 Goals", "5+ Goals").
       - TEAM_TOTAL: Total goals scored by the specific team (Home or Away) at FT.
       - HANDICAP: Settle based on FT score plus/minus the handicap value for the chosen team.
       - ODD_EVEN: WON if total match goals (Home + Away) is Odd or Even as selected. Note: 0 goals is settled as Even.
       - BOOKINGS: Settle based on the total booking points shown to active players, calculated as: Yellow Card = 1 point, Red Card = 2 points. A second yellow card is NOT considered (i.e. if a player receives a second yellow card leading to a red, the second yellow is ignored, meaning that player receives 1 point for the first yellow and 2 points for the red, totaling 3 points max).
       - BOOKINGS_1X2: Settle based on which team received more booking points at FT (using: Yellow Card = 1, Red Card = 2, second yellow is not considered). "Home" means Home team had more booking points, "Away" means Away team had more booking points, "Draw" means both had the same count.
       - CORNER_1X2: Settle based on which team had more corner kicks awarded at FT. "Home" means Home team had more corners, "Away" means Away team had more corners, "Draw" means both had the same count.
       - TOTAL_CORNERS: Settle based on total number of corners in the match at FT (Home + Away). For "Over X.5", win if total > X. For "Under X.5", win if total < X.
       - TEN_MINS_1X2: Settle based on the score at exactly the 10-minute mark (10:00). If no goals are scored in the first 10 minutes, the selection "Draw (1-10')" is WON.
       - 1X2_BTTS: Combined market. WON if BOTH the match outcome (1, X, or 2) and the BTTS status (Yes/No) match the selection (e.g. "Home & Yes").
       - WIN_EITHER_HALF: The selection format is "Team - 1stHalfAnswer/2ndHalfAnswer" (e.g. "Home - Yes/No"). 
         "Yes" means the team won that half (treat as starting 0-0). 
         Settle as WON only if both half results match the selection.
       - WINNING_MARGIN: Calculate goal difference at FT.
       - HALVES_BTTS: Both scored in both halves.
       - ONE_UP / TWO_UP / THREE_UP: Early Payout. Selection is "Home" or "Away".
         - Settle as WON if:
           1) At ANY point in the match (including while LIVE or at FT), the selected team (Home or Away) leads by at least 1 goal (for ONE_UP), 2 goals (for TWO_UP), or 3 goals (for THREE_UP). E.g. for TWO_UP, if the Home team led 2-0 or 3-1 at any point, the Home selection is WON.
           2) Or, if the match ends (FT) and the selected team won the match (e.g. a 1-0 win for Home but never led by 2 goals, Home selection is still WON).
         - Settle as LOST if: The match is FT, the selected team did not win, and they never went 1, 2, or 3 goals ahead during the match.
         - Settle as PENDING if: The match is LIVE/not started, and they have not met the early payout condition yet.
    
    INPUTS:
    ${legsDescription}

    OUTPUT ONLY JSON ARRAY:
    \`\`\`json
    [
      { 
        "legId": "...", 
        "status": "WON|LOST|VOID|PENDING", 
        "score": "X-Y (Status e.g. FT, HT, 65', PPD)", 
        "reason": "Brief detail on why settled or why pending" 
      }
    ]
    \`\`\`
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0,
      },
    });

    const text = (response.text || '').trim();
    
    const sources: string[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    chunks.forEach(chunk => {
      if (chunk.web?.uri) {
        sources.push(chunk.web.uri);
      }
    });

    let rawResults: any[] = [];
    if (text) {
      // Robust JSON extraction
      let jsonString = '';
      
      // Try to find the markdown code block first
      const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
      if (jsonBlockMatch) {
        jsonString = jsonBlockMatch[1].trim();
      } else {
        // Find the first '[' and last ']'
        const firstBracket = text.indexOf('[');
        const lastBracket = text.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          jsonString = text.substring(firstBracket, lastBracket + 1).trim();
        } else {
          jsonString = text;
        }
      }

      // Remove any inline citations like [1], [2], [1, 2] that could break parsing if injected into the JSON raw structure
      jsonString = jsonString.replace(/\[\d+(?:,\s*\d+)*\]/g, '');

      try {
        rawResults = JSON.parse(jsonString);
      } catch (parseError: any) {
        // Fallback: try to clean up trailing commas in array or objects
        try {
          const cleanedJson = jsonString
            .replace(/,\s*\]/g, ']')
            .replace(/,\s*\}/g, '}');
          rawResults = JSON.parse(cleanedJson);
        } catch (secondError) {
          throw new Error(`Failed to parse Gemini response as JSON. Error: ${parseError.message}`);
        }
      }
    } else {
      throw new Error("No structured results found (Empty response from Gemini).");
    }

    if (!Array.isArray(rawResults)) {
      rawResults = [rawResults];
    }

    const results: ValidationResult[] = rawResults.map(r => {
      const rawStatus = String(r?.status || '').toUpperCase().trim();
      let status: LegStatus = LegStatus.PENDING;
      if (rawStatus === 'WON') status = LegStatus.WON;
      else if (rawStatus === 'LOST') status = LegStatus.LOST;
      else if (rawStatus === 'VOID') status = LegStatus.VOID;

      return {
        legId: String(r?.legId || ''),
        status,
        score: typeof r?.score === 'string' ? r.score : String(r?.score || ''),
        reason: typeof r?.reason === 'string' ? r.reason : String(r?.reason || '')
      } as any;
    });

    return { results, sources };

  } catch (error: any) {
    const errMsg = String(error?.message || error);
    const isQuota = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('exhausted') || errMsg.includes('LIMIT');
    if (isQuota) {
      console.warn("Gemini Validation Warning (Quota Limit Exceeded):", errMsg);
    } else {
      console.error("Gemini Validation Error:", error);
    }
    throw error;
  }
};

/**
 * Validates bet slip legs using Gemini 3 Flash.
 * Enforces strict settlement only for finished matches.
 */
export const validateSlipWithGemini = async (slip: Slip): Promise<ValidationResponse> => {
  return validateLegsWithGemini(slip.legs);
};