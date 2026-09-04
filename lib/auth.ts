import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { cookies } from 'next/headers';
import { getDb } from './db';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'market_pos_session';
export const SESSION_DAYS = 30;

export type Permission = 'sell' | 'manage_products' | 'view_reports' | 'manage_customers' | 'manage_employees';
export type Employee = {
  id:number; username:string; display_name:string; phone?:string|null; email?:string|null;
  role:'admin'|'cashier'; is_active:boolean; permissions:Record<string,boolean>;
};

export async function hashPassword(password:string) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password:string, stored:string) {
  const [algorithm,salt,expectedHex] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const hashToken = (token:string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId:number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  const sql = getDb();
  await sql`INSERT INTO employee_sessions (user_id, token_hash, expires_at) VALUES (${userId}, ${hashToken(token)}, ${expiresAt.toISOString()})`;
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV === 'production', path:'/', expires:expiresAt });
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const sql = getDb();
    await sql`DELETE FROM employee_sessions WHERE token_hash=${hashToken(token)}`;
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentEmployee():Promise<Employee|null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sql = getDb();
  const rows = await sql`
    SELECT u.id, u.username, u.display_name, u.phone, u.email, u.role, u.is_active, u.permissions
      FROM employee_sessions s
      JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=${hashToken(token)} AND s.expires_at > NOW() AND u.is_active=TRUE
     LIMIT 1
  `;
  return rows[0] ? {
    ...rows[0], id:Number(rows[0].id), permissions:rows[0].permissions || {}, is_active:Boolean(rows[0].is_active),
  } as Employee : null;
}

export function hasPermission(employee:Employee, permission:Permission) {
  if (employee.role === 'admin') return true;
  if (permission === 'manage_employees') return false;
  return employee.permissions?.[permission] === true;
}
