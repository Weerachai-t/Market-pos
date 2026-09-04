import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getCurrentEmployee, hasPermission } from '../../../lib/auth';

type Item = { productId?: number; product_id?: number; quantity: number };

export async function POST(request: Request) {
  const employee=await getCurrentEmployee();
  if(!employee)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  if(!hasPermission(employee,'sell'))return NextResponse.json({error:'ไม่มีสิทธิ์ขายสินค้า'},{status:403});
  try {
    const body = await request.json();
    const items: Item[] = Array.isArray(body.items) ? body.items : [];
    const paymentMethod = String(body.paymentMethod || 'cash');
    const customerId = body.customerId == null ? null : Number(body.customerId);
    const redeemPoints = Number(body.redeemPoints || 0);
    const clientReference = String(body.clientReference || '').trim() || null;

    if (!items.length) return NextResponse.json({ error: 'ไม่มีสินค้าในตะกร้า' }, { status: 400 });
    if (!['cash', 'promptpay', 'transfer'].includes(paymentMethod)) return NextResponse.json({ error: 'วิธีชำระเงินไม่ถูกต้อง' }, { status: 400 });
    if (!Number.isInteger(redeemPoints) || redeemPoints < 0) return NextResponse.json({ error: 'คะแนนที่แลกไม่ถูกต้อง' }, { status: 400 });

    const dbItems = items.map((item) => ({
      product_id: Number(item.productId ?? item.product_id),
      quantity: Number(item.quantity),
    }));
    if (dbItems.some((item) => !Number.isInteger(item.product_id) || item.product_id <= 0 || !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      return NextResponse.json({ error: 'ข้อมูลสินค้าไม่ถูกต้อง' }, { status: 400 });
    }

    const sql = getDb();
    const cashReceived = body.cashReceived == null ? null : Number(body.cashReceived);
    const rows = await sql`
      SELECT * FROM process_pos_sale_by_cashier(
        ${JSON.stringify(dbItems)}::jsonb,
        ${paymentMethod},
        ${cashReceived},
        ${customerId},
        ${redeemPoints},
        ${clientReference},
        ${employee.id}
      )
    `;
    const sale = rows[0];

    return NextResponse.json({
      success: true,
      saleId: Number(sale.sale_id),
      receiptNo: sale.receipt_no,
      subtotal: Number(sale.subtotal),
      total: Number(sale.total),
      pointsEarned: Number(sale.points_earned),
      pointsRedeemed: Number(sale.points_redeemed),
      customerPointsBalance: sale.customer_points_balance == null ? null : Number(sale.customer_points_balance),
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'บันทึกการขายไม่สำเร็จ';
    const known = ['ไม่มีสินค้า', 'ไม่ถูกต้อง', 'ไม่เพียงพอ', 'ไม่พบ', 'ต้องเลือก', 'เกินยอด'];
    const isKnown = known.some((text) => message.includes(text));
    return NextResponse.json({ error: isKnown ? message : 'บันทึกการขายไม่สำเร็จ' }, { status: isKnown ? 400 : 500 });
  }
}
