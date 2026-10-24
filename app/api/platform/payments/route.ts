import { NextResponse } from 'next/server';
import { getCurrentEmployee, isSuperAdmin } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';

export async function GET(){
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  if(!isSuperAdmin(employee))return NextResponse.json({error:'สำหรับ Super Admin เท่านั้น'},{status:403});
  try{
    const sql=getDb();
    const payments=await sql`
      SELECT sp.id,sp.tenant_id,t.store_name,t.account_code,sp.plan_code,sp.billing_cycle,sp.amount,
             sp.payment_method,sp.status,sp.payment_reference,sp.created_at,sp.paid_at,sp.approved_at
        FROM subscription_payments sp JOIN tenants t ON t.id=sp.tenant_id
       ORDER BY CASE sp.status WHEN 'pending' THEN 0 ELSE 1 END,sp.created_at DESC
       LIMIT 100
    `;
    return NextResponse.json({payments});
  }catch(error){console.error(error);return NextResponse.json({error:'โหลดรายการชำระเงินไม่สำเร็จ'},{status:500})}
}
