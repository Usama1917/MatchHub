import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function verifyPassword(
  supplied: string,
  stored: string,
): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  // A malformed/legacy stored hash should fail verification cleanly rather than
  // throw and surface as a 500.
  if (!hashed || !salt) return false;

  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  // timingSafeEqual throws if the buffers differ in length (e.g. corrupt hash).
  if (hashedBuf.length !== suppliedBuf.length) return false;

  return timingSafeEqual(hashedBuf, suppliedBuf);
}
