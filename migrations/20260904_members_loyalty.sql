CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
  ADD COLUMN IF NOT EXISTS points_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (points_redeemed >= 0),
  ADD COLUMN IF NOT EXISTS points_discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (points_discount >= 0),
  ADD COLUMN IF NOT EXISTS client_reference VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_client_reference
  ON sales(client_reference) WHERE client_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_customer_date
  ON sales(customer_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON customers(phone);

CREATE TABLE IF NOT EXISTS point_transactions (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id BIGINT REFERENCES sales(id) ON DELETE SET NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'adjust')),
  points INTEGER NOT NULL CHECK (points <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT point_transactions_direction_check CHECK (
    (transaction_type = 'earn' AND points > 0) OR
    (transaction_type = 'redeem' AND points < 0) OR
    transaction_type = 'adjust'
  )
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_customer_date
  ON point_transactions(customer_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_sale_type
  ON point_transactions(sale_id, transaction_type)
  WHERE sale_id IS NOT NULL AND transaction_type IN ('earn', 'redeem');

CREATE OR REPLACE FUNCTION process_pos_sale(
  p_items JSONB,
  p_payment_method TEXT,
  p_cash_received NUMERIC DEFAULT NULL,
  p_customer_id BIGINT DEFAULT NULL,
  p_points_to_redeem INTEGER DEFAULT 0,
  p_client_reference TEXT DEFAULT NULL
)
RETURNS TABLE (
  sale_id BIGINT,
  receipt_no VARCHAR,
  subtotal NUMERIC,
  total NUMERIC,
  points_earned INTEGER,
  points_redeemed INTEGER,
  customer_points_balance INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_product RECORD;
  v_customer customers%ROWTYPE;
  v_sale_id BIGINT;
  v_receipt_no VARCHAR(50);
  v_subtotal NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2) := 0;
  v_points_earned INTEGER := 0;
  v_points_redeemed INTEGER := COALESCE(p_points_to_redeem, 0);
  v_balance INTEGER;
  v_existing RECORD;
BEGIN
  IF p_client_reference IS NOT NULL AND btrim(p_client_reference) <> '' THEN
    SELECT s.id, s.receipt_no, s.subtotal, s.total, s.points_earned,
           s.points_redeemed, c.points_balance
      INTO v_existing
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.client_reference = p_client_reference;
    IF FOUND THEN
      RETURN QUERY SELECT v_existing.id, v_existing.receipt_no, v_existing.subtotal,
        v_existing.total, v_existing.points_earned, v_existing.points_redeemed,
        v_existing.points_balance;
      RETURN;
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ไม่มีสินค้าในตะกร้า';
  END IF;
  IF p_payment_method NOT IN ('cash', 'promptpay', 'transfer') THEN
    RAISE EXCEPTION 'วิธีชำระเงินไม่ถูกต้อง';
  END IF;
  IF v_points_redeemed < 0 THEN
    RAISE EXCEPTION 'คะแนนที่แลกต้องไม่ติดลบ';
  END IF;
  IF v_points_redeemed > 0 AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'ต้องเลือกสมาชิกก่อนแลกคะแนน';
  END IF;

  FOR v_item IN
    SELECT x.product_id, SUM(x.quantity)::NUMERIC(12,3) AS quantity
      FROM jsonb_to_recordset(p_items) AS x(product_id BIGINT, quantity NUMERIC)
     GROUP BY x.product_id
     ORDER BY x.product_id
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'ข้อมูลสินค้าไม่ถูกต้อง';
    END IF;
    SELECT id, name, price, cost, stock_qty
      INTO v_product
      FROM products
     WHERE id = v_item.product_id AND is_active = TRUE
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ไม่พบสินค้า %', v_item.product_id;
    END IF;
    IF v_product.stock_qty < v_item.quantity THEN
      RAISE EXCEPTION 'สต๊อกสินค้าไม่เพียงพอ: %', v_product.name;
    END IF;
    v_subtotal := v_subtotal + (v_product.price * v_item.quantity);
  END LOOP;

  IF p_customer_id IS NOT NULL THEN
    SELECT * INTO v_customer FROM customers WHERE id = p_customer_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ไม่พบสมาชิก';
    END IF;
    IF v_points_redeemed > v_customer.points_balance THEN
      RAISE EXCEPTION 'คะแนนคงเหลือไม่เพียงพอ';
    END IF;
  END IF;

  IF v_points_redeemed > FLOOR(v_subtotal) THEN
    RAISE EXCEPTION 'คะแนนที่แลกเกินยอดชำระ';
  END IF;

  v_total := v_subtotal - v_points_redeemed;
  v_points_earned := CASE WHEN p_customer_id IS NULL THEN 0 ELSE FLOOR(v_total / 10)::INTEGER END;

  IF p_payment_method = 'cash' AND (p_cash_received IS NULL OR p_cash_received < v_total) THEN
    RAISE EXCEPTION 'จำนวนเงินสดไม่เพียงพอ';
  END IF;

  v_sale_id := nextval(pg_get_serial_sequence('sales', 'id'));
  v_receipt_no := 'POS-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || v_sale_id;

  INSERT INTO sales (
    id, receipt_no, subtotal, discount, total, payment_method,
    cash_received, change_amount, customer_id, points_earned,
    points_redeemed, points_discount, client_reference
  ) VALUES (
    v_sale_id, v_receipt_no, v_subtotal, v_points_redeemed, v_total, p_payment_method,
    p_cash_received,
    CASE WHEN p_cash_received IS NULL THEN NULL ELSE p_cash_received - v_total END,
    p_customer_id, v_points_earned, v_points_redeemed,
    v_points_redeemed, NULLIF(btrim(p_client_reference), '')
  );

  FOR v_item IN
    SELECT x.product_id, SUM(x.quantity)::NUMERIC(12,3) AS quantity
      FROM jsonb_to_recordset(p_items) AS x(product_id BIGINT, quantity NUMERIC)
     GROUP BY x.product_id
     ORDER BY x.product_id
  LOOP
    SELECT id, name, price, cost INTO v_product
      FROM products WHERE id = v_item.product_id;

    INSERT INTO sale_items (
      sale_id, product_id, product_name, quantity, unit_price, cost_price, line_total
    ) VALUES (
      v_sale_id, v_product.id, v_product.name, v_item.quantity,
      v_product.price, v_product.cost, v_product.price * v_item.quantity
    );

    UPDATE products
       SET stock_qty = stock_qty - v_item.quantity, updated_at = NOW()
     WHERE id = v_product.id;

    INSERT INTO stock_movements (
      product_id, movement_type, quantity, reference_type, reference_id, note
    ) VALUES (
      v_product.id, 'sale', -v_item.quantity, 'sale', v_sale_id, 'ขาย ' || v_receipt_no
    );
  END LOOP;

  IF p_customer_id IS NOT NULL THEN
    v_balance := v_customer.points_balance;
    IF v_points_redeemed > 0 THEN
      v_balance := v_balance - v_points_redeemed;
      INSERT INTO point_transactions (
        customer_id, sale_id, transaction_type, points, balance_after, description
      ) VALUES (
        p_customer_id, v_sale_id, 'redeem', -v_points_redeemed, v_balance,
        'แลกคะแนนในบิล ' || v_receipt_no
      );
    END IF;
    IF v_points_earned > 0 THEN
      v_balance := v_balance + v_points_earned;
      INSERT INTO point_transactions (
        customer_id, sale_id, transaction_type, points, balance_after, description
      ) VALUES (
        p_customer_id, v_sale_id, 'earn', v_points_earned, v_balance,
        'รับคะแนนจากบิล ' || v_receipt_no
      );
    END IF;
    UPDATE customers
       SET points_balance = v_balance,
           total_spent = total_spent + v_total,
           updated_at = NOW()
     WHERE id = p_customer_id;
  ELSE
    v_balance := NULL;
  END IF;

  RETURN QUERY SELECT v_sale_id, v_receipt_no, v_subtotal, v_total,
    v_points_earned, v_points_redeemed, v_balance;
END;
$$;
