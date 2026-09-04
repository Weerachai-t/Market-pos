import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

type Item = { productId: number; quantity: number };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: Item[] = body.items || [];
    const paymentMethod = body.paymentMethod || 'cash';
    if (!items.length) return NextResponse.json({ error: 'ไม่มีสินค้าในตะกร้า' }, { status: 400 });
    if (!['cash','promptpay','transfer'].includes(paymentMethod)) return NextResponse.json({ error: 'วิธีชำระเงินไม่ถูกต้อง' }, { status: 400 });
    const sql = getDb();
    const receiptNo = `POS-${Date.now()}`;
    let total = 0;
    const resolved: Array<{id:number;name:string;quantity:number;price:number;cost:number;lineTotal:number}> = [];
    for (const item of items) {
      const rows = await sql`SELECT id, name, price::float AS price, cost::float AS cost, stock_qty::float AS stock_qty FROM products WHERE id=${item.productId} AND is_active=true`;
      const p = rows[0];
      if (!p || item.quantity <= 0 || Number(p.stock_qty) < item.quantity) return NextResponse.json({ error: `สต๊อกสินค้าไม่เพียงพอ: ${p?.name || item.productId}` }, { status: 400 });
      const lineTotal = Number(p.price) * item.quantity;
      total += lineTotal;
      resolved.push({ id:Number(p.id), name:String(p.name), quantity:item.quantity, price:Number(p.price), cost:Number(p.cost), lineTotal });
    }
    const saleRows = await sql`INSERT INTO sales (receipt_no, subtotal, discount, total, payment_method, cash_received, change_amount) VALUES (${receiptNo}, ${total}, 0, ${total}, ${paymentMethod}, ${body.cashReceived ?? null}, ${body.cashReceived != null ? Math.max(Number(body.cashReceived)-total,0) : null}) RETURNING id, receipt_no`;
    const sale = saleRows[0];
    for (const item of resolved) {
      await sql`INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, cost_price, line_total) VALUES (${sale.id}, ${item.id}, ${item.name}, ${item.quantity}, ${item.price}, ${item.cost}, ${item.lineTotal})`;
      await sql`UPDATE products SET stock_qty=stock_qty-${item.quantity}, updated_at=now() WHERE id=${item.id}`;
      await sql`INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, note) VALUES (${item.id}, 'sale', ${-item.quantity}, 'sale', ${sale.id}, ${`ขาย ${receiptNo}`})`;
    }
    return NextResponse.json({ success:true, saleId:sale.id, receiptNo:sale.receipt_no, total });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'บันทึกการขายไม่สำเร็จ' }, { status: 500 });
  }
}
