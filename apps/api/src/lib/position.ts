import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

export function positionAfter(prev: string | null) {
  return generateKeyBetween(prev, null);
}

export function positionBefore(next: string | null) {
  return generateKeyBetween(null, next);
}

export function positionBetween(prev: string | null, next: string | null) {
  return generateKeyBetween(prev, next);
}

export function initialPositions(count: number) {
  return generateNKeysBetween(null, null, count);
}
