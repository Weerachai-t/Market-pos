import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getCurrentEmployee } from '../../../../lib/auth';

const DEFAULT_THEME = '#111827';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error:'กรุณาเข้าสู่ระบบ' }, { status:401 });
  try {
    const sql = getDb();
    const rows = await sql`SELECT value FROM system_state WHERE key='theme_color' LIMIT 1`;
    const color = rows[0]?.value && HEX_COLOR.test(String(rows[0].value)) ? String(rows[0].value) : DEFAULT_THEME;
    return NextResponse.json({ color });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error:'โหลดสีธีมไม่สำเร็จ' }, { status:500 });
  }
}

export async function PATCH(request:Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error:'กรุณาเข้าสู่ระบบ' }, { status:401 });
  if (employee.role !== 'admin') return NextResponse.json({ error:'เฉพาะผู้ดูแลระบบเท่านั้นที่เปลี่ยนสีธีมได้' }, { status:403 });
  try {
    const body = await request.json();
    const color = typeof body.color === 'string' ? body.color.toUpperCase() : '';
    if (!HEX_COLOR.test(color)) return NextResponse.json({ error:'รูปแบบสีไม่ถูกต้อง' }, { status:400 });
    const sql = getDb();
    await sql`
      INSERT INTO system_state (key, value, updated_at)
      VALUES ('theme_color', ${color}, NOW())
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
    `;
    return NextResponse.json({ color });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error:'บันทึกสีธีมไม่สำเร็จ' }, { status:500 });
  }
}
