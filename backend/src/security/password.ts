import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const PEPPER = process.env.AUTH_PASSWORD_PEPPER || '';
if (process.env.NODE_ENV === 'production' && PEPPER.length < 32) throw new Error('AUTH_PASSWORD_PEPPER debe tener al menos 32 caracteres en producción.');

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10 || password.length > 200) throw new Error('La contraseña debe tener entre 10 y 200 caracteres.');
  const salt = randomBytes(16);
  const derived = await scrypt(password + PEPPER, salt, 64) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltText, hashText] = encoded.split('$');
  if (algorithm !== 'scrypt' || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, 'base64url');
  const actual = await scrypt(password + PEPPER, Buffer.from(saltText, 'base64url'), expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
