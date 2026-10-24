import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getCurrentEmployee, hasPermission, requireTenant } from '../../../lib/auth';

const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '');

export async function GET(request: Request) {
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  if(!hasPermission(employee,'manage_customers')&&!hasPermission(employee,'sell'))return NextResponse.json({error:'ไม่มีสิทธิ์ดูข้อมูลสมาชิก'},{status:403});
  try {
    const url = new URL(request.url);
    const phone = normalizePhone(url.searchParams.get('phone'));
    const tenantId = requireTenant(employee);
    const sql = getDb();
    const customers = phone
      ? await sql`SELECT id, name, phone, points_balance, total_spent, created_at FROM customers WHERE tenant_id=${tenantId} AND phone LIKE ${`%${phone}%`} ORDER BY updated_at DESC LIMIT 20`
      : await sql`SELECT id, name, phone, points_balance, total_spent, created_at FROM customers WHERE tenant_id=${tenantId} ORDER BY updated_at DESC LIMIT 50`;
    return NextResponse.json({ customers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'โหลดข้อมูลสมาชิกไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  if(!hasPermission(employee,'manage_customers'))return NextResponse.json({error:'ไม่มีสิทธิ์จัดการสมาชิก'},{status:403});
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const phone = normalizePhone(body.phone);
    if (!name) return NextResponse.json({ error: 'กรุณากรอกชื่อสมาชิก' }, { status: 400 });
    if (phone.length < 9 || phone.length > 15) return NextResponse.json({ error: 'กรุณากรอกเบอร์โทรให้ถูกต้อง' }, { status: 400 });
    const tenantId = requireTenant(employee);
    const sql = getDb();
    const rows = await sql`
      INSERT INTO customers (tenant_id, name, phone)
      VALUES (${tenantId}, ${name}, ${phone})
      ON CONFLICT (tenant_id, phone) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
      RETURNING id, name, phone, points_balance, total_spent, created_at
    `;
    return NextResponse.json({ customer: rows[0] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'บันทึกสมาชิกไม่สำเร็จ' }, { status: 500 });
  }
}
