import { NextResponse } from 'next/server';
import { getCurrentEmployee, requireTenant } from '../../../lib/auth';
import { getDb } from '../../../lib/db';
import { getSubscriptionContext } from '../../../lib/subscription';

export async function GET() {
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  try{
    const tenantId=requireTenant(employee);
    const sql=getDb();
    const [plans,subscription,billing,payments,branches]=await Promise.all([
      sql`SELECT code,name,monthly_price,yearly_price,user_limit,product_limit,branch_limit,features FROM subscription_plans WHERE is_active=TRUE ORDER BY sort_order`,
      getSubscriptionContext(tenantId),
      sql`SELECT promptpay_target,bank_name,bank_account_name,bank_account_no,contact_text FROM platform_billing_settings WHERE id=1`,
      sql`SELECT id,plan_code,billing_cycle,amount,payment_method,status,payment_reference,created_at,paid_at,approved_at FROM subscription_payments WHERE tenant_id=${tenantId} ORDER BY created_at DESC LIMIT 20`,
      sql`SELECT id,branch_code,name,phone,address,is_active,created_at FROM branches WHERE tenant_id=${tenantId} ORDER BY id`
    ]);
    return NextResponse.json({plans,subscription,billing:billing[0]||{},payments,branches});
  }catch(error){console.error(error);return NextResponse.json({error:'โหลดข้อมูลแพ็กเกจไม่สำเร็จ'},{status:500})}
}
