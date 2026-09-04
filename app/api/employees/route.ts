import { NextResponse } from 'next/server';
import { getCurrentEmployee, hashPassword, hasPermission } from '../../../lib/auth';
import { getDb } from '../../../lib/db';

const cleanPermissions = (value:unknown) => {
  const input = value && typeof value === 'object' ? value as Record<string,unknown> : {};
  return {
    sell:input.sell === true,
    manage_products:input.manage_products === true,
    view_reports:input.view_reports === true,
    manage_customers:input.manage_customers === true,
  };
};

export async function GET() {
  const current = await getCurrentEmployee();
  if (!current) return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'}, {status:401});
  if (!hasPermission(current,'manage_employees')) return NextResponse.json({error:'ไม่มีสิทธิ์จัดการพนักงาน'}, {status:403});
  try {
    const sql = getDb();
    const employees = await sql`SELECT id, username, display_name, phone, email, role, permissions, is_active, last_login_at, created_at FROM users ORDER BY is_active DESC, display_name`;
    return NextResponse.json({employees});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error:'โหลดข้อมูลพนักงานไม่สำเร็จ'}, {status:500});
  }
}

export async function POST(request:Request) {
  const current = await getCurrentEmployee();
  if (!current) return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'}, {status:401});
  if (!hasPermission(current,'manage_employees')) return NextResponse.json({error:'ไม่มีสิทธิ์จัดการพนักงาน'}, {status:403});
  try {
    const body = await request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    const password = String(body.password || '');
    const role = body.role === 'admin' ? 'admin' : 'cashier';
    if (!/^[a-z0-9._-]{3,50}$/.test(username)) return NextResponse.json({error:'ชื่อผู้ใช้ต้องมี 3–50 ตัวและเป็นภาษาอังกฤษ/ตัวเลข'}, {status:400});
    if (!displayName) return NextResponse.json({error:'กรุณากรอกชื่อพนักงาน'}, {status:400});
    if (password.length < 8) return NextResponse.json({error:'รหัสผ่านต้องมีอย่างน้อย 8 ตัว'}, {status:400});
    const passwordHash = await hashPassword(password);
    const permissions = cleanPermissions(body.permissions);
    const sql = getDb();
    const rows = await sql`
      INSERT INTO users (username, display_name, password_hash, phone, email, role, permissions)
      VALUES (${username}, ${displayName}, ${passwordHash}, ${String(body.phone||'').replace(/\D/g,'')||null}, ${String(body.email||'').trim()||null}, ${role}, ${JSON.stringify(permissions)}::jsonb)
      RETURNING id, username, display_name, phone, email, role, permissions, is_active, created_at
    `;
    return NextResponse.json({employee:rows[0]}, {status:201});
  } catch (error) {
    console.error(error);
    const duplicate = error instanceof Error && error.message.includes('unique');
    return NextResponse.json({error:duplicate?'ชื่อผู้ใช้นี้มีอยู่แล้ว':'เพิ่มพนักงานไม่สำเร็จ'}, {status:duplicate?409:500});
  }
}
