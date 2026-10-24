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
             COALESCE(u.users,0)::int AS users,
             COALESCE(p.products,0)::int AS products,
             COALESCE(c.customers,0)::int AS customers,
             COALESCE(b.branches,0)::int AS branches,
             COALESCE(sa.bills,0)::int AS bills,
             COALESCE(sa.revenue,0)::float AS revenue,
             sub.plan_code,sub.billing_cycle,sub.status AS subscription_status,sub.expires_at,
             COALESCE(pay.pending_payments,0)::int AS pending_payments
        FROM tenants t
        LEFT JOIN LATERAL (SELECT COUNT(*) users FROM users x WHERE x.tenant_id=t.id AND x.is_active=TRUE) u ON TRUE
        LEFT JOIN LATERAL (SELECT COUNT(*) products FROM products x WHERE x.tenant_id=t.id AND x.is_active=TRUE) p ON TRUE
        LEFT JOIN LATERAL (SELECT COUNT(*) customers FROM customers x WHERE x.tenant_id=t.id) c ON TRUE
        LEFT JOIN LATERAL (SELECT COUNT(*) branches FROM branches x WHERE x.tenant_id=t.id AND x.is_active=TRUE) b ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) bills,COALESCE(SUM(total),0) revenue
            FROM sales x WHERE x.tenant_id=t.id AND x.status='completed'
        ) sa ON TRUE
        LEFT JOIN LATERAL (
          SELECT plan_code,billing_cycle,status,expires_at
            FROM subscriptions x
           WHERE x.tenant_id=t.id AND x.status IN ('trial','active','past_due')
           ORDER BY x.expires_at DESC LIMIT 1
        ) sub ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) pending_payments FROM subscription_payments x
           WHERE x.tenant_id=t.id AND x.status='pending'
        ) pay ON TRUE
       ORDER BY t.created_at DESC
    `;
    return NextResponse.json({tenants});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error:'โหลดข้อมูลร้านค้าไม่สำเร็จ'}, {status:500});
  }
}
