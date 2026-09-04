import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function GET() {
  try {
    const sql = getDb();
    const products = await sql`SELECT id, sku, barcode, name, category, cost, price, stock_qty, low_stock_qty, unit, image_url, is_active FROM products WHERE is_active = true ORDER BY id`;
    return NextResponse.json({ products });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sku, barcode, name, category, cost = 0, price = 0, stock_qty = 0, low_stock_qty = 0, unit = 'ชิ้น' } = body;
    if (!name) return NextResponse.json({ error: 'กรุณาระบุชื่อสินค้า' }, { status: 400 });
    const sql = getDb();
    const rows = await sql`INSERT INTO products (sku, barcode, name, category, cost, price, stock_qty, low_stock_qty, unit) VALUES (${sku || null}, ${barcode || null}, ${name}, ${category || null}, ${cost}, ${price}, ${stock_qty}, ${low_stock_qty}, ${unit}) RETURNING *`;
    return NextResponse.json({ product: rows[0] }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'ไม่สามารถเพิ่มสินค้าได้' }, { status: 500 });
  }
}
