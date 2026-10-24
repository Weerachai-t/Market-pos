import { NextResponse } from 'next/server';
import { getCurrentEmployee, isSuperAdmin } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';

export async function GET(){
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  if(!isSuperAdmin(employee))return NextResponse.json({error:'สำหรับ Super Admin เท่านั้น'},{status:403});
  const sql=getDb();
  const rows=await sql`SELECT promptpay_target,bank_name,bank_account_name,bank_account_no,contact_text FROM platform_billing_settings WHERE id=1`;
  return NextResponse.json({billing:rows[0]||{}});
}

export async function PATCH(request:Request){
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  if(!isSuperAdmin(employee))return NextResponse.json({error:'สำหรับ Super Admin เท่านั้น'},{status:403});
  try{
    const body=await request.json();
    const sql=getDb();
    const rows=await sql`
      UPDATE platform_billing_settings SET
        promptpay_target=${String(body.promptpayTarget||'').trim()||null},
        bank_name=${String(body.bankName||'').trim()||null},
        bank_account_name=${String(body.bankAccountName||'').trim()||null},
        bank_account_no=${String(body.bankAccountNo||'').trim()||null},
        contact_text=${String(body.contactText||'').trim()||null},
        updated_at=NOW()
      WHERE id=1
      RETURNING promptpay_target,bank_name,bank_account_name,bank_account_no,contact_text
    `;
    return NextResponse.json({billing:rows[0]});
  }catch(error){console.error(error);return NextResponse.json({error:'บันทึกช่องทางชำระเงินไม่สำเร็จ'},{status:500})}
}
