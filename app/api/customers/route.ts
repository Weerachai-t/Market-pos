import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '');

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const phone = normalizePhone(url.searchParams.get('phone'));
    const sql = getDb();
    const customers = phone
      ? await sql`SELECT id, name, phone, points_balance, total_spent, created_at FROM customers WHERE phone LIKE ${`%${phone}%`} ORDER BY updated_at DESC LIMIT 20`
      : await sql`SELECT id, name, phone, points_balance, total_spent, created_at FROM customers ORDER BY updated_at DESC LIMIT 50`;
    return NextResponse.json({ customers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'โหลดข้อมูลสมาชิกไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const phone = normalizePhone(body.phone);
    if (!name) return NextResponse.json({ error: 'กรุณากรอกชื่อสมาชิก' }, { status: 400 });
    if (phone.length < 9 || phone.length > 15) return NextResponse.json({ error: 'กรุณากรอกเบอร์โทรให้ถูกต้อง' }, { status: 400 });
    const sql = getDb();
    const rows = await sql`
      INSERT INTO customers (name, phone)
      VALUES (${name}, ${phone})
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
      RETURNING id, name, phone, points_balance, total_spent, created_at
    `;
    return NextResponse.json({ customer: rows[0] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'บันทึกสมาชิกไม่สำเร็จ' }, { status: 500 });
  }
}
