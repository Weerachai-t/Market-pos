import { NextResponse } from 'next/server';
import { createSession, verifyPassword } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';

export async function POST(request:Request) {
  try {
    const body = await request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const sql = getDb();
    const rows = await sql`SELECT id, password_hash FROM users WHERE LOWER(username)=${username} AND is_active=TRUE LIMIT 1`;
    const user = rows[0];
    if (!user?.password_hash || !(await verifyPassword(password,String(user.password_hash)))) {
      return NextResponse.json({error:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'}, {status:401});
    }
    await createSession(Number(user.id));
    await sql`UPDATE users SET last_login_at=NOW() WHERE id=${user.id}`;
    return NextResponse.json({success:true});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error:'เข้าสู่ระบบไม่สำเร็จ'}, {status:500});
  }
}
