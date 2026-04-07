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

  async register(username: string, pass: string, shopName: string, address: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          username,
          password: pass,
          shop_name: shopName,
          address
        })
        .select()
        .single();

      if (error) {
        console.error('Registration error:', error);
        throw error;
      }

      // Initialize accounts for new user
      await this.initializeAccounts(username);

      const user: User = {
        user: data.username,
        pass: data.password,
        nama: data.shop_name,
        alamat: data.address || ''
      };

      localStorage.setItem('pos_user', JSON.stringify(user));
      return user;
    } catch (err) {
      console.error('Unexpected registration error:', err);
      throw err;
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
      { category: 'Aset', sub_category: 'Aset Lancar', account_name: 'Piutang', user_id: userId, account_code: '1201' },
      { category: 'Aset', sub_category: 'Aset Lancar', account_name: 'Deposito', user_id: userId, account_code: '1103' },
      { category: 'Aset', sub_category: 'Aset Lancar', account_name: 'Kas', user_id: userId, account_code: '1101' },
      { category: 'Aset', sub_category: 'Aset Lancar', account_name: 'Bank', user_id: userId, account_code: '1102' },
      { category: 'Aset', sub_category: 'Aset Lancar', account_name: 'Persediaan Barang', user_id: userId, account_code: '1301' },
      { category: 'Aset', sub_category: 'Aset Lancar', account_name: 'Sewa Dibayar di Muka', user_id: userId, account_code: '1501' },
      { category: 'Aset', sub_category: 'Aset Lancar', account_name: 'Perlengkapan Kantor', user_id: userId, account_code: '1401' },
      { category: 'Aset', sub_category: 'Aset Lancar', account_name: 'Asuransi Dibayar di Muka', user_id: userId, account_code: '1502' },
      { category: 'Aset', sub_category: 'Aset Takberwujud', account_name: 'Hak Paten', user_id: userId, account_code: '1801' },
      { category: 'Aset', sub_category: 'Aset Takberwujud', account_name: 'Merek Dagang', user_id: userId, account_code: '1802' },
      { category: 'Aset', sub_category: 'Aset Takberwujud', account_name: 'Goodwill', user_id: userId, account_code: '1804' },
      { category: 'Aset', sub_category: 'Aset Takberwujud', account_name: 'Software/Perangkat Lunak', user_id: userId, account_code: '1803' },
      { category: 'Aset', sub_category: 'Aset Tetap', account_name: 'Kendaraan', user_id: userId, account_code: '1703' },
      { category: 'Aset', sub_category: 'Aset Tetap', account_name: 'Peralatan', user_id: userId, account_code: '1704' },
      { category: 'Aset', sub_category: 'Aset Tetap', account_name: 'Tanah', user_id: userId, account_code: '1701' },
      { category: 'Aset', sub_category: 'Aset Tetap', account_name: 'Bangunan', user_id: userId, account_code: '1702' },
      { category: 'Aset', sub_category: 'Aset Tetap', account_name: 'Akumulasi Penyusutan', user_id: userId, account_code: '1799' },
      { category: 'Aset', sub_category: 'Aset Tidak Lancar Lainnya', account_name: 'Uang Jaminan/Deposit', user_id: userId, account_code: '1902' },
      { category: 'Aset', sub_category: 'Aset Tidak Lancar Lainnya', account_name: 'Piutang Jangka Panjang', user_id: userId, account_code: '1901' },
      { category: 'Beban', sub_category: 'Beban HPP', account_name: 'Persediaan Akhir', user_id: userId, account_code: '5103' },
      { category: 'Beban', sub_category: 'Beban HPP', account_name: 'Persediaan Awal', user_id: userId, account_code: '5101' },
      { category: 'Beban', sub_category: 'Beban HPP', account_name: 'Pembelian', user_id: userId, account_code: '5102' },
      { category: 'Beban', sub_category: 'Beban Lainnya', account_name: 'Beban Bunga Pinjaman', user_id: userId, account_code: '8102' },
      { category: 'Beban', sub_category: 'Beban Lainnya', account_name: 'Beban Administrasi Bank', user_id: userId, account_code: '8101' },
      { category: 'Beban', sub_category: 'Beban Lainnya', account_name: 'Kerugian Penjualan Aset Tetap', user_id: userId, account_code: '8105' },
      { category: 'Beban', sub_category: 'Beban Lainnya', account_name: 'Beban Pajak Bunga Bank', user_id: userId, account_code: '8104' },
      { category: 'Beban', sub_category: 'Beban Lainnya', account_name: 'Kerugian Selisih Kurs', user_id: userId, account_code: '8103' },
      { category: 'Beban', sub_category: 'Beban Operasional', account_name: 'Beban Listrik', user_id: userId, account_code: '6102' },
      { category: 'Beban', sub_category: 'Beban Operasional', account_name: 'Beban Gaji', user_id: userId, account_code: '6101' },
      { category: 'Beban', sub_category: 'Beban Operasional', account_name: 'Beban ATK', user_id: userId, account_code: '6103' },
      { category: 'Beban', sub_category: 'Beban Operasional', account_name: 'Beban Penyusutan', user_id: userId, account_code: '6104' },
      { category: 'Beban', sub_category: 'Beban Operasional', account_name: 'Beban Lainnya', user_id: userId, account_code: '6199' },
      { category: 'Aset', sub_category: 'Investasi Jangka Panjang', account_name: 'Investasi Saham', user_id: userId, account_code: '1601' },
      { category: 'Aset', sub_category: 'Investasi Jangka Panjang', account_name: 'Properti Investasi', user_id: userId, account_code: '1603' },
      { category: 'Aset', sub_category: 'Investasi Jangka Panjang', account_name: 'Investasi Obligasi', user_id: userId, account_code: '1602' },
      { category: 'Ekuitas', sub_category: 'Modal', account_name: 'Dividen / Prive', user_id: userId, account_code: '3103' },
      { category: 'Ekuitas', sub_category: 'Modal', account_name: 'Modal Pemilik', user_id: userId, account_code: '3101' },
      { category: 'Ekuitas', sub_category: 'Modal', account_name: 'Laba Ditahan', user_id: userId, account_code: '3102' },
      { category: 'Pendapatan', sub_category: 'Pendapatan Lainnya', account_name: 'Pendapatan Bunga Bank', user_id: userId, account_code: '7101' },
      { category: 'Pendapatan', sub_category: 'Pendapatan Lainnya', account_name: 'Keuntungan Selisih Kurs', user_id: userId, account_code: '7102' },
      { category: 'Pendapatan', sub_category: 'Pendapatan Lainnya', account_name: 'Pendapatan Lainnya', user_id: userId, account_code: '4201' },
      { category: 'Pendapatan', sub_category: 'Pendapatan Lainnya', account_name: 'Keuntungan Penjualan Aset Tetap', user_id: userId, account_code: '7103' },
      { category: 'Pendapatan', sub_category: 'Pendapatan Usaha', account_name: 'Penjualan', user_id: userId, account_code: '4101' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Panjang', account_name: 'Utang Bank', user_id: userId, account_code: '2201' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Panjang', account_name: 'Utang Obligasi', user_id: userId, account_code: '2202' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', account_name: 'Utang Gaji', user_id: userId, account_code: '2108' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', account_name: 'Pendapatan Diterima di Muka', user_id: userId, account_code: '2109' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', account_name: 'Utang Jangka Pendek Lainnya', user_id: userId, account_code: '2199' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', account_name: 'Utang PPN ', user_id: userId, account_code: '2102' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', account_name: 'Utang PPh 21', user_id: userId, account_code: '2103' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', account_name: 'Utang PPh 29', user_id: userId, account_code: '2107' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', account_name: 'Utang PPh 25', user_id: userId, account_code: '2106' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', account_name: 'Utang PPh 4(2)', user_id: userId, account_code: '2105' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', account_name: 'Beban Akrual', user_id: userId, account_code: '2110' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', account_name: 'Utang Usaha', user_id: userId, account_code: '2101' },
      { category: 'Kewajiban', sub_category: 'Utang Jangka Pendek', account_name: 'Utang PPh 23', user_id: userId, account_code: '2104' },
    ];

    try {
      // Check if accounts already exist for this user
      const { data, error: fetchError } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        console.log(`Initializing ${defaultAccounts.length} accounts for user: ${userId}`);
        const { error: insertError } = await supabase.from('accounts').insert(defaultAccounts);
        if (insertError) throw insertError;
        console.log('Accounts initialized successfully');
      }
    } catch (err) {
      console.error('Failed to initialize accounts:', err);
      throw err; // Re-throw to be caught by register method
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
    
    if (startDate) {
      const finalStartDate = startDate.includes('T') ? startDate : `${startDate}T00:00:00`;
      query = query.gte('date', finalStartDate);
    }
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
