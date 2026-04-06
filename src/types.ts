/// <reference types="vite/client" />

export interface User {
  user: string;
  pass: string;
  nama: string;
  alamat: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  user: string;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
}

export type OrderStatus = 'proses' | 'selesai' | 'batal';

export interface Order {
  id: string;
  queueNumber: string;
  customerName: string;
  tableNumber: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  timestamp: string | number | Date;
  user: string;
  payment_method?: 'cash' | 'bank';
}

export interface DailySales {
  date: string;
  total: number;
}

export type AccountCategory = 'Aset' | 'Kewajiban' | 'Ekuitas' | 'Pendapatan' | 'Beban';

export interface Account {
  id: string;
  account_code?: string;
  account_name: string;
  category: AccountCategory;
  sub_category: string;
  user_id: string;
  balance?: number; // Calculated field
}

export interface JournalEntry {
  id: string;
  transaction_id: string;
  account_name: string;
  description: string;
  debit: number;
  credit: number;
  date: string;
  user_id: string;
}

export interface Asset {
  id: string;
  name: string;
  kelompok: string;
  purchase_date: string;
  acquisition_cost: number;
  jenis: string;
  user_id: string;
}
