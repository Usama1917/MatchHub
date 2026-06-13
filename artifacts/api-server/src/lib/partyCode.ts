import { randomInt } from "crypto";

// Party codes are 6-digit numeric strings (no letters or symbols), e.g. "081402".
// Leading zeros are preserved, so codes are stored and compared as text.
export function generatePartyCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
