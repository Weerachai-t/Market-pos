import { NextResponse } from 'next/server';
import { getCurrentEmployee, isSuperAdmin } from '../../../../../lib/auth';
import { getDb } from '../../../../../lib/db';

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'}, {status:401});
  if (!isSuperAdmin(employee)) return NextResponse.json({error:'สำหรับผู้ดูแลระบบแพลตฟอร์มเท่านั้น'}, {status:403});
  try {
    const {id}=await params;
    const tenantId=Number(id);
    const body=await request.json();
    const status=String(body.status||'');
    const plan=String(body.plan||'standard').trim() || 'standard';
    if (!Number.isInteger(tenantId)||tenantId<=0) return NextResponse.json({error:'รหัสร้านค้าไม่ถูกต้อง'}, {status:400});
    if (!['active','suspended','closed'].includes(status)) return NextResponse.json({error:'สถานะไม่ถูกต้อง'}, {status:400});
    const sql=getDb();
    const rows=await sql`
      UPDATE tenants SET status=${status},plan=${plan},updated_at=NOW()
       WHERE id=${tenantId}
       RETURNING id,account_code,store_name,status,plan,updated_at
    `;
    if (!rows[0]) return NextResponse.json({error:'ไม่พบร้านค้า'}, {status:404});
    return NextResponse.json({tenant:rows[0]});
  } catch(error) {
    console.error(error);
    return NextResponse.json({error:'แก้ไขบัญชีร้านค้าไม่สำเร็จ'}, {status:500});
  }
}
