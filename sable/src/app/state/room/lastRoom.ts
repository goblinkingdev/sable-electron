import { atom } from 'jotai';

// This is only used for mobile swipe gestures
// It is not particularly accurate and shouldn't be used for much else
// unless you plan major refractors
export const lastVisitedRoomIdAtom = atom<string | undefined>(undefined);
