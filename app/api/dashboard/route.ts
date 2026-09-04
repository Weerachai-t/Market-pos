import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getCurrentEmployee } from '../../../lib/auth';

export async function GET() {
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  try {
    const sql = getDb();
    const [sales] = await sql`SELECT COALESCE(SUM(total),0)::float AS revenue, COUNT(*)::int AS bills FROM sales WHERE status='completed' AND sold_at >= date_trunc('day', now())`;
    const [inventory] = await sql`SELECT COUNT(*)::int AS products, COUNT(*) FILTER (WHERE stock_qty <= low_stock_qty)::int AS low_stock FROM products WHERE is_active=true`;
    return NextResponse.json({ todayRevenue: sales.revenue, todayBills: sales.bills, products: inventory.products, lowStock: inventory.low_stock });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }
}
