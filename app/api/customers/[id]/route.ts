import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getCurrentEmployee, hasPermission } from '../../../../lib/auth';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  if(!hasPermission(employee,'manage_customers')&&!hasPermission(employee,'sell'))return NextResponse.json({error:'ไม่มีสิทธิ์ดูข้อมูลสมาชิก'},{status:403});
  try {
    const { id } = await context.params;
    const customerId = Number(id);
    if (!Number.isInteger(customerId) || customerId <= 0) return NextResponse.json({ error: 'รหัสสมาชิกไม่ถูกต้อง' }, { status: 400 });
    const sql = getDb();
    const [customers, transactions, sales] = await Promise.all([
      sql`SELECT id, name, phone, points_balance, total_spent, created_at, updated_at FROM customers WHERE id=${customerId}`,
      sql`SELECT id, sale_id, transaction_type, points, balance_after, description, created_at FROM point_transactions WHERE customer_id=${customerId} ORDER BY created_at DESC, id DESC LIMIT 100`,
      sql`SELECT id, receipt_no, sold_at, total, points_earned, points_redeemed FROM sales WHERE customer_id=${customerId} ORDER BY sold_at DESC LIMIT 50`,
    ]);
    if (!customers[0]) return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });
    return NextResponse.json({ customer: customers[0], transactions, sales });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'โหลดประวัติสมาชิกไม่สำเร็จ' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error:'กรุณาเข้าสู่ระบบ' }, { status:401 });
  if (!hasPermission(employee, 'manage_customers')) return NextResponse.json({ error:'ไม่มีสิทธิ์จัดการสมาชิก' }, { status:403 });
  try {
    const { id } = await context.params;
    const customerId = Number(id);
    if (!Number.isInteger(customerId) || customerId <= 0) return NextResponse.json({ error:'รหัสสมาชิกไม่ถูกต้อง' }, { status:400 });
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error:'กรุณากรอกชื่อสมาชิก' }, { status:400 });
    if (name.length > 120) return NextResponse.json({ error:'ชื่อสมาชิกต้องไม่เกิน 120 ตัวอักษร' }, { status:400 });
    const sql = getDb();
    const rows = await sql`
      UPDATE customers
         SET name=${name}, updated_at=NOW()
       WHERE id=${customerId}
       RETURNING id, name, phone, points_balance, total_spent, created_at, updated_at
    `;
    if (!rows[0]) return NextResponse.json({ error:'ไม่พบสมาชิก' }, { status:404 });
    return NextResponse.json({ customer:rows[0] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error:'แก้ไขชื่อสมาชิกไม่สำเร็จ' }, { status:500 });
  }
}
