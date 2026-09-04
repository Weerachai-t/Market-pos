import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getCurrentEmployee } from '../../../../lib/auth';

export async function GET() {
  try {
    const sql = getDb();
    const [state] = await sql`SELECT value FROM system_state WHERE key='admin_initialized'`;
    const employee = await getCurrentEmployee();
    return NextResponse.json({ setupRequired:state?.value !== 'true', employee });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error:'ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ' }, { status:500 });
  }
}
