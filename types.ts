export type Gender = 'Male' | 'Female';

export interface AppState {
  targetGender: Gender;
  targetName: string;
  selectedActs: string[];
  selectedAccessories: string[];
  customAccessories: string;
  tone: string;
  imageSize: '1K' | '2K' | '4K';
  // New preferences
  customWords: string;
  allowProfanity: boolean;
  allowInsults: boolean;
}

export interface ScenarioPart {
  text: string;
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