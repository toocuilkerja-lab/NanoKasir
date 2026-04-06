import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  TrendingUp, 
  BarChart3, 
  Search, 
  Calendar,
  Plus,
  Trash2,
  Package,
  HardDrive,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { User, Account, JournalEntry, Asset, AccountCategory } from '../types';
import { orderService } from '../services/orderService';

// Helper for currency formatting with thousand separator
const formatCurrency = (val: number) => {
  return val.toLocaleString('id-ID');
};

// Helper for parsing currency string back to number
const parseCurrency = (val: string) => {
  return Number(val.replace(/[^\d]/g, '')) || 0;
};

// Helper to get YYYY-MM-DD in local timezone
const getLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to parse YYYY-MM-DD as local Date object
const parseLocalISODate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

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

const formatDateFull = (iso: string) => {
  if (!iso) return '';
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const date = parseSupabaseDate(iso);
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const CurrencyDisplay = ({ value, className = "", showRp = true }: { value: number; className?: string; showRp?: boolean }) => {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString('id-ID');
  
  return (
    <span className={`${isNegative ? 'text-red-600' : ''} ${className}`}>
      {isNegative ? `(${showRp ? 'Rp ' : ''}${formatted})` : `${showRp ? 'Rp ' : ''}${formatted}`}
    </span>
  );
};

export const ReportsView = ({ user }: { user: User }) => {
  const [activeTab, setActiveTab] = useState<'plus_journal' | 'journal_umum' | 'inventory' | 'assets' | 'accounts' | 'financial'>('plus_journal');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const now = new Date();
  const today = getLocalISODate(now);
  const firstDayOfMonth = getLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const firstDayOfYear = getLocalISODate(new Date(now.getFullYear(), 0, 1));

  const [startDate, setStartDate] = useState(firstDayOfYear);
  const [endDate, setEndDate] = useState(today);
  const [search, setSearch] = useState('');

  // Tab specific dates
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const financialStartDate = `${reportYear}-01-01`;
  const financialEndDate = `${reportYear}-12-31`;

  // Inventory Year
  const currentYear = now.getFullYear();
  const [inventoryYear, setInventoryYear] = useState(currentYear);
  const [assetYear, setAssetYear] = useState(currentYear);
  const years = Array.from({ length: currentYear - 2025 + 1 }, (_, i) => 2025 + i);

  // Form states
  const [manualEntries, setManualEntries] = useState<{ account_name: string; debit: number; credit: number; description: string }[]>([
    { account_name: '', debit: 0, credit: 0, description: '' },
    { account_name: '', debit: 0, credit: 0, description: '' }
  ]);
  const [manualDate, setManualDate] = useState(today);
  const [manualDesc, setManualDesc] = useState('');

  const [inventoryValue, setInventoryValue] = useState(0);
  const [inventoryDate, setInventoryDate] = useState(today);

  const [newAsset, setNewAsset] = useState<Omit<Asset, 'id' | 'user_id'>>({
    name: '',
    kelompok: '1',
    purchase_date: today,
    acquisition_cost: 0,
    jenis: 'Inventaris'
  });

  const [newAccount, setNewAccount] = useState<Omit<Account, 'id' | 'user_id'>>({
    account_name: '',
    category: 'Aset',
    sub_category: 'Aset Lancar'
  });

  // Pagination & Search for Accounts
  const [accountSearch, setAccountSearch] = useState('');
  const [accountPage, setAccountPage] = useState(1);
  const itemsPerPage = 10;

  // Pagination & Search for Assets
  const [assetSearch, setAssetSearch] = useState('');
  const [assetPage, setAssetPage] = useState(1);

  useEffect(() => {
    loadData();
  }, [user.user, startDate, endDate, financialStartDate, financialEndDate, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      await orderService.initializeAccounts(user.user);
      
      const sDate = activeTab === 'financial' ? financialStartDate : startDate;
      const eDate = activeTab === 'financial' ? financialEndDate : endDate;

      const [acc, jrnl, asst] = await Promise.all([
        orderService.getAccounts(user.user),
        orderService.getJournalEntries(user.user, sDate, eDate),
        orderService.getAssets(user.user)
      ]);
      setAccounts(acc);
      setJournalEntries(jrnl);
      setAssets(asst);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const calculateBalance = (accountName: string, category: AccountCategory, upToDate?: string) => {
    // For P&L, we usually look at the current period (journalEntries is already filtered by startDate/endDate)
    // For Balance Sheet, we need cumulative balance from start of time.
    // However, for simplicity in this view, let's assume journalEntries contains what we need for the active tab.
    
    const entries = journalEntries.filter(e => e.account_name === accountName);

    return entries.reduce((sum, e) => {
      if (category === 'Aset' || category === 'Beban') return sum + e.debit - e.credit;
      return sum + e.credit - e.debit;
    }, 0);
  };

  // Cumulative balance for Balance Sheet
  const [cumulativeEntries, setCumulativeEntries] = useState<JournalEntry[]>([]);
  useEffect(() => {
    if (activeTab === 'financial' || activeTab === 'accounts' || activeTab === 'inventory') {
      const eDate = activeTab === 'financial' ? `${reportYear}-12-31` : (activeTab === 'inventory' ? `${inventoryYear}-12-31` : endDate);
      orderService.getJournalEntries(user.user, undefined, eDate)
        .then(setCumulativeEntries);
    }
  }, [activeTab, endDate, reportYear, inventoryYear, user.user]);

  const calculateCumulativeBalance = (accountName: string, category: AccountCategory) => {
    const entries = cumulativeEntries.filter(e => e.account_name === accountName);
    return entries.reduce((sum, e) => {
      if (category === 'Aset' || category === 'Beban') return sum + e.debit - e.credit;
      return sum + e.credit - e.debit;
    }, 0);
  };

  const handleSaveManualJournal = async () => {
    const totalDebit = manualEntries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = manualEntries.reduce((sum, e) => sum + e.credit, 0);

    if (totalDebit !== totalCredit || totalDebit === 0) {
      alert("Total Debit dan Kredit harus sama dan tidak nol");
      return;
    }

    try {
      const transactionId = `T-MANUAL-${Date.now()}`;
      const entries = manualEntries.filter(e => e.account_name && (e.debit > 0 || e.credit > 0)).map(e => ({
        transaction_id: transactionId,
        account_name: e.account_name,
        description: e.description || manualDesc,
        debit: e.debit,
        credit: e.credit,
        date: toLocalISOString(parseLocalISODate(manualDate)),
        user_id: user.user
      }));

      await orderService.saveJournalEntry(entries);
      setManualEntries([{ account_name: '', debit: 0, credit: 0, description: '' }, { account_name: '', debit: 0, credit: 0, description: '' }]);
      setManualDesc('');
      loadData();
      alert("Jurnal berhasil disimpan");
    } catch (e) {
      alert("Gagal menyimpan jurnal");
    }
  };

  const handleInventoryAdjustment = async () => {
    const currentBalance = cumulativeEntries
      .filter(e => e.account_name === 'Persediaan Barang')
      .reduce((sum, e) => sum + e.debit - e.credit, 0);
    
    const diff = inventoryValue - currentBalance;
    if (diff === 0) return;

    try {
      const transactionId = `T-INV-${Date.now()}`;
      const entries = [
        {
          transaction_id: transactionId,
          account_name: 'Persediaan Barang',
          description: 'Penyesuaian Stok Opname',
          debit: diff > 0 ? diff : 0,
          credit: diff < 0 ? Math.abs(diff) : 0,
          date: toLocalISOString(parseLocalISODate(inventoryDate)),
          user_id: user.user
        },
        {
          transaction_id: transactionId,
          account_name: 'Persediaan Akhir',
          description: 'Penyesuaian Stok Opname',
          debit: diff < 0 ? Math.abs(diff) : 0,
          credit: diff > 0 ? diff : 0,
          date: toLocalISOString(parseLocalISODate(inventoryDate)),
          user_id: user.user
        }
      ];

      await orderService.saveJournalEntry(entries);
      setInventoryValue(0); // Reset nilai fisik ke 0
      
      // Refresh cumulative entries to update Nilai Buku immediately
      const eDate = inventoryYear === currentYear ? today : `${inventoryYear}-12-31T23:59:59`;
      const updatedCumulative = await orderService.getJournalEntries(user.user, undefined, eDate.includes('T') ? eDate : toLocalISOString(new Date(eDate)));
      setCumulativeEntries(updatedCumulative);
      
      loadData();
      alert("Penyesuaian persediaan berhasil");
    } catch (e) {
      alert("Gagal menyesuaikan persediaan");
    }
  };

  const handleAddAsset = async () => {
    if (!newAsset.name || newAsset.acquisition_cost <= 0) return;
    try {
      await orderService.saveAsset({ ...newAsset, user_id: user.user } as Asset);
      setNewAsset({ name: '', kelompok: '1', purchase_date: today, acquisition_cost: 0, jenis: 'Inventaris' });
      loadData();
      alert("Aset berhasil disimpan");
    } catch (e) {
      alert("Gagal menyimpan aset");
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm('Hapus aset ini?')) return;
    try {
      await orderService.deleteAsset(id);
      loadData();
    } catch (e) {
      alert("Gagal menghapus aset");
    }
  };

  const handleAddAccount = async () => {
    if (!newAccount.account_name) return;
    try {
      await orderService.saveAccount({ ...newAccount, user_id: user.user } as Account);
      setNewAccount({ account_name: '', category: 'Aset', sub_category: 'Aset Lancar', account_code: '' });
      loadData();
    } catch (e) {
      alert("Gagal menambah akun");
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Hapus akun ini?')) return;
    try {
      await orderService.deleteAccount(id);
      loadData();
    } catch (e) {
      alert("Gagal menghapus akun");
    }
  };

  const getFinancialData = () => {
    // P&L Data (Current Period)
    const pendapatanUsaha = accounts.filter(a => a.category === 'Pendapatan' && a.sub_category === 'Pendapatan Usaha');
    const pendapatanLainnya = accounts.filter(a => a.category === 'Pendapatan' && a.sub_category === 'Pendapatan Lainnya');
    const hppAccounts = accounts.filter(a => a.sub_category === 'Beban HPP');
    const bebanOperasional = accounts.filter(a => a.category === 'Beban' && a.sub_category === 'Beban Operasional');
    const bebanLainnya = accounts.filter(a => a.category === 'Beban' && a.sub_category === 'Beban Lainnya');
    
    const totalPendapatanUsaha = pendapatanUsaha.reduce((sum, a) => sum + calculateBalance(a.account_name, a.category), 0);
    const totalPendapatanLainnya = pendapatanLainnya.reduce((sum, a) => sum + calculateBalance(a.account_name, a.category), 0);
    
    // Special Logic for Persediaan Awal & Akhir
    // Persediaan Awal = Cumulative Balance of 'Persediaan Barang' up to end of previous year
    const prevYearEnd = `${reportYear - 1}-12-31T23:59:59`;
    const persediaanAwalValue = Math.max(0, cumulativeEntries
      .filter(e => e.account_name === 'Persediaan Barang' && e.date <= prevYearEnd)
      .reduce((sum, e) => sum + e.debit - e.credit, 0));
    
    // Persediaan Akhir = Cumulative Balance of 'Persediaan Barang' up to end of current year
    const currentYearEnd = `${reportYear}-12-31T23:59:59`;
    const persediaanAkhirValue = Math.max(0, cumulativeEntries
      .filter(e => e.account_name === 'Persediaan Barang' && e.date <= currentYearEnd)
      .reduce((sum, e) => sum + e.debit - e.credit, 0));

    const totalHPP = hppAccounts.reduce((sum, a) => {
      if (a.account_name === 'Persediaan Awal') return sum + persediaanAwalValue;
      if (a.account_name === 'Persediaan Akhir') return sum - persediaanAkhirValue;
      // Exclude the 'HPP' summary account itself to avoid double counting if it has entries
      if (a.account_name === 'HPP') return sum;
      return sum + calculateBalance(a.account_name, a.category);
    }, 0);
    
    const labaKotor = totalPendapatanUsaha - totalHPP;
    const totalBebanOperasional = bebanOperasional.reduce((sum, a) => sum + calculateBalance(a.account_name, a.category), 0);
    const labaOperasional = labaKotor - totalBebanOperasional;
    
    const totalBebanLainnya = bebanLainnya.reduce((sum, a) => sum + calculateBalance(a.account_name, a.category), 0);
    const labaBersih = labaOperasional + totalPendapatanLainnya - totalBebanLainnya;

    // Balance Sheet Data (Cumulative)
    const aset = accounts.filter(a => a.category === 'Aset');
    const kewajiban = accounts.filter(a => a.category === 'Kewajiban');
    const ekuitas = accounts.filter(a => a.category === 'Ekuitas');
    
    const totalAset = aset.reduce((sum, a) => sum + calculateCumulativeBalance(a.account_name, a.category), 0);
    const totalKewajiban = kewajiban.reduce((sum, a) => sum + calculateCumulativeBalance(a.account_name, a.category), 0);
    const totalEkuitasBase = ekuitas.filter(a => a.account_name !== 'Laba Ditahan').reduce((sum, a) => sum + calculateCumulativeBalance(a.account_name, a.category), 0);
    
    // For Balance Sheet, we need to split cumulative profit into:
    // 1. Laba Ditahan (Profit from previous years)
    // 2. Laba Tahun Berjalan (Profit from current year)
    const allPendapatan = accounts.filter(a => a.category === 'Pendapatan');
    const allBeban = accounts.filter(a => a.category === 'Beban');
    
    const labaDitahan = allPendapatan.reduce((sum, a) => {
      const entries = cumulativeEntries.filter(e => e.account_name === a.account_name && e.date <= prevYearEnd);
      return sum + entries.reduce((s, e) => e.credit - e.debit, 0);
    }, 0) - allBeban.reduce((sum, a) => {
      const entries = cumulativeEntries.filter(e => e.account_name === a.account_name && e.date <= prevYearEnd);
      return sum + entries.reduce((s, e) => e.debit - e.credit, 0);
    }, 0);

    const totalEkuitas = totalEkuitasBase + labaDitahan + labaBersih;

    return { 
      pendapatanUsaha, pendapatanLainnya, hppAccounts, bebanOperasional, bebanLainnya,
      totalPendapatanUsaha, totalPendapatanLainnya, totalHPP, labaKotor, totalBebanOperasional, labaOperasional, totalBebanLainnya, labaBersih,
      aset, kewajiban, ekuitas, totalAset, totalKewajiban, totalEkuitas, labaDitahan,
      persediaanAwalValue, persediaanAkhirValue
    };
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto no-scrollbar">
        {[
          { id: 'plus_journal', icon: Plus, label: 'Tambah Jurnal' },
          { id: 'journal_umum', icon: FileText, label: 'Jurnal Umum' },
          { id: 'inventory', icon: Package, label: 'Persediaan' },
          { id: 'assets', icon: HardDrive, label: 'Aset' },
          { id: 'accounts', icon: BookOpen, label: 'Akun' },
          { id: 'financial', icon: BarChart3, label: 'Laporan' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'plus_journal' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Tanggal (DD/MM/YYYY)</label>
              <input
                type="date"
                value={manualDate}
                onChange={e => setManualDate(e.target.value)}
                className="bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex-[3] flex flex-col gap-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Keterangan Umum</label>
              <input
                type="text"
                placeholder="Keterangan Umum"
                value={manualDesc}
                onChange={e => setManualDesc(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            {manualEntries.map((entry, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-4 bg-gray-50 rounded-2xl">
                <div className="relative">
                  <input
                    list={`accounts-list-${idx}`}
                    value={entry.account_name}
                    onChange={e => {
                      const newEntries = [...manualEntries];
                      newEntries[idx].account_name = e.target.value;
                      setManualEntries(newEntries);
                    }}
                    placeholder="Pilih Akun"
                    className="w-full bg-white border-none rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-orange-500"
                  />
                  <datalist id={`accounts-list-${idx}`}>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.account_name} />
                    ))}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    placeholder="Debit"
                    value={entry.debit === 0 ? '' : formatCurrency(entry.debit)}
                    onChange={e => {
                      const val = parseCurrency(e.target.value);
                      const newEntries = [...manualEntries];
                      newEntries[idx].debit = val;
                      if (val > 0) newEntries[idx].credit = 0;
                      setManualEntries(newEntries);
                    }}
                    className="bg-white border-none rounded-xl px-3 py-2 text-xs font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    placeholder="Kredit"
                    value={entry.credit === 0 ? '' : formatCurrency(entry.credit)}
                    onChange={e => {
                      const val = parseCurrency(e.target.value);
                      const newEntries = [...manualEntries];
                      newEntries[idx].credit = val;
                      if (val > 0) newEntries[idx].debit = 0;
                      setManualEntries(newEntries);
                    }}
                    className="bg-white border-none rounded-xl px-3 py-2 text-xs font-medium"
                  />
                </div>
                <button
                  onClick={() => setManualEntries(manualEntries.filter((_, i) => i !== idx))}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setManualEntries([...manualEntries, { account_name: '', debit: 0, credit: 0, description: '' }])}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-gray-400 hover:border-orange-500 hover:text-orange-500 transition-all"
            >
              + TAMBAH BARIS
            </button>
          </div>

          <div className="flex justify-between items-center p-4 bg-orange-50 rounded-2xl">
            <div className="text-xs font-bold text-orange-800">
              Total Debit: Rp {formatCurrency(manualEntries.reduce((sum, e) => sum + e.debit, 0))}
            </div>
            <div className="text-xs font-bold text-orange-800">
              Total Kredit: Rp {formatCurrency(manualEntries.reduce((sum, e) => sum + e.credit, 0))}
            </div>
          </div>

          <button
            onClick={handleSaveManualJournal}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl text-sm font-black shadow-lg shadow-orange-100 active:scale-95 transition-all"
          >
            SIMPAN JURNAL
          </button>
        </div>
      )}

      {activeTab === 'journal_umum' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Mulai (DD/MM/YYYY)</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs font-bold" />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Selesai (DD/MM/YYYY)</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs font-bold" />
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Cari Transaksi</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Cari akun atau keterangan..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Tanggal</th>
                    <th className="px-6 py-4">Akun</th>
                    <th className="px-6 py-4">Keterangan</th>
                    <th className="px-6 py-4 text-right">Debit</th>
                    <th className="px-6 py-4 text-right">Kredit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {journalEntries
                    .filter(e => e.account_name.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase()))
                    .map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-gray-500 font-medium">{parseSupabaseDate(entry.date).toLocaleDateString('id-ID')}</td>
                        <td className="px-6 py-4 font-bold text-gray-800">{entry.account_name}</td>
                        <td className="px-6 py-4 text-gray-500">{entry.description}</td>
                        <td className="px-6 py-4 text-right font-bold text-green-600">
                          {entry.debit > 0 ? `Rp ${formatCurrency(entry.debit)}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-red-600">
                          {entry.credit > 0 ? `Rp ${formatCurrency(entry.credit)}` : '-'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Penyesuaian Persediaan (Stok Opname)</h3>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-gray-400 uppercase">Tahun:</label>
              <select
                value={inventoryYear}
                onChange={e => setInventoryYear(Number(e.target.value))}
                className="bg-gray-50 border-none rounded-lg px-3 py-1 text-xs font-bold focus:ring-2 focus:ring-orange-500"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-2xl">
              <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Nilai Buku (Per 31 Des {inventoryYear})</div>
              <div className="text-xl font-black text-gray-800">
                Rp {formatCurrency(cumulativeEntries
                  .filter(e => e.account_name === 'Persediaan Barang' && parseSupabaseDate(e.date).getFullYear() <= inventoryYear)
                  .reduce((sum, e) => sum + e.debit - e.credit, 0))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nilai Fisik (Riil)</label>
              <input
                type="text"
                placeholder="Masukkan Nilai Fisik"
                value={inventoryValue === 0 ? '' : formatCurrency(inventoryValue)}
                onChange={e => setInventoryValue(parseCurrency(e.target.value))}
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-4 text-lg font-black text-orange-600 focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Tanggal (DD/MM/YYYY)</label>
                <input
                  type="date"
                  value={inventoryDate}
                  onChange={e => setInventoryDate(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Selisih</label>
                <div className={`w-full bg-gray-50 rounded-xl px-4 py-3 text-xs font-black flex items-center ${
                  (inventoryValue - cumulativeEntries.filter(e => e.account_name === 'Persediaan Barang').reduce((sum, e) => sum + e.debit - e.credit, 0)) >= 0 
                    ? 'text-green-600' : 'text-red-600'
                }`}>
                  Rp {formatCurrency(inventoryValue - cumulativeEntries.filter(e => e.account_name === 'Persediaan Barang').reduce((sum, e) => sum + e.debit - e.credit, 0))}
                </div>
              </div>
            </div>
            <button
              onClick={handleInventoryAdjustment}
              className="w-full bg-gray-900 text-white py-4 rounded-2xl text-sm font-black shadow-lg active:scale-95 transition-all"
            >
              SIMPAN PENYESUAIAN
            </button>
          </div>
        </div>
      )}

      {activeTab === 'assets' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 space-y-4">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Tambah Aset Tetap</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nama Aset</label>
                <input
                  type="text"
                  placeholder="Nama Aset"
                  value={newAsset.name}
                  onChange={e => setNewAsset({ ...newAsset, name: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Kelompok Aset</label>
                <select
                  value={newAsset.kelompok}
                  onChange={e => setNewAsset({ ...newAsset, kelompok: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-orange-500"
                >
                  <option value="1">Kelompok 1 (4 Thn - 25%)</option>
                  <option value="2">Kelompok 2 (8 Thn - 12.5%)</option>
                  <option value="3">Kelompok 3 (16 Thn - 6.25%)</option>
                  <option value="4">Kelompok 4 (20 Thn - 5%)</option>
                  <option value="BP">Bangunan Permanen (20 Thn - 5%)</option>
                  <option value="BTP">Bangunan Tidak Permanen (10 Thn - 10%)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Harga Perolehan</label>
                <input
                  type="text"
                  placeholder="Harga Perolehan"
                  value={newAsset.acquisition_cost === 0 ? '' : formatCurrency(newAsset.acquisition_cost)}
                  onChange={e => setNewAsset({ ...newAsset, acquisition_cost: parseCurrency(e.target.value) })}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Jenis Aset</label>
                <select
                  value={newAsset.jenis}
                  onChange={e => setNewAsset({ ...newAsset, jenis: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Inventaris">Inventaris</option>
                  <option value="Bangunan">Bangunan</option>
                  <option value="Tanah">Tanah</option>
                  <option value="Kendaraan">Kendaraan</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleAddAsset}
              className="w-full bg-orange-500 text-white py-3 rounded-xl text-xs font-black shadow-lg active:scale-95 transition-all"
            >
              SIMPAN ASET
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Daftar Aset</h3>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-sm border border-gray-100">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Tahun:</label>
                  <select
                    value={assetYear}
                    onChange={e => setAssetYear(Number(e.target.value))}
                    className="bg-transparent border-none p-0 text-xs font-bold focus:ring-0"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Cari aset..."
                    value={assetSearch}
                    onChange={e => { setAssetSearch(e.target.value); setAssetPage(1); }}
                    className="w-full bg-white border-none rounded-xl pl-9 pr-4 py-2 text-xs font-medium shadow-sm focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-black uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Nama Aset</th>
                      <th className="px-6 py-4">Jenis</th>
                      <th className="px-6 py-4">Tgl Beli</th>
                      <th className="px-6 py-4 text-right">Harga</th>
                      <th className="px-6 py-4 text-right">NB Awal {assetYear}</th>
                      <th className="px-6 py-4 text-right">Penyusutan {assetYear}</th>
                      <th className="px-6 py-4 text-right">NB Akhir {assetYear}</th>
                      <th className="px-6 py-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(() => {
                      const filteredAssets = assets.filter(a => 
                        a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
                        a.jenis.toLowerCase().includes(assetSearch.toLowerCase())
                      );
                      const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
                      const paginatedAssets = filteredAssets.slice((assetPage - 1) * itemsPerPage, assetPage * itemsPerPage);

                      if (paginatedAssets.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-gray-400 font-medium italic">
                              Tidak ada data aset ditemukan
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <>
                          {paginatedAssets.map(asset => {
                            let rate = 0;
                            if (asset.kelompok === '1') { rate = 0.25; }
                            else if (asset.kelompok === '2') { rate = 0.125; }
                            else if (asset.kelompok === '3') { rate = 0.0625; }
                            else if (asset.kelompok === '4' || asset.kelompok === 'BP') { rate = 0.05; }
                            else if (asset.kelompok === 'BTP') { rate = 0.1; }

                            const purchaseDate = parseSupabaseDate(asset.purchase_date);
                            const startOfSelectedYear = new Date(assetYear, 0, 1);
                            
                            const monthsBeforeSelectedYear = Math.max(0, (startOfSelectedYear.getFullYear() - purchaseDate.getFullYear()) * 12 + (startOfSelectedYear.getMonth() - purchaseDate.getMonth()));
                            const monthlyDep = (asset.acquisition_cost * rate) / 12;
                            const accDepStartOfYear = Math.min(asset.acquisition_cost, monthsBeforeSelectedYear * monthlyDep);
                            const nbAwalTahun = Math.max(0, asset.acquisition_cost - accDepStartOfYear);
                            
                            let depThisYear = 0;
                            if (purchaseDate.getFullYear() < assetYear) {
                              depThisYear = Math.min(nbAwalTahun, 12 * monthlyDep);
                            } else if (purchaseDate.getFullYear() === assetYear) {
                              const monthsThisYear = 12 - purchaseDate.getMonth();
                              depThisYear = Math.min(nbAwalTahun, monthsThisYear * monthlyDep);
                            }
                            
                            const nbAkhirTahun = Math.max(0, nbAwalTahun - depThisYear);

                            return (
                              <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-gray-800">{asset.name}</td>
                                <td className="px-6 py-4 text-gray-500">{asset.jenis}</td>
                                <td className="px-6 py-4 text-gray-500">{parseSupabaseDate(asset.purchase_date).toLocaleDateString('id-ID')}</td>
                                <td className="px-6 py-4 text-right font-bold">Rp {formatCurrency(asset.acquisition_cost)}</td>
                                <td className="px-6 py-4 text-right text-blue-600 font-bold">Rp {formatCurrency(Math.round(nbAwalTahun))}</td>
                                <td className="px-6 py-4 text-right text-red-500 font-bold">
                                  Rp {formatCurrency(Math.round(depThisYear))}
                                </td>
                                <td className="px-6 py-4 text-right text-green-600 font-bold">Rp {formatCurrency(Math.round(nbAkhirTahun))}</td>
                                <td className="px-6 py-4 text-right">
                                  <button onClick={() => handleDeleteAsset(asset.id)} className="text-gray-300 hover:text-red-500">
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {totalPages > 1 && (
                            <tr>
                              <td colSpan={8} className="px-6 py-4 bg-gray-50">
                                <div className="flex justify-center items-center gap-2">
                                  <button 
                                    disabled={assetPage === 1}
                                    onClick={() => setAssetPage(p => p - 1)}
                                    className="p-1 rounded-lg hover:bg-white disabled:opacity-30"
                                  >
                                    <ChevronLeft size={16} />
                                  </button>
                                  <span className="text-[10px] font-black text-gray-500">HALAMAN {assetPage} DARI {totalPages}</span>
                                  <button 
                                    disabled={assetPage === totalPages}
                                    onClick={() => setAssetPage(p => p + 1)}
                                    className="p-1 rounded-lg hover:bg-white disabled:opacity-30"
                                  >
                                    <ChevronRight size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

            <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-500 rounded-xl text-white">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h4 className="font-black text-gray-800 text-sm">Contoh Jurnal Penyusutan</h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Total Tahun {assetYear}</p>
                </div>
              </div>
              
              {(() => {
                const totalDepThisYear = assets.reduce((sum, asset) => {
                  let rate = 0;
                  if (asset.kelompok === '1') { rate = 0.25; }
                  else if (asset.kelompok === '2') { rate = 0.125; }
                  else if (asset.kelompok === '3') { rate = 0.0625; }
                  else if (asset.kelompok === '4' || asset.kelompok === 'BP') { rate = 0.05; }
                  else if (asset.kelompok === 'BTP') { rate = 0.1; }

                  const purchaseDate = parseSupabaseDate(asset.purchase_date);
                  const startOfSelectedYear = new Date(assetYear, 0, 1);
                  const monthsBeforeSelectedYear = Math.max(0, (startOfSelectedYear.getFullYear() - purchaseDate.getFullYear()) * 12 + (startOfSelectedYear.getMonth() - purchaseDate.getMonth()));
                  const monthlyDep = (asset.acquisition_cost * rate) / 12;
                  const accDepStartOfYear = Math.min(asset.acquisition_cost, monthsBeforeSelectedYear * monthlyDep);
                  const nbAwalTahun = Math.max(0, asset.acquisition_cost - accDepStartOfYear);
                  
                  let depThisYear = 0;
                  if (purchaseDate.getFullYear() < assetYear) {
                    depThisYear = Math.min(nbAwalTahun, 12 * monthlyDep);
                  } else if (purchaseDate.getFullYear() === assetYear) {
                    const monthsThisYear = 12 - purchaseDate.getMonth();
                    depThisYear = Math.min(nbAwalTahun, monthsThisYear * monthlyDep);
                  }
                  return sum + depThisYear;
                }, 0);

                return (
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100/50">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <div className="space-y-0.5">
                          <p className="font-bold text-gray-800">Beban Penyusutan</p>
                          <p className="text-[9px] text-gray-400">Debit</p>
                        </div>
                        <p className="font-black text-red-500">Rp {formatCurrency(Math.round(totalDepThisYear))}</p>
                      </div>
                      <div className="flex justify-between items-center text-xs pl-6 border-l-2 border-orange-100">
                        <div className="space-y-0.5">
                          <p className="font-bold text-gray-800">Akumulasi Penyusutan</p>
                          <p className="text-[9px] text-gray-400">Kredit</p>
                        </div>
                        <p className="font-black text-green-600">Rp {formatCurrency(Math.round(totalDepThisYear))}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              <p className="text-[9px] text-orange-400 font-bold italic">
                * Masukkan nilai diatas ke menu Jurnal Umum setiap akhir tahun untuk mencatat beban penyusutan secara manual.
              </p>
            </div>
          </div>
      )}

      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 space-y-4">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Tambah Akun Baru</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Kode Akun (e.g. 1101)"
                value={newAccount.account_code || ''}
                onChange={e => setNewAccount({ ...newAccount, account_code: e.target.value })}
                className="bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="text"
                placeholder="Nama Akun"
                value={newAccount.account_name}
                onChange={e => setNewAccount({ ...newAccount, account_name: e.target.value })}
                className="bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-orange-500"
              />
              <select
                value={newAccount.category}
                onChange={e => setNewAccount({ ...newAccount, category: e.target.value as AccountCategory })}
                className="bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-orange-500"
              >
                {['Aset', 'Kewajiban', 'Ekuitas', 'Pendapatan', 'Beban'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Sub-Kategori"
                value={newAccount.sub_category}
                onChange={e => setNewAccount({ ...newAccount, sub_category: e.target.value })}
                className="bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              onClick={handleAddAccount}
              className="w-full bg-gray-900 text-white py-3 rounded-xl text-xs font-black shadow-lg active:scale-95 transition-all"
            >
              SIMPAN AKUN
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Daftar Akun</h3>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Cari akun..."
                  value={accountSearch}
                  onChange={e => { setAccountSearch(e.target.value); setAccountPage(1); }}
                  className="w-full bg-white border-none rounded-xl pl-9 pr-4 py-2 text-xs font-medium shadow-sm focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-black uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Kode</th>
                      <th className="px-6 py-4">Kategori</th>
                      <th className="px-6 py-4">Sub-Kategori</th>
                      <th className="px-6 py-4">Nama Akun</th>
                      <th className="px-6 py-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(() => {
                      const filteredAccounts = accounts.filter(acc => 
                        acc.account_name.toLowerCase().includes(accountSearch.toLowerCase()) ||
                        (acc.account_code && acc.account_code.toLowerCase().includes(accountSearch.toLowerCase())) ||
                        acc.category.toLowerCase().includes(accountSearch.toLowerCase()) ||
                        acc.sub_category.toLowerCase().includes(accountSearch.toLowerCase())
                      );
                      const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
                      const paginatedAccounts = filteredAccounts.slice((accountPage - 1) * itemsPerPage, accountPage * itemsPerPage);

                      if (paginatedAccounts.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium italic">
                              Tidak ada data akun ditemukan
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <>
                          {paginatedAccounts.map(acc => (
                            <tr key={acc.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-gray-400 font-mono">{acc.account_code || '-'}</td>
                              <td className="px-6 py-4 text-gray-500">{acc.category}</td>
                              <td className="px-6 py-4 text-gray-500">{acc.sub_category}</td>
                              <td className="px-6 py-4 font-bold text-gray-800">{acc.account_name}</td>
                              <td className="px-6 py-4 text-right">
                                <button onClick={() => handleDeleteAccount(acc.id)} className="text-gray-300 hover:text-red-500">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {totalPages > 1 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-4 bg-gray-50">
                                <div className="flex justify-center items-center gap-2">
                                  <button 
                                    disabled={accountPage === 1}
                                    onClick={() => setAccountPage(p => p - 1)}
                                    className="p-1 rounded-lg hover:bg-white disabled:opacity-30"
                                  >
                                    <ChevronLeft size={16} />
                                  </button>
                                  <span className="text-[10px] font-black text-gray-500">HALAMAN {accountPage} DARI {totalPages}</span>
                                  <button 
                                    disabled={accountPage === totalPages}
                                    onClick={() => setAccountPage(p => p + 1)}
                                    className="p-1 rounded-lg hover:bg-white disabled:opacity-30"
                                  >
                                    <ChevronRight size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Pilih Tahun Laporan</label>
                <select 
                  value={reportYear} 
                  onChange={e => setReportYear(Number(e.target.value))} 
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-orange-500"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Combined P&L and Balance Sheet */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50 space-y-12">
            {/* Laba Rugi Section */}
            <div className="space-y-8">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Laporan Laba Rugi</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  PERIODE: 01 JANUARI {reportYear} - 31 DESEMBER {reportYear}
                </p>
              </div>

              {(() => {
                const { 
                  pendapatanUsaha, 
                  pendapatanLainnya, 
                  hppAccounts, 
                  bebanOperasional, 
                  bebanLainnya,
                  totalPendapatanUsaha, 
                  totalPendapatanLainnya,
                  totalHPP, 
                  labaKotor, 
                  totalBebanOperasional, 
                  labaOperasional,
                  totalBebanLainnya,
                  labaBersih,
                  persediaanAwalValue,
                  persediaanAkhirValue
                } = getFinancialData();
                return (
                  <div className="space-y-8">
                    {/* 1. Pendapatan Usaha */}
                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest border-b border-orange-100 pb-2">Pendapatan Usaha</h3>
                      <div className="space-y-3">
                        {pendapatanUsaha.map(a => (
                          <div key={a.id} className="flex justify-between text-xs font-bold">
                            <span className="text-gray-600">{a.account_name}</span>
                            <CurrencyDisplay value={calculateBalance(a.account_name, a.category)} className="text-gray-800" />
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-black pt-2 border-t border-gray-50">
                          <span className="text-gray-800">TOTAL PENDAPATAN USAHA</span>
                          <CurrencyDisplay value={totalPendapatanUsaha} className="text-green-600" />
                        </div>
                      </div>
                    </section>

                    {/* 2. HPP */}
                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-b border-blue-100 pb-2">Harga Pokok Penjualan (HPP)</h3>
                      <div className="space-y-3">
                        {hppAccounts.map(a => {
                          let value = calculateBalance(a.account_name, a.category);
                          let displayValue = value;
                          let label = a.account_name;

                          if (a.account_name === 'Persediaan Awal') {
                            displayValue = persediaanAwalValue;
                          } else if (a.account_name === 'Persediaan Akhir') {
                            displayValue = -persediaanAkhirValue;
                          } else if (a.account_name === 'HPP') {
                            // Skip the summary account in the list if it's just a placeholder
                            return null;
                          }
                          
                          return (
                            <div key={a.id} className="flex justify-between text-xs font-bold">
                              <span className="text-gray-600">{label}</span>
                              <CurrencyDisplay value={displayValue} className={displayValue < 0 ? "text-red-500" : "text-gray-800"} />
                            </div>
                          );
                        })}
                        <div className="flex justify-between text-sm font-black pt-2 border-t border-gray-50">
                          <span className="text-gray-800">TOTAL HPP</span>
                          <CurrencyDisplay value={totalHPP} className="text-blue-600" />
                        </div>
                      </div>
                    </section>

                    <div className="flex justify-between text-sm font-black p-4 bg-gray-50 rounded-2xl">
                      <span className="text-gray-800 uppercase tracking-wider">Laba Kotor</span>
                      <CurrencyDisplay value={labaKotor} className="text-gray-900 font-black" />
                    </div>

                    {/* 3. Beban Operasional */}
                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest border-b border-red-100 pb-2">Beban Operasional</h3>
                      <div className="space-y-3">
                        {bebanOperasional.map(a => (
                          <div key={a.id} className="flex justify-between text-xs font-bold">
                            <span className="text-gray-600">{a.account_name}</span>
                            <CurrencyDisplay value={calculateBalance(a.account_name, a.category)} className="text-gray-800" />
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-black pt-2 border-t border-gray-50">
                          <span className="text-gray-800">TOTAL BEBAN OPERASIONAL</span>
                          <CurrencyDisplay value={totalBebanOperasional} className="text-red-600" />
                        </div>
                      </div>
                    </section>

                    <div className="flex justify-between text-xs font-black p-3 bg-gray-100/50 rounded-xl">
                      <span className="text-gray-500 uppercase tracking-wider">Laba Operasional</span>
                      <CurrencyDisplay value={labaOperasional} className="text-gray-700" />
                    </div>

                    {/* 4. Pendapatan & Beban Lainnya */}
                    <div className="space-y-8">
                      <section className="space-y-4">
                        <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b border-emerald-100 pb-2">Pendapatan Lainnya</h3>
                        <div className="space-y-3">
                          {pendapatanLainnya.map(a => (
                            <div key={a.id} className="flex justify-between text-xs font-bold">
                              <span className="text-gray-600">{a.account_name}</span>
                              <CurrencyDisplay value={calculateBalance(a.account_name, a.category)} className="text-gray-800" />
                            </div>
                          ))}
                          <div className="flex justify-between text-[10px] font-black pt-2 border-t border-gray-50">
                            <span className="text-gray-400">TOTAL PEND. LAINNYA</span>
                            <CurrencyDisplay value={totalPendapatanLainnya} className="text-emerald-600" />
                          </div>
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-rose-100 pb-2">Beban Lainnya</h3>
                        <div className="space-y-3">
                          {bebanLainnya.map(a => (
                            <div key={a.id} className="flex justify-between text-xs font-bold">
                              <span className="text-gray-600">{a.account_name}</span>
                              <CurrencyDisplay value={calculateBalance(a.account_name, a.category)} className="text-gray-800" />
                            </div>
                          ))}
                          <div className="flex justify-between text-[10px] font-black pt-2 border-t border-gray-50">
                            <span className="text-gray-400">TOTAL BEBAN LAINNYA</span>
                            <CurrencyDisplay value={totalBebanLainnya} className="text-rose-600" />
                          </div>
                        </div>
                      </section>
                    </div>

                    <div className="bg-gray-900 p-6 rounded-3xl flex justify-between items-center shadow-xl shadow-gray-200">
                      <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Laba Bersih</div>
                      <div className="text-2xl font-black text-white">
                        <CurrencyDisplay value={labaBersih} />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="border-t-4 border-dashed border-gray-100 my-12"></div>

            {/* Neraca Section */}
            <div className="space-y-8">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Laporan Neraca</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  PERIODE: 01 JANUARI {reportYear} - 31 DESEMBER {reportYear}
                </p>
              </div>

              {(() => {
                const { aset, kewajiban, ekuitas, totalAset, totalKewajiban, totalEkuitas, labaDitahan, labaBersih } = getFinancialData();
                
                const groupBySub = (items: Account[]) => {
                  return items.reduce((acc, item) => {
                    if (!acc[item.sub_category]) acc[item.sub_category] = [];
                    acc[item.sub_category].push(item);
                    return acc;
                  }, {} as Record<string, Account[]>);
                };

                const asetGrouped = groupBySub(aset);
                const kewajibanGrouped = groupBySub(kewajiban);
                const ekuitasGrouped = groupBySub(ekuitas);

                return (
                  <div className="space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <section className="space-y-6">
                        <h3 className="text-[10px] font-black text-green-500 uppercase tracking-widest border-b border-green-100 pb-2">Aktiva (Aset)</h3>
                        <div className="space-y-6">
                          {Object.entries(asetGrouped).map(([sub, items]) => (
                            <div key={sub} className="space-y-2">
                              <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{sub}</h4>
                              <div className="space-y-2 pl-2">
                                {items.map(a => (
                                  <div key={a.id} className="flex justify-between text-xs font-bold">
                                    <span className="text-gray-600">{a.account_name}</span>
                                    <CurrencyDisplay value={calculateCumulativeBalance(a.account_name, a.category)} className="text-gray-800" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-6">
                        <div className="space-y-6">
                          <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-b border-blue-100 pb-2">Passiva (Kewajiban & Ekuitas)</h3>
                          
                          <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Kewajiban</h4>
                            {Object.entries(kewajibanGrouped).map(([sub, items]) => (
                              <div key={sub} className="space-y-2">
                                <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{sub}</h4>
                                <div className="space-y-2 pl-2">
                                  {items.map(a => (
                                    <div key={a.id} className="flex justify-between text-xs font-bold">
                                      <span className="text-gray-600">{a.account_name}</span>
                                      <CurrencyDisplay value={calculateCumulativeBalance(a.account_name, a.category)} className="text-gray-800" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            <div className="flex justify-between text-xs font-black pt-2 border-t border-gray-50">
                              <span className="text-gray-800">TOTAL KEWAJIBAN</span>
                              <CurrencyDisplay value={totalKewajiban} className="text-gray-800" />
                            </div>
                          </div>

                          <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Ekuitas</h4>
                            {Object.entries(ekuitasGrouped).map(([sub, items]) => (
                              <div key={sub} className="space-y-2">
                                <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{sub}</h4>
                                <div className="space-y-2 pl-2">
                                  {items.filter(a => a.account_name !== 'Laba Ditahan').map(a => (
                                    <div key={a.id} className="flex justify-between text-xs font-bold">
                                      <span className="text-gray-600">{a.account_name}</span>
                                      <CurrencyDisplay value={calculateCumulativeBalance(a.account_name, a.category)} className="text-gray-800" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            <div className="space-y-2 pl-2 pt-2 border-t border-gray-50">
                              <div className="flex justify-between text-xs font-bold text-gray-600">
                                <span>Laba Ditahan</span>
                                <CurrencyDisplay value={labaDitahan} />
                              </div>
                              <div className="flex justify-between text-xs font-bold text-orange-600 italic">
                                <span>Laba Tahun Berjalan</span>
                                <CurrencyDisplay value={labaBersih} />
                              </div>
                            </div>
                            <div className="flex justify-between text-xs font-black pt-2 border-t border-gray-50">
                              <span className="text-gray-800">TOTAL EKUITAS</span>
                              <CurrencyDisplay value={totalEkuitas} className="text-gray-800" />
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>

                    {/* Summary Totals Sejajar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t-2 border-gray-900">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-black text-gray-900 uppercase tracking-wider">Total Aktiva</span>
                        <CurrencyDisplay value={totalAset} className="text-lg font-black text-gray-900" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-black text-gray-900 uppercase tracking-wider">Total Passiva</span>
                        <CurrencyDisplay value={totalKewajiban + totalEkuitas} className="text-lg font-black text-gray-900" />
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              <div className="pt-8 flex justify-center">
                <div className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  Math.abs(getFinancialData().totalAset - (getFinancialData().totalKewajiban + getFinancialData().totalEkuitas)) < 1
                  ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {Math.abs(getFinancialData().totalAset - (getFinancialData().totalKewajiban + getFinancialData().totalEkuitas)) < 1
                  ? '✓ Neraca Seimbang (Balanced)' : '⚠ Neraca Tidak Seimbang'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
