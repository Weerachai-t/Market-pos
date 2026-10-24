import { NextResponse } from 'next/server';
import { getCurrentEmployee, isSuperAdmin } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';

export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'}, {status:401});
  if (!isSuperAdmin(employee)) return NextResponse.json({error:'สำหรับผู้ดูแลระบบแพลตฟอร์มเท่านั้น'}, {status:403});
  try {
    const sql = getDb();
    const tenants = await sql`
      SELECT t.id,t.account_code,t.store_name,t.owner_name,t.phone,t.email,t.status,t.plan,t.created_at,
             COUNT(DISTINCT u.id)::int AS users,
             COUNT(DISTINCT p.id)::int AS products,
             COUNT(DISTINCT c.id)::int AS customers,
             COUNT(DISTINCT s.id)::int AS bills,
             COALESCE(SUM(DISTINCT CASE WHEN s.status='completed' THEN s.total ELSE 0 END),0)::float AS revenue
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id=t.id
        LEFT JOIN products p ON p.tenant_id=t.id AND p.is_active=TRUE
        LEFT JOIN customers c ON c.tenant_id=t.id
        LEFT JOIN sales s ON s.tenant_id=t.id
       GROUP BY t.id
       ORDER BY t.created_at DESC
    `;
    return NextResponse.json({tenants});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error:'โหลดข้อมูลร้านค้าไม่สำเร็จ'}, {status:500});
  }
}
