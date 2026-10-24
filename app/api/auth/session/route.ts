import { NextResponse } from 'next/server';
import { getCurrentEmployee } from '../../../../lib/auth';

export async function GET() {
  try {
    const employee = await getCurrentEmployee();
    return NextResponse.json({ setupRequired:false, employee });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error:'ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ' }, { status:500 });
  }
}
