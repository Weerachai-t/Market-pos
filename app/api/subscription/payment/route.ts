import { NextResponse } from 'next/server';
import { getCurrentEmployee, requireTenant } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';

export async function POST(request:Request){
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  try{
    const tenantId=requireTenant(employee);
    const body=await request.json();
    const planCode=String(body.planCode||'').toLowerCase();
    const billingCycle=body.billingCycle==='yearly'?'yearly':'monthly';
    const paymentMethod=body.paymentMethod==='bank_transfer'?'bank_transfer':'promptpay';
    const paymentReference=String(body.paymentReference||'').trim()||null;
    const sql=getDb();
    const [plan]=await sql`SELECT code,monthly_price,yearly_price FROM subscription_plans WHERE code=${planCode} AND is_active=TRUE`;
    if(!plan)return NextResponse.json({error:'ไม่พบแพ็กเกจ'},{status:404});
    const amount=Number(billingCycle==='yearly'?plan.yearly_price:plan.monthly_price);
    const rows=await sql`
      INSERT INTO subscription_payments(tenant_id,plan_code,billing_cycle,amount,payment_method,status,payment_reference,paid_at)
      VALUES(${tenantId},${planCode},${billingCycle},${amount},${paymentMethod},'pending',${paymentReference},NOW())
      RETURNING id,plan_code,billing_cycle,amount,payment_method,status,created_at
    `;
    return NextResponse.json({payment:rows[0]},{status:201});
  }catch(error){console.error(error);return NextResponse.json({error:'สร้างรายการชำระเงินไม่สำเร็จ'},{status:500})}
}
