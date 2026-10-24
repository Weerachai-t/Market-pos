import { NextResponse } from 'next/server';
import { getCurrentEmployee, isSuperAdmin } from '../../../../../lib/auth';
import { getDb } from '../../../../../lib/db';

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  if(!isSuperAdmin(employee))return NextResponse.json({error:'สำหรับ Super Admin เท่านั้น'},{status:403});
  try{
    const {id}=await params;
    const paymentId=Number(id);
    const body=await request.json();
    const action=body.action==='reject'?'reject':'approve';
    if(!Number.isInteger(paymentId)||paymentId<=0)return NextResponse.json({error:'รหัสรายการไม่ถูกต้อง'},{status:400});
    const sql=getDb();
    if(action==='reject'){
      const rows=await sql`
        UPDATE subscription_payments SET status='rejected',approved_at=NOW(),approved_by=${employee.id}
         WHERE id=${paymentId} AND status='pending'
         RETURNING id,status
      `;
      if(!rows[0])return NextResponse.json({error:'รายการนี้ถูกดำเนินการแล้ว'},{status:409});
      return NextResponse.json({payment:rows[0]});
    }
    const rows=await sql`
      WITH pay AS (
        UPDATE subscription_payments
           SET status='approved',approved_at=NOW(),approved_by=${employee.id}
         WHERE id=${paymentId} AND status='pending'
         RETURNING tenant_id,plan_code,billing_cycle
      ),
      close_old AS (
        UPDATE subscriptions s SET status='cancelled',updated_at=NOW()
         WHERE s.tenant_id=(SELECT tenant_id FROM pay)
           AND s.status IN ('trial','active','past_due')
         RETURNING s.id
      ),
      new_sub AS (
        INSERT INTO subscriptions(tenant_id,plan_code,billing_cycle,status,starts_at,expires_at)
        SELECT tenant_id,plan_code,billing_cycle,'active',NOW(),
               CASE WHEN billing_cycle='yearly' THEN NOW()+INTERVAL '1 year' ELSE NOW()+INTERVAL '1 month' END
          FROM pay
        RETURNING id,tenant_id,plan_code,billing_cycle,status,starts_at,expires_at
      ),
      sync_tenant AS (
        UPDATE tenants t SET plan=(SELECT plan_code FROM new_sub),status='active',updated_at=NOW()
         WHERE t.id=(SELECT tenant_id FROM new_sub)
         RETURNING t.id
      )
      SELECT * FROM new_sub
    `;
    if(!rows[0])return NextResponse.json({error:'รายการนี้ถูกดำเนินการแล้ว'},{status:409});
    return NextResponse.json({subscription:rows[0]});
  }catch(error){console.error(error);return NextResponse.json({error:'อนุมัติการชำระเงินไม่สำเร็จ'},{status:500})}
}
