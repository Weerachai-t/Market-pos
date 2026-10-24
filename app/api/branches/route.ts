import { NextResponse } from 'next/server';
import { getCurrentEmployee, hasPermission, requireTenant } from '../../../lib/auth';
import { getDb } from '../../../lib/db';
import { assertPlanLimit, requireActiveSubscription } from '../../../lib/subscription';

export async function GET(){
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  const tenantId=requireTenant(employee);
  const sql=getDb();
  const branches=await sql`SELECT id,branch_code,name,phone,address,is_active,created_at FROM branches WHERE tenant_id=${tenantId} ORDER BY id`;
  return NextResponse.json({branches});
}

export async function POST(request:Request){
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  if(!hasPermission(employee,'manage_employees'))return NextResponse.json({error:'เฉพาะ Admin ร้านค้าเท่านั้น'},{status:403});
  try{
    const tenantId=requireTenant(employee);
    const subscription=await requireActiveSubscription(tenantId);
    assertPlanLimit(subscription,'branches');
    const body=await request.json();
    const name=String(body.name||'').trim();
    const branchCode=String(body.branchCode||'').trim().toUpperCase();
    if(!name||!branchCode)return NextResponse.json({error:'กรุณากรอกชื่อและรหัสสาขา'},{status:400});
    const sql=getDb();
    const rows=await sql`
      INSERT INTO branches(tenant_id,branch_code,name,phone,address)
      VALUES(${tenantId},${branchCode},${name},${String(body.phone||'').replace(/\D/g,'')||null},${String(body.address||'').trim()||null})
      RETURNING *
    `;
    return NextResponse.json({branch:rows[0]},{status:201});
  }catch(error){
    const message=error instanceof Error?error.message:'';
    if(message==='SUBSCRIPTION_EXPIRED')return NextResponse.json({error:'แพ็กเกจหมดอายุ กรุณาต่ออายุสมาชิก'},{status:402});
    if(message==='PLAN_LIMIT_BRANCHES')return NextResponse.json({error:'จำนวนสาขาถึงขีดจำกัดของแพ็กเกจแล้ว กรุณาอัปเกรดแพ็กเกจ'},{status:403});
    console.error(error);return NextResponse.json({error:'เพิ่มสาขาไม่สำเร็จ'},{status:500});
  }
}
