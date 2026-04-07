-- SQL Setup for NanoKasir POS
-- Copy and paste this into your Supabase SQL Editor

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- In production, use Supabase Auth instead of plain text
  shop_name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Menu Table
CREATE TABLE IF NOT EXISTS menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  user_id TEXT NOT NULL, -- References users.username for simplicity in this app
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  table_number TEXT,
  items JSONB NOT NULL,
  total_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'proses', -- 'proses', 'selesai', 'batal'
  user_id TEXT NOT NULL, -- References users.username
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code TEXT,
  account_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Aset', 'Kewajiban', 'Ekuitas', 'Pendapatan', 'Beban'
  sub_category TEXT,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_name, user_id)
);

-- 5. Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  description TEXT,
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  date TIMESTAMP NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Assets Table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  purchase_date TIMESTAMP NOT NULL,
  acquisition_cost NUMERIC NOT NULL,
  kelompok TEXT NOT NULL, -- '1', '2', '3', '4', 'BP', 'BTP'
  jenis TEXT NOT NULL, -- 'Inventaris', 'Bangunan', etc
  user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS (Optional but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Simple public access policies (for demo/prototype)
CREATE POLICY "Public Access" ON users FOR ALL USING (true);
CREATE POLICY "Public Access" ON menu FOR ALL USING (true);
CREATE POLICY "Public Access" ON orders FOR ALL USING (true);
CREATE POLICY "Public Access" ON accounts FOR ALL USING (true);
CREATE POLICY "Public Access" ON journal_entries FOR ALL USING (true);
CREATE POLICY "Public Access" ON assets FOR ALL USING (true);

-- Insert a sample user (Optional)
-- INSERT INTO users (username, password, shop_name, address) 
-- VALUES ('0601', '123456', 'Warung JxxCuk', 'Jl. Contoh No. 123');
