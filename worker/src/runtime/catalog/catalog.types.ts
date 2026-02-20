export interface FilterHints {
  /** * Rules that the agent MUST apply to almost every query to ensure accuracy.
   * Example: "is_current_season = true" or "primary_player_full_name IS NOT NULL"
   */
  always?: string[];

  /** * Contextual suggestions when the user's intent is unclear.
   * Example: "If a user asks for 'rankings' without a division, default to division_name = '4.0'"
   */
  onAmbiguity?: string;

  /** * Key-Value pairs for specific column defaults.
   * Example: { "season_year": "2025", "is_past_match": "true" }
   */
  defaults?: Record<string, string | number | boolean>;
}

export interface CatalogEntry {
  name: string;
  description: string;
  aliases: string[];
  useFor: string[];
  avoidFor: string[];
  exampleQuestions: string[];
  defaultSort: string;
  columns: string[];
  sample_data: Array<Record<string, unknown>>;
  filterHints: FilterHints;
  logicBridges?: string[];
}

export interface CatalogSelectorOptions {
  mode: "deterministic" | "hybrid";
  topK: number;
  confidenceMin: number;
  maxColumnsPerView?: number;
  forcePrimaryView?: string;
}

export interface CatalogSelectorInput {
  selectedViews: string[];
  selectedSchema: string;
  catalogContext: string;
  confidence: number;
  reason: string;
  source: "deterministic" | "hybrid";
}

export interface WonLostIntentHints {
  activeTeamName?: string;
  activePlayerName?: string;
}

export interface WonLostIntentDecision {
  preferredView?: string;
  clarification?: string;
  reason: string;
}
