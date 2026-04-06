import { Order, MenuItem, User, OrderStatus, Account, JournalEntry, Asset } from '../types';
import { supabase } from '../lib/supabase';

// Helper to get local ISO string without offset (Wall Clock Time)
const toLocalISOString = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds());
};

// Helper to parse Supabase date string as local Wall Clock time
const parseSupabaseDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  // Strip timezone/offset and replace space with T
  const clean = dateStr.split('+')[0].split('Z')[0].replace(' ', 'T');
  return new Date(clean);
};

export const orderService = {
  async login(username: string, pass: string): Promise<User | null> {
    console.log('Attempting login for:', username);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', pass)
        .single();
      
      if (error) {
        console.error('Supabase login error:', error);
        return null;
      }
      
      if (!data) {
        console.warn('No user found with those credentials');
        return null;
      }
      
      console.log('Login successful for:', data.username);
      const user: User = {
        user: data.username,
        pass: data.password,
        nama: data.shop_name,
        alamat: data.address || ''
      };
      
      localStorage.setItem('pos_user', JSON.stringify(user));
      return user;
    } catch (err) {
      console.error('Unexpected login error:', err);
      return null;
    }
  },

  logout() {
    localStorage.removeItem('pos_user');
  },

  getCurrentUser(): User | null {
    const saved = localStorage.getItem('pos_user');
    return saved ? JSON.parse(saved) : null;
  },

  async getMenuItems(userId: string): Promise<MenuItem[]> {
    const { data, error } = await supabase
      .from('menu')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });
    
    if (error) {
      console.error("Error fetching menu:", error);
      return [];
    }
    
    return data.map(m => ({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      user: m.user_id
    }));
  },

  async getOrders(userId: string): Promise<Order[]> {
    // Optimization: Only fetch 'proses' orders and 'selesai' orders from TODAY (local)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = toLocalISOString(startOfToday);

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .or(`status.eq.proses,and(status.eq.selesai,created_at.gte.${todayStr})`)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching orders:", error);
      return [];
    }
    
    return data.map(o => ({
      id: o.id,
      queueNumber: o.queue_number,
      customerName: o.customer_name,
      tableNumber: o.table_number || '',
      items: o.items,
      totalPrice: Number(o.total_price),
      status: o.status as OrderStatus,
      payment_method: o.payment_method,
      timestamp: parseSupabaseDate(o.created_at),
      user: o.user_id
    }));
  },

  async getMonthlySalesData(userId: string): Promise<Order[]> {
    // Get start of current year in local time (January 1st)
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfYearStr = toLocalISOString(startOfYear);

    let allData: any[] = [];
    let from = 0;
    let to = 999;
    let finished = false;
    
    // Fetch up to 100,000 orders for yearly report
    while (!finished && allData.length < 100000) {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, total_price, payment_method, status')
        .eq('user_id', userId)
        .eq('status', 'selesai')
        .gte('created_at', startOfYearStr)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) {
        console.error("Error fetching sales chunk:", error);
        break;
      }
      
      if (!data || data.length === 0) {
        break;
      }
      
      allData = [...allData, ...data];
      
      if (data.length < 1000) {
        finished = true;
      } else {
        from += 1000;
        to += 1000;
      }
    }
    
    return allData.map(o => ({
      id: o.id,
      queueNumber: '',
      customerName: '',
      tableNumber: '',
      items: [],
      totalPrice: Number(o.total_price),
      status: o.status as OrderStatus,
      payment_method: o.payment_method,
      timestamp: parseSupabaseDate(o.created_at),
      user: userId
    }));
  },

  async saveOrder(order: Omit<Order, 'id' | 'queueNumber' | 'timestamp'>): Promise<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) throw new Error("Not logged in");

    const now = new Date();
    const localISO = toLocalISOString(now);
    
    // Get today's order count for queue number (using local today)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.user)
      .gte('created_at', toLocalISOString(startOfToday));
    
    if (countError) throw countError;

    const nextQueue = ((count || 0) + 1).toString().padStart(3, '0');

    const { data, error } = await supabase
      .from('orders')
      .insert({
        queue_number: nextQueue,
        customer_name: order.customerName,
        table_number: order.tableNumber,
        items: order.items,
        total_price: order.totalPrice,
        status: order.status,
        payment_method: order.payment_method,
        user_id: currentUser.user,
        created_at: localISO
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, paymentMethod?: 'cash' | 'bank'): Promise<void> {
    const updateData: any = { status: status };
    if (paymentMethod) {
      updateData.payment_method = paymentMethod;
    }

    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);
    
    if (error) {
      console.error('Gagal memperbarui status:', error);
      throw error;
    }

    // Automatic Journal Entry on Completion
    if (status === 'selesai' && order.status !== 'selesai') {
      const transactionId = `T-SALE-${orderId}`;
      const description = `Penjualan: ${order.customer_name} (Antrian ${order.queue_number})`;
      const total = Number(order.total_price);
      const localISO = toLocalISOString(new Date());

      // Debit: Kas (Aset Lancar)
      await supabase.from('journal_entries').insert({
        transaction_id: transactionId,
        account_name: 'Kas',
        description,
        debit: total,
        credit: 0,
        date: localISO,
        user_id: order.user_id
      });

      // Kredit: Penjualan (Pendapatan Usaha)
      await supabase.from('journal_entries').insert({
        transaction_id: transactionId,
        account_name: 'Penjualan',
        description,
        debit: 0,
        credit: total,
        date: localISO,
        user_id: order.user_id
      });
    }
  },

  // --- Accounting Methods ---

  async initializeAccounts(userId: string): Promise<void> {
    const defaultAccounts: Omit<Account, 'id'>[] = [
      { account_code: '1101', account_name: 'Kas', category: 'Aset', sub_category: 'Aset Lancar', user_id: userId },
      { account_code: '1102', account_name: 'Bank', category: 'Aset', sub_category: 'Aset Lancar', user_id: userId },
      { account_code: '1103', account_name: 'Piutang', category: 'Aset', sub_category: 'Aset Lancar', user_id: userId },
      { account_code: '1104', account_name: 'Persediaan Barang', category: 'Aset', sub_category: 'Aset Lancar', user_id: userId },
      { account_code: '1201', account_name: 'Tanah', category: 'Aset', sub_category: 'Aset Tetap', user_id: userId },
      { account_code: '1202', account_name: 'Bangunan', category: 'Aset', sub_category: 'Aset Tetap', user_id: userId },
      { account_code: '1203', account_name: 'Inventaris', category: 'Aset', sub_category: 'Aset Tetap', user_id: userId },
      { account_code: '1204', account_name: 'Kendaraan', category: 'Aset', sub_category: 'Aset Tetap', user_id: userId },
      { account_code: '1299', account_name: 'Akumulasi Penyusutan', category: 'Aset', sub_category: 'Aset Tetap', user_id: userId },
      { account_code: '2101', account_name: 'Utang Usaha', category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', user_id: userId },
      { account_code: '3101', account_name: 'Modal Pemilik', category: 'Ekuitas', sub_category: 'Modal', user_id: userId },
      { account_code: '4101', account_name: 'Penjualan', category: 'Pendapatan', sub_category: 'Pendapatan Usaha', user_id: userId },
      { account_code: '4201', account_name: 'Pendapatan Lainnya', category: 'Pendapatan', sub_category: 'Pendapatan Lainnya', user_id: userId },
      { account_code: '5101', account_name: 'Beban Gaji', category: 'Beban', sub_category: 'Beban Operasional', user_id: userId },
      { account_code: '5102', account_name: 'Beban Listrik', category: 'Beban', sub_category: 'Beban Operasional', user_id: userId },
      { account_code: '5103', account_name: 'Beban ATK', category: 'Beban', sub_category: 'Beban Operasional', user_id: userId },
      { account_code: '5104', account_name: 'Beban Penyusutan', category: 'Beban', sub_category: 'Beban Operasional', user_id: userId },
      { account_code: '5201', account_name: 'Persediaan Awal', category: 'Beban', sub_category: 'Beban HPP', user_id: userId },
      { account_code: '5202', account_name: 'Pembelian', category: 'Beban', sub_category: 'Beban HPP', user_id: userId },
      { account_code: '5203', account_name: 'Persediaan Akhir', category: 'Beban', sub_category: 'Beban HPP', user_id: userId },
      { account_code: '5204', account_name: 'HPP', category: 'Beban', sub_category: 'Beban HPP', user_id: userId },
      { account_code: '5901', account_name: 'Beban Lainnya', category: 'Beban', sub_category: 'Beban Lainnya', user_id: userId },
    ];

    // Check if accounts already exist
    const { count } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (count === 0) {
      await supabase.from('accounts').insert(defaultAccounts);
    }
  },

  async getAccounts(userId: string): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId);
    
    if (error) return [];
    
    // Sort client-side to be safe if account_code column is missing or null
    return (data as Account[]).sort((a, b) => {
      const codeA = a.account_code || '';
      const codeB = b.account_code || '';
      if (codeA && codeB) return codeA.localeCompare(codeB);
      if (codeA) return -1;
      if (codeB) return 1;
      return a.account_name.localeCompare(b.account_name);
    });
  },

  async saveAccount(account: Omit<Account, 'id'>): Promise<any> {
    const { data, error } = await supabase
      .from('accounts')
      .insert(account)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAccount(id: string): Promise<void> {
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) throw error;
  },

  async getJournalEntries(userId: string, startDate?: string, endDate?: string): Promise<JournalEntry[]> {
    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    
    if (startDate) query = query.gte('date', startDate);
    if (endDate) {
      // If endDate is just a date (YYYY-MM-DD), make it end of day
      const finalEndDate = endDate.includes('T') ? endDate : `${endDate}T23:59:59`;
      query = query.lte('date', finalEndDate);
    }

    const { data, error } = await query;
    if (error) return [];
    return data;
  },

  async saveJournalEntry(entries: Omit<JournalEntry, 'id'>[]): Promise<void> {
    const { error } = await supabase
      .from('journal_entries')
      .insert(entries);
    if (error) throw error;
  },

  async getAssets(userId: string): Promise<Asset[]> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('user_id', userId)
      .order('purchase_date', { ascending: false });
    
    if (error) return [];
    return data;
  },

  async saveAsset(asset: Omit<Asset, 'id'>): Promise<any> {
    const { data, error } = await supabase
      .from('assets')
      .insert(asset)
      .select()
      .single();
    if (error) throw error;

    // Automatic Journal Entry for Asset Purchase
    const transactionId = `T-ASSET-${data.id}`;
    const localISO = toLocalISOString(new Date());

    await this.saveJournalEntry([
      {
        transaction_id: transactionId,
        account_name: asset.jenis, // e.g., 'Inventaris'
        description: `Pembelian Aset: ${asset.name}`,
        debit: asset.acquisition_cost,
        credit: 0,
        date: localISO,
        user_id: asset.user_id
      },
      {
        transaction_id: transactionId,
        account_name: 'Kas',
        description: `Pembelian Aset: ${asset.name}`,
        debit: 0,
        credit: asset.acquisition_cost,
        date: localISO,
        user_id: asset.user_id
      }
    ]);

    return data;
  },

  async deleteAsset(id: string): Promise<void> {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) throw error;
  },

  async saveMenuItem(item: Omit<MenuItem, 'id'>): Promise<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) throw new Error("Not logged in");

    const localISO = toLocalISOString(new Date());

    const { data, error } = await supabase
      .from('menu')
      .insert({
        name: item.name,
        price: item.price,
        user_id: currentUser.user,
        created_at: localISO
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateMenuItem(id: string, item: Partial<MenuItem>): Promise<any> {
    const { data, error } = await supabase
      .from('menu')
      .update({
        name: item.name,
        price: item.price
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
