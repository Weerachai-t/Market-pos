import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getCurrentEmployee, hasPermission, requireTenant } from '../../../lib/auth';
import { assertPlanLimit, requireActiveSubscription } from '../../../lib/subscription';

const IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i;
const MAX_IMAGE_LENGTH = 1_200_000;

function productImage(value:unknown) {
  if (!value) return null;
  if (typeof value !== 'string' || value.length > MAX_IMAGE_LENGTH || !IMAGE_PATTERN.test(value)) throw new Error('INVALID_PRODUCT_IMAGE');
  return value;
}

export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error:'กรุณาเข้าสู่ระบบ' }, { status:401 });
  try {
    const tenantId = requireTenant(employee);
    const sql = getDb();
    const products = await sql`
      SELECT id, sku, barcode, qr_code, name, category, cost, price, stock_qty,
             low_stock_qty, unit, image_url, is_active
        FROM products WHERE tenant_id=${tenantId} AND is_active=TRUE ORDER BY id
    `;
    return NextResponse.json({ products });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error:'Database connection failed' }, { status:500 });
  }
}

export async function POST(request:Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error:'กรุณาเข้าสู่ระบบ' }, { status:401 });
  if (!hasPermission(employee, 'manage_products')) return NextResponse.json({ error:'ไม่มีสิทธิ์จัดการสินค้า' }, { status:403 });
  try {
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error:'กรุณาระบุชื่อสินค้า' }, { status:400 });
    const imageUrl = productImage(body.image_url);
    const tenantId = requireTenant(employee);
    const subscription = await requireActiveSubscription(tenantId);
    assertPlanLimit(subscription,'products');
    const sql = getDb();
    const rows = await sql`
      INSERT INTO products
        (tenant_id, sku, barcode, qr_code, name, category, cost, price, stock_qty, low_stock_qty, unit, image_url)
      VALUES
        (${tenantId}, ${body.sku || null}, ${body.barcode || null}, ${body.qr_code || null}, ${body.name},
         ${body.category || null}, ${Number(body.cost || 0)}, ${Number(body.price || 0)},
         ${Number(body.stock_qty || 0)}, ${Number(body.low_stock_qty || 0)}, ${body.unit || 'ชิ้น'}, ${imageUrl})
      RETURNING *
    `;
    return NextResponse.json({ product:rows[0] }, { status:201 });
  } catch (error) {
    const message=error instanceof Error?error.message:'';
    if(message==='SUBSCRIPTION_EXPIRED')return NextResponse.json({error:'แพ็กเกจหมดอายุ กรุณาต่ออายุสมาชิก'},{status:402});
    if(message==='PLAN_LIMIT_PRODUCTS')return NextResponse.json({error:'จำนวนสินค้าถึงขีดจำกัดของแพ็กเกจแล้ว กรุณาอัปเกรดแพ็กเกจ'},{status:403});
    if (error instanceof Error && error.message === 'INVALID_PRODUCT_IMAGE') return NextResponse.json({ error:'รูปสินค้าต้องเป็น JPG, PNG หรือ WebP และมีขนาดไม่เกินที่กำหนด' }, { status:400 });
    console.error(error);
    return NextResponse.json({ error:'ไม่สามารถเพิ่มสินค้าได้' }, { status:500 });
  }
}
