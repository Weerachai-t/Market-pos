ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS email VARCHAR(200),
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{"sell":true,"manage_products":false,"view_reports":false,"manage_customers":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower
  ON users (LOWER(username));

CREATE TABLE IF NOT EXISTS employee_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_sessions_user
  ON employee_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_expiry
  ON employee_sessions(expires_at);

CREATE TABLE IF NOT EXISTS system_state (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_state (key, value)
VALUES ('admin_initialized', CASE WHEN EXISTS (SELECT 1 FROM users) THEN 'true' ELSE 'false' END)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION process_pos_sale_by_cashier(
  p_items JSONB,
  p_payment_method TEXT,
  p_cash_received NUMERIC DEFAULT NULL,
  p_customer_id BIGINT DEFAULT NULL,
  p_points_to_redeem INTEGER DEFAULT 0,
  p_client_reference TEXT DEFAULT NULL,
  p_cashier_id BIGINT DEFAULT NULL
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
  v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM process_pos_sale(
    p_items, p_payment_method, p_cash_received, p_customer_id,
    p_points_to_redeem, p_client_reference
  );
  UPDATE sales SET cashier_id=p_cashier_id
   WHERE id=v_result.sale_id AND cashier_id IS NULL;
  RETURN QUERY SELECT v_result.sale_id, v_result.receipt_no, v_result.subtotal,
    v_result.total, v_result.points_earned, v_result.points_redeemed,
    v_result.customer_points_balance;
END;
$$;
