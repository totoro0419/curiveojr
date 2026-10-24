import { useSyncExternalStore } from 'react';
import { applyPwaUpdate, checkPwaUpdate, getPwaServerSnapshot, getPwaSnapshot, installPwa, subscribePwa } from '../lib/pwa';

export function usePwa() {
  const state = useSyncExternalStore(subscribePwa, getPwaSnapshot, getPwaServerSnapshot);
  return { ...state, install: installPwa, applyUpdate: applyPwaUpdate, checkForUpdate: checkPwaUpdate };
}
