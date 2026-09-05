import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getCurrentEmployee, hasPermission } from '../../../../lib/auth';

const IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i;

function productImage(value:unknown) {
  if (!value) return null;
  if (typeof value !== 'string' || value.length > 1_200_000 || !IMAGE_PATTERN.test(value)) throw new Error('INVALID_PRODUCT_IMAGE');
  return value;
}

export async function PATCH(request:Request, { params }:{ params:Promise<{id:string}> }) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error:'กรุณาเข้าสู่ระบบ' }, { status:401 });
  if (!hasPermission(employee, 'manage_products')) return NextResponse.json({ error:'ไม่มีสิทธิ์จัดการสินค้า' }, { status:403 });
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error:'กรุณาระบุชื่อสินค้า' }, { status:400 });
    const imageUrl = productImage(body.image_url);
    const sql = getDb();
    const rows = await sql`
      UPDATE products
         SET sku=${body.sku || null}, barcode=${body.barcode || null}, qr_code=${body.qr_code || null},
             name=${body.name}, category=${body.category || null}, cost=${Number(body.cost || 0)},
             price=${Number(body.price || 0)}, low_stock_qty=${Number(body.low_stock_qty || 0)},
             unit=${body.unit || 'ชิ้น'}, image_url=${imageUrl}, updated_at=NOW()
       WHERE id=${id} AND is_active=TRUE RETURNING *
    `;
    if (!rows.length) return NextResponse.json({ error:'ไม่พบสินค้า' }, { status:404 });
    return NextResponse.json({ product:rows[0] });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PRODUCT_IMAGE') return NextResponse.json({ error:'รูปสินค้าต้องเป็น JPG, PNG หรือ WebP และมีขนาดไม่เกินที่กำหนด' }, { status:400 });
    console.error(error);
    return NextResponse.json({ error:'แก้ไขสินค้าไม่สำเร็จ' }, { status:500 });
  }
}

export async function DELETE(_:Request, { params }:{ params:Promise<{id:string}> }) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error:'กรุณาเข้าสู่ระบบ' }, { status:401 });
  if (!hasPermission(employee, 'manage_products')) return NextResponse.json({ error:'ไม่มีสิทธิ์จัดการสินค้า' }, { status:403 });
  try {
    const { id } = await params;
    const sql = getDb();
    await sql`UPDATE products SET is_active=FALSE, updated_at=NOW() WHERE id=${id}`;
    return NextResponse.json({ success:true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error:'ลบสินค้าไม่สำเร็จ' }, { status:500 });
  }
}
