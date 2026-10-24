import { NextResponse } from 'next/server';
import { createSession, verifyPassword } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';

export async function POST(request:Request) {
  try {
    const body = await request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const sql = getDb();
    const rows = await sql`SELECT u.id,u.password_hash,u.platform_role,t.status AS tenant_status FROM users u LEFT JOIN tenants t ON t.id=u.tenant_id WHERE LOWER(u.username)=${username} AND u.is_active=TRUE LIMIT 1`;
    const user = rows[0];
    if (!user?.password_hash || !(await verifyPassword(password,String(user.password_hash)))) {
      return NextResponse.json({error:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'}, {status:401});
    }
    if (user.platform_role !== 'super_admin' && user.tenant_status !== 'active') return NextResponse.json({error:'บัญชีร้านค้าถูกระงับการใช้งาน'}, {status:403});
    await createSession(Number(user.id));
    await sql`UPDATE users SET last_login_at=NOW() WHERE id=${user.id}`;
    return NextResponse.json({success:true});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error:'เข้าสู่ระบบไม่สำเร็จ'}, {status:500});
  }
}
