'use client';

/**
 * Same consistency requirement as the existing five-frame scan: at least three
 * mutually agreeing 192D face observations. Once a valid consensus exists,
 * extra inference frames provide no additional requirement, so stop early.
 *
 * If the first three disagree, allow up to five frames before surfacing the
 * original quality/consistency error. This does NOT change face matching,
 * geofencing or the required enrollment/evidence verification steps.
 */
import {buildStableFace, type FaceObservation, type StableFace} from './face-capture-quality';

export function selectStableScan(
  observations: readonly FaceObservation[],
  maximumFrames = 5,
): StableFace | null {
  if (observations.length < 3) return null;

  try {
    return buildStableFace(observations);
  } catch (error) {
    if (
      observations.length < maximumFrames &&
      error instanceof Error &&
      (/^Face scan is inconsistent\./.test(error.message) ||
       /^Not enough consistent face frames\./.test(error.message))
    ) {
      return null;
    }
    throw error;
  }
}
