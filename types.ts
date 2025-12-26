export type Gender = 'Male' | 'Female';

export interface Subject {
  id: string;
  gender: Gender;
  name: string;
}

export interface AppState {
  subjects: Subject[]; // Replaces targetGender & targetName
  selectedActs: string[];
  selectedAccessories: string[];
  customAccessories: string;
  tone: string;
  imageSize: '1K' | '2K' | '4K';
  // New preferences
  relationship: string; // Context: Strangers, Married, Boss/Employee, etc.
  customWords: string;
  allowProfanity: boolean;
  allowInsults: boolean;
  // Voice controls
  speakerGender: Gender;
  selectedVoice: string;
}

export interface ScenarioPhase {
  title: string;      // e.g. "ФАЗА 1: ПОДГОТОВКА"
  duration: string;   // e.g. "0-5 минут"
  pose: string;
  inventory: string;
  action: string;
  dirtyTalk: string;
  sensorics: string;
}

export interface ScenarioPart {
  phases: ScenarioPhase[]; // Structured data for the UI cards
  script: string;          // Long, detailed script for audio generation
  audioBuffer: AudioBuffer | null;
}

export interface GeneratedResult {
  part1: ScenarioPart | null;
  part2: ScenarioPart | null;
}

export enum Step {
  CONFIG = 0,
  GENERATING_PART1 = 1,
  RESULT_PART1 = 2,
  GENERATING_PART2 = 3,
  RESULT_FULL = 4,
}