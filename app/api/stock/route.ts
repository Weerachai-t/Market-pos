import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function POST(request:Request){
 try{
  const b=await request.json(); const productId=Number(b.productId); const quantity=Number(b.quantity); const type=b.type==='receive'?'receive':'adjust';
  if(!productId||!Number.isFinite(quantity)||quantity===0)return NextResponse.json({error:'ข้อมูลสต๊อกไม่ถูกต้อง'},{status:400});
  const sql=getDb(); const p=await sql`UPDATE products SET stock_qty=stock_qty+${quantity}, updated_at=now() WHERE id=${productId} AND is_active=true AND stock_qty+${quantity}>=0 RETURNING id,stock_qty`;
  if(!p.length)return NextResponse.json({error:'ไม่พบสินค้า หรือยอดสต๊อกติดลบ'},{status:400});
  await sql`INSERT INTO stock_movements(product_id,movement_type,quantity,reference_type,note) VALUES(${productId},${type},${quantity},'manual',${b.note||null})`;
  return NextResponse.json({success:true,stock_qty:p[0].stock_qty});
 }catch(e){console.error(e);return NextResponse.json({error:'ปรับสต๊อกไม่สำเร็จ'},{status:500});}
}
