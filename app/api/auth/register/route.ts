import { NextResponse } from 'next/server';
import { createSession, hashPassword } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';
import { randomBytes } from 'crypto';

export async function POST(request:Request) {
  try {
    const body = await request.json();
    const storeName = String(body.storeName || '').trim();
    const ownerName = String(body.ownerName || '').trim();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const phone = String(body.phone || '').replace(/\D/g,'');
    const email = String(body.email || '').trim().toLowerCase() || null;

    if (!storeName) return NextResponse.json({error:'กรุณากรอกชื่อร้านค้า'}, {status:400});
    if (!ownerName) return NextResponse.json({error:'กรุณากรอกชื่อเจ้าของร้าน'}, {status:400});
    if (!/^[a-z0-9._-]{3,50}$/.test(username)) return NextResponse.json({error:'ชื่อผู้ใช้ต้องมี 3–50 ตัว ใช้ภาษาอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง'}, {status:400});
    if (password.length < 8) return NextResponse.json({error:'รหัสผ่านต้องมีอย่างน้อย 8 ตัว'}, {status:400});

    const passwordHash = await hashPassword(password);
    const accountCode = 'SHOP-' + Date.now().toString(36).toUpperCase() + '-' + randomBytes(2).toString('hex').toUpperCase();
    const sql = getDb();
    const rows = await sql`
      WITH new_tenant AS (
        INSERT INTO tenants(account_code,store_name,owner_name,phone,email,status,plan)
        VALUES(${accountCode},${storeName},${ownerName},${phone||null},${email},'active','starter')
        RETURNING id,account_code,store_name
      ),
      new_settings AS (
        INSERT INTO tenant_settings(tenant_id)
        SELECT id FROM new_tenant
        RETURNING tenant_id
      ),
      new_branch AS (
        INSERT INTO branches(tenant_id,branch_code,name)
        SELECT id,'MAIN','สาขาหลัก' FROM new_tenant
        RETURNING tenant_id
      ),
      new_subscription AS (
        INSERT INTO subscriptions(tenant_id,plan_code,billing_cycle,status,starts_at,expires_at)
        SELECT id,'starter','trial','trial',NOW(),NOW()+INTERVAL '30 days' FROM new_tenant
        RETURNING tenant_id
      ),
      new_user AS (
        INSERT INTO users(tenant_id,platform_role,username,display_name,password_hash,phone,email,role,permissions)
        SELECT id,'tenant_admin',${username},${ownerName},${passwordHash},${phone||null},${email},'admin','{}'::jsonb
        FROM new_tenant
        RETURNING id,tenant_id,username,display_name
      )
      SELECT u.id,u.tenant_id,u.username,u.display_name,t.account_code,t.store_name
      FROM new_user u JOIN new_tenant t ON t.id=u.tenant_id
    `;
    const user = rows[0];
    await createSession(Number(user.id));
    return NextResponse.json({success:true,account:user}, {status:201});
  } catch (error) {
    console.error(error);
    const duplicate = error instanceof Error && /unique|duplicate/i.test(error.message);
    return NextResponse.json({error:duplicate?'ชื่อผู้ใช้นี้มีอยู่แล้ว':'สมัครร้านค้าไม่สำเร็จ'}, {status:duplicate?409:500});
  }
}
