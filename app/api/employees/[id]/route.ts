import { NextResponse } from 'next/server';
import { getCurrentEmployee, hashPassword, hasPermission } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';

export async function PATCH(request:Request, context:{params:Promise<{id:string}>}) {
  const current = await getCurrentEmployee();
  if (!current) return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'}, {status:401});
  if (!hasPermission(current,'manage_employees')) return NextResponse.json({error:'ไม่มีสิทธิ์จัดการพนักงาน'}, {status:403});
  try {
    const {id} = await context.params;
    const employeeId = Number(id);
    if (!Number.isInteger(employeeId)) return NextResponse.json({error:'รหัสพนักงานไม่ถูกต้อง'}, {status:400});
    const body = await request.json();
    const displayName = String(body.displayName||'').trim();
    if (!displayName) return NextResponse.json({error:'กรุณากรอกชื่อพนักงาน'}, {status:400});
    if (body.password && String(body.password).length < 8) return NextResponse.json({error:'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัว'}, {status:400});
    const sql = getDb();
    const [target] = await sql`SELECT id, role, is_active FROM users WHERE id=${employeeId}`;
    if (!target) return NextResponse.json({error:'ไม่พบพนักงาน'}, {status:404});
    const nextRole = body.role === 'admin' ? 'admin' : 'cashier';
    const nextActive = body.isActive !== false;
    if (employeeId === current.id && (!nextActive || nextRole !== 'admin')) return NextResponse.json({error:'ไม่สามารถปิดหรือเปลี่ยนสิทธิ์บัญชีที่กำลังใช้งาน'}, {status:400});
    if (target.role === 'admin' && (nextRole !== 'admin' || !nextActive)) {
      const [count] = await sql`SELECT COUNT(*)::int AS count FROM users WHERE role='admin' AND is_active=TRUE`;
      if (Number(count.count) <= 1) return NextResponse.json({error:'ระบบต้องมี Admin ที่ใช้งานได้อย่างน้อย 1 คน'}, {status:400});
    }
    const permissions = body.permissions && typeof body.permissions === 'object' ? {
      sell:body.permissions.sell === true,
      manage_products:body.permissions.manage_products === true,
      view_reports:body.permissions.view_reports === true,
      manage_customers:body.permissions.manage_customers === true,
    } : {};
    const passwordHash = body.password ? await hashPassword(String(body.password)) : null;
    const rows = await sql`
      UPDATE users SET
        display_name=${displayName},
        phone=${String(body.phone||'').replace(/\D/g,'')||null},
        email=${String(body.email||'').trim()||null},
        role=${nextRole}, permissions=${JSON.stringify(permissions)}::jsonb,
        is_active=${nextActive},
        password_hash=COALESCE(${passwordHash},password_hash), updated_at=NOW()
      WHERE id=${employeeId}
      RETURNING id, username, display_name, phone, email, role, permissions, is_active, last_login_at
    `;
    return NextResponse.json({employee:rows[0]});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error:'แก้ไขพนักงานไม่สำเร็จ'}, {status:500});
  }
}
