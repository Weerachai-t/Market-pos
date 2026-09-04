import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const b = await request.json(); const sql = getDb();
    const rows = await sql`UPDATE products SET sku=${b.sku||null}, barcode=${b.barcode||null}, name=${b.name}, category=${b.category||null}, cost=${Number(b.cost||0)}, price=${Number(b.price||0)}, low_stock_qty=${Number(b.low_stock_qty||0)}, unit=${b.unit||'ชิ้น'}, updated_at=now() WHERE id=${id} AND is_active=true RETURNING *`;
    if(!rows.length) return NextResponse.json({error:'ไม่พบสินค้า'},{status:404});
    return NextResponse.json({product:rows[0]});
  } catch(e){console.error(e);return NextResponse.json({error:'แก้ไขสินค้าไม่สำเร็จ'},{status:500});}
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const {id}=await params; const sql=getDb(); await sql`UPDATE products SET is_active=false, updated_at=now() WHERE id=${id}`; return NextResponse.json({success:true}); }
  catch(e){console.error(e);return NextResponse.json({error:'ลบสินค้าไม่สำเร็จ'},{status:500});}
}
