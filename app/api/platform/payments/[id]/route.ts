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
        UPDATE subscription_payments
           SET status='rejected',approved_at=NOW(),approved_by=${employee.id}
         WHERE id=${paymentId} AND status='pending'
         RETURNING id,status
      `;
      if(!rows[0])return NextResponse.json({error:'รายการนี้ถูกดำเนินการแล้ว'},{status:409});
      return NextResponse.json({payment:rows[0]});
    }

    const rows=await sql`
      SELECT * FROM approve_subscription_payment(${paymentId},${employee.id})
    `;
    if(!rows[0])return NextResponse.json({error:'ไม่พบข้อมูลการสมัครสมาชิก'},{status:404});
    return NextResponse.json({subscription:rows[0]});
  }catch(error){
    console.error(error);
    const message=error instanceof Error?error.message:'';
    if(message.includes('PAYMENT_NOT_FOUND'))return NextResponse.json({error:'ไม่พบรายการชำระเงิน'},{status:404});
    if(message.includes('PAYMENT_ALREADY_PROCESSED'))return NextResponse.json({error:'รายการนี้ถูกดำเนินการแล้ว'},{status:409});
    return NextResponse.json({error:'อนุมัติการชำระเงินไม่สำเร็จ'},{status:500});
  }
}
