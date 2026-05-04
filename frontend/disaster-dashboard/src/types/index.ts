// Damage classification levels matching xBD / FEMA standards
export type DamageLevel = 'no-damage' | 'minor-damage' | 'major-damage' | 'destroyed' | 'un-classified';

export interface Building {
  id: string;
  address: string;
  lat: number;
  lng: number;
  damageLevel: DamageLevel;
  modelPrediction: DamageLevel;
  femaLabel: DamageLevel;
  confidence: number; // 0-1
  preImageUrl?: string;
  postImageUrl?: string;
  notes?: string;
}

export interface EvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  totalBuildings: number;
  byClass: Record<DamageLevel, ClassMetrics>;
}

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
  correct: number;
}

export interface ConfusionMatrixData {
  labels: DamageLevel[];
  matrix: number[][];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
  timestamp: Date;
}

export interface DisasterEvent {
  id: string;
  name: string;
  type: 'hurricane' | 'flood' | 'wildfire' | 'earthquake' | 'tornado';
  date: string;
  location: string;
  centerLat: number;
  centerLng: number;
  totalBuildings: number;
  damageSummary: Record<DamageLevel, number>;
}

export interface NavRoute {
  path: string;
  label: string;
  icon: string;
}
