import { NextResponse } from 'next/server';
import { createSession, hashPassword } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';

export async function POST(request:Request) {
  try {
    const body = await request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    const password = String(body.password || '');
    if (!/^[a-z0-9._-]{3,50}$/.test(username)) return NextResponse.json({error:'ชื่อผู้ใช้ต้องมี 3–50 ตัว ใช้ภาษาอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง'}, {status:400});
    if (!displayName) return NextResponse.json({error:'กรุณากรอกชื่อพนักงาน'}, {status:400});
    if (password.length < 8) return NextResponse.json({error:'รหัสผ่านต้องมีอย่างน้อย 8 ตัว'}, {status:400});
    const passwordHash = await hashPassword(password);
    const sql = getDb();
    const rows = await sql`
      WITH claimed AS (
        UPDATE system_state SET value='true', updated_at=NOW()
         WHERE key='admin_initialized' AND value='false'
        RETURNING 1
      )
      INSERT INTO users (username, display_name, password_hash, role, permissions)
      SELECT ${username}, ${displayName}, ${passwordHash}, 'admin', '{}'::jsonb FROM claimed
      RETURNING id, username, display_name, role
    `;
    if (!rows[0]) return NextResponse.json({error:'มีการตั้งค่า Admin แล้ว กรุณาเข้าสู่ระบบ'}, {status:409});
    await createSession(Number(rows[0].id));
    return NextResponse.json({employee:rows[0]});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error:'ตั้งค่า Admin ไม่สำเร็จ'}, {status:500});
  }
}
