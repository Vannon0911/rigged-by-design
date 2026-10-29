import { useSyncExternalStore } from 'react';
import { gameStore } from './game-store';
import type { GameSnapshot } from './types';

export function useGameStore(): GameSnapshot {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot, gameStore.getSnapshot);
}

export { gameStore };
