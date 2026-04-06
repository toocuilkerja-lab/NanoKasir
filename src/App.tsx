import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  ShoppingCart, 
  ClipboardList, 
  TrendingUp, 
  Settings, 
  LogOut, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Trash2,
  ChevronRight,
  Search,
  Store,
  Calendar,
  FileText,
  BookOpen,
  Receipt
} from 'lucide-react';
import { Order, MenuItem, User, OrderItem, OrderStatus } from './types';
import { orderService } from './services/orderService';
import { ReportsView } from './components/ReportsView';
import { bluetoothService } from './services/bluetoothService';

// --- Components ---

const Header = ({ 
  shopName, 
  shopAddress, 
  isPrinterConnected,
  onLogout 
}: { 
  shopName: string; 
  shopAddress: string; 
  isPrinterConnected: boolean;
  onLogout: () => void 
}) => (
  <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 py-6 flex justify-between items-center shadow-md overflow-hidden min-h-[100px]">
    {/* Background Image Overlay */}
    <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
      <img 
        src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1000&auto=format&fit=crop" 
        alt="Warung Background" 
        className="w-full h-full object-cover scale-125"
        referrerPolicy="no-referrer"
      />
    </div>
    
    <div className="flex items-center gap-4 relative z-10">
      <div className="bg-orange-500 p-2.5 rounded-2xl shadow-xl shadow-orange-200">
        <Store className="w-7 h-7 text-white" />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <h1 className="font-black text-xl text-gray-800 truncate max-w-[220px] leading-tight tracking-tight">
            {shopName}
          </h1>
          {isPrinterConnected && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-green-100 text-green-600 p-1 rounded-full"
              title="Printer Terhubung"
            >
              <Printer className="w-3.5 h-3.5" />
            </motion.div>
          )}
        </div>
        <p className="text-[11px] text-gray-500 font-bold truncate max-w-[220px] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
          {shopAddress}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 relative z-10">
      <button 
        onClick={onLogout}
        className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
      >
        <LogOut className="w-6 h-6" />
      </button>
    </div>
  </header>
);

const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (tab: string) => void }) => {
  const tabs = [
    { id: 'input', icon: Plus, label: 'Input' },
    { id: 'orders', icon: ClipboardList, label: 'Pesanan' },
    { id: 'sales', icon: TrendingUp, label: 'Penjualan' },
    { id: 'reports', icon: FileText, label: 'Laporan' },
    { id: 'settings', icon: Settings, label: 'Pengaturan' },
  ];

  return (
    <nav className="sticky bottom-0 z-50 bg-white border-t border-gray-100 flex justify-around items-center py-1.5 px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === tab.id ? 'text-orange-500' : 'text-gray-400'
          }`}
        >
          <tab.icon className="w-5 h-5" />
          <span className="text-[9px] font-medium">{tab.label}</span>
          {activeTab === tab.id && (
            <motion.div 
              layoutId="activeTab"
              className="w-1 h-1 bg-orange-50 rounded-full mt-0.5"
            />
          )}
        </button>
      ))}
    </nav>
  );
};

// --- Views ---

const InputView = ({ menu, onAddOrder }: { menu: MenuItem[]; onAddOrder: (order: any) => void }) => {
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemNote, setItemNote] = useState('');

  const filteredMenu = menu
    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const openItemPopup = (item: MenuItem) => {
    setSelectedItem(item);
    setItemQty(1);
    setItemNote('');
  };

  const addToCart = () => {
    if (!selectedItem) return;
    
    setCart(prev => {
      const existing = prev.find(i => i.id === selectedItem.id && i.note === itemNote);
      if (existing) {
        return prev.map(i => (i.id === selectedItem.id && i.note === itemNote)
          ? { ...i, quantity: i.quantity + itemQty } 
          : i
        );
      }
      return [...prev, { ...selectedItem, quantity: itemQty, note: itemNote }];
    });
    setSelectedItem(null);
  };

  const removeFromCart = (id: string, note?: string) => {
    setCart(prev => prev.filter(i => !(i.id === id && i.note === note)));
  };

  const updateQty = (id: string, note: string | undefined, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id && i.note === note) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const isFormValid = customerName.trim() !== '' && cart.length > 0;

  const handleSubmit = () => {
    if (!isFormValid) {
      if (cart.length === 0) alert("Pilih menu terlebih dahulu");
      else if (!customerName.trim()) alert("Nama pelanggan wajib diisi");
      return;
    }
    onAddOrder({
      customerName,
      tableNumber,
      items: cart,
      totalPrice: total,
      status: 'proses'
    });
    setCart([]);
    setCustomerName('');
    setTableNumber('');
  };

  return (
    <div className="flex flex-col h-full gap-4 pb-20">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 space-y-3">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Nama Pelanggan" 
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-orange-500"
          />
          <input 
            type="text" 
            placeholder="Meja" 
            value={tableNumber}
            onChange={e => setTableNumber(e.target.value)}
            className="w-20 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Cari menu..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {filteredMenu.map((item, idx) => (
          <motion.button
            whileTap={{ scale: 0.95 }}
            key={`${item.id}-${idx}`}
            onClick={() => openItemPopup(item)}
            className="bg-white p-2 rounded-xl shadow-sm border border-gray-50 text-left flex flex-col justify-between h-20"
          >
            <span className="font-semibold text-xs text-gray-800 line-clamp-2 leading-tight">{item.name}</span>
            <span className="text-orange-500 font-bold text-xs">Rp {item.price.toLocaleString('id-ID')}</span>
          </motion.button>
        ))}
      </div>

      {/* Popup Detail Item */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="text-center">
                <h3 className="font-bold text-lg text-gray-800">{selectedItem.name}</h3>
                <p className="text-orange-500 font-bold">Rp {selectedItem.price.toLocaleString('id-ID')}</p>
              </div>

              <div className="flex flex-col items-center gap-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Jumlah Porsi</label>
                <div className="flex items-center gap-6 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                  <button 
                    onClick={() => setItemQty(Math.max(1, itemQty - 1))}
                    className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-orange-500 font-bold text-xl"
                  >
                    -
                  </button>
                  <span className="text-2xl font-black text-gray-800 w-8 text-center">{itemQty}</span>
                  <button 
                    onClick={() => setItemQty(itemQty + 1)}
                    className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-orange-500 font-bold text-xl"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-2">Catatan (Opsional)</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Pedas, Tanpa Es..." 
                  value={itemNote}
                  onChange={e => setItemNote(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 bg-gray-100 text-gray-500 font-bold py-3 rounded-xl"
                >
                  Batal
                </button>
                <button 
                  onClick={addToCart}
                  className="flex-2 bg-orange-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-200"
                >
                  Tambah
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Current Order Table */}
      {cart.length > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 space-y-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-orange-500" />
            Pesanan Saat Ini
          </h3>
          <div className="space-y-3">
            {cart.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800 truncate">{item.name}</div>
                  {item.note && <div className="text-[10px] text-gray-400 italic leading-tight">"{item.note}"</div>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-gray-50 rounded-lg border border-gray-100">
                    <button onClick={() => updateQty(item.id, item.note, -1)} className="px-2 py-1 text-orange-500 font-bold">-</button>
                    <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, item.note, 1)} className="px-2 py-1 text-orange-500 font-bold">+</button>
                  </div>
                  <div className="w-16 text-right font-bold text-orange-500 text-xs">
                    {(item.price * item.quantity).toLocaleString('id-ID')}
                  </div>
                  <button onClick={() => removeFromCart(item.id, item.note)} className="text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-dashed border-gray-100 flex justify-between items-center">
            <div className="text-xs text-gray-400 font-bold uppercase">Total Bayar</div>
            <div className="text-lg font-black text-orange-500">Rp {total.toLocaleString('id-ID')}</div>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={!isFormValid}
            className={`w-full font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all ${
              isFormValid 
                ? 'bg-orange-500 text-white shadow-orange-100' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
            }`}
          >
            SIMPAN PESANAN
          </button>
        </div>
      )}
    </div>
  );
};

const OrderDetailPopup = ({ 
  order, 
  onClose, 
  onUpdateStatus, 
  onPrint 
}: { 
  order: Order; 
  onClose: () => void; 
  onUpdateStatus: (id: string, status: OrderStatus, paymentMethod?: 'cash' | 'bank') => void;
  onPrint: (order: Order, payment?: { type: 'cash' | 'bank', amount: number, change: number }) => void;
}) => {
  const [paymentType, setPaymentType] = useState<'cash' | 'bank' | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);

  const amount = parseInt(cashAmount.replace(/[^0-9]/g, '')) || 0;
  const change = paymentType === 'cash' ? amount - order.totalPrice : 0;

  const handleSavePayment = () => {
    if (paymentType === 'cash' && amount < order.totalPrice) {
      alert("Uang bayar kurang!");
      return;
    }
    setShowReceipt(true);
  };

  const handleFinish = () => {
    onUpdateStatus(order.id, 'selesai', paymentType || 'cash');
    onPrint(order, { 
      type: paymentType || 'cash', 
      amount: paymentType === 'cash' ? amount : order.totalPrice, 
      change 
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {!showReceipt ? (
          <>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <div className="text-[10px] font-bold text-orange-500 uppercase">Antrian #{order.queueNumber}</div>
                <h3 className="font-bold text-gray-800">{order.customerName}</h3>
              </div>
              <button onClick={onClose} className="p-2 text-gray-400">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Detail Pesanan</div>
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <div className="flex-1">
                        <div className="font-medium text-gray-700">{item.quantity}x {item.name}</div>
                        {item.note && <div className="text-[9px] text-gray-400 italic">"{item.note}"</div>}
                      </div>
                      <div className="font-bold text-gray-800">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-dashed border-gray-200 flex justify-between items-center">
                <div className="text-xs font-bold text-gray-400 uppercase">Total</div>
                <div className="text-lg font-black text-orange-500">Rp {order.totalPrice.toLocaleString('id-ID')}</div>
              </div>

              {order.status === 'proses' && (
                <div className="space-y-3 pt-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Metode Pembayaran</div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setPaymentType('cash')}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                        paymentType === 'cash' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-100 text-gray-400'
                      }`}
                    >
                      Bayar Cash
                    </button>
                    <button 
                      onClick={() => setPaymentType('bank')}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                        paymentType === 'bank' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-100 text-gray-400'
                      }`}
                    >
                      Bayar Bank
                    </button>
                  </div>

                  {paymentType === 'cash' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Uang Tunai</label>
                      <input 
                        type="text"
                        placeholder="Masukkan jumlah uang..."
                        value={cashAmount ? parseInt(cashAmount.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                        onChange={e => setCashAmount(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-orange-500"
                      />
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100">
              {order.status === 'proses' ? (
                <button 
                  disabled={!paymentType}
                  onClick={handleSavePayment}
                  className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-orange-100 disabled:opacity-50 active:scale-95 transition-all"
                >
                  SIMPAN & SELESAIKAN
                </button>
              ) : (
                <button 
                  onClick={() => onPrint(order)}
                  className="w-full bg-gray-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" /> CETAK ULANG STRUK
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="p-6 space-y-6 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-800">Pembayaran Berhasil</h3>
              <div className="bg-gray-50 p-4 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Total Tagihan</span>
                  <span className="font-bold text-gray-800">Rp {order.totalPrice.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Dibayar ({paymentType === 'cash' ? 'Tunai' : 'Bank'})</span>
                  <span className="font-bold text-gray-800">Rp {(paymentType === 'cash' ? amount : order.totalPrice).toLocaleString('id-ID')}</span>
                </div>
                <div className="pt-2 border-t border-dashed border-gray-200 flex justify-between text-sm">
                  <span className="font-bold text-gray-800">Kembalian</span>
                  <span className="font-black text-orange-500">Rp {Math.max(0, change).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={handleFinish}
              className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-orange-100"
            >
              SELESAI & CETAK STRUK
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const OrdersView = ({ orders, onUpdateStatus, onPrint }: { 
  orders: Order[]; 
  onUpdateStatus: (id: string, status: OrderStatus, paymentMethod?: 'cash' | 'bank') => void;
  onPrint: (order: Order, payment?: { type: 'cash' | 'bank', amount: number, change: number }) => void;
}) => {
  const [activeTab, setActiveTab] = useState<'proses' | 'selesai'>('proses');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = orders
    .filter(o => {
      if (activeTab === 'proses') return o.status === 'proses';
      // Use local date comparison
      const orderDate = new Date(o.timestamp).toLocaleDateString('en-CA'); // YYYY-MM-DD
      const todayDate = new Date().toLocaleDateString('en-CA');
      return o.status === 'selesai' && orderDate === todayDate;
    })
    .sort((a, b) => a.customerName.localeCompare(b.customerName));

  const displayOrders = activeTab === 'selesai' ? filteredOrders.slice(0, 20) : filteredOrders;

  return (
    <div className="space-y-4 pb-24">
      {/* Tab Switcher - Removed sticky to prevent overlapping */}
      <div className="flex gap-2 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
        {(['proses', 'selesai'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            {tab === 'proses' ? 'Pesanan Proses' : 'Pesanan Selesai'}
          </button>
        ))}
      </div>

      <div className="space-y-2 pt-2">
        {displayOrders.length === 0 ? (
          <div className="text-center py-20 text-gray-400 space-y-2">
            <ClipboardList className="w-10 h-10 mx-auto opacity-20" />
            <p className="text-xs">Tidak ada pesanan {activeTab}</p>
          </div>
        ) : (
          displayOrders.map((order, idx) => (
            <motion.div 
              layout
              key={`${order.id}-${idx}`}
              onClick={() => setSelectedOrder(order)}
              className="bg-white p-3 rounded-xl shadow-sm border border-gray-50 flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="w-12 h-12 bg-orange-50 rounded-lg flex flex-col items-center justify-center shrink-0 border border-orange-100">
                <span className="text-[8px] font-bold text-orange-400 uppercase leading-none">Antrian</span>
                <span className="text-sm font-black text-orange-600 leading-none mt-0.5">{order.queueNumber}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-gray-800 text-xs truncate">{order.customerName}</h3>
                  <span className="text-orange-500 font-black text-xs ml-2 shrink-0">Rp {order.totalPrice.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 font-medium">Meja {order.tableNumber}</span>
                  <span className="text-[10px] text-gray-200">•</span>
                  <span className="text-[10px] text-gray-400">{order.items.length} item</span>
                  <span className="text-[10px] text-gray-200">•</span>
                  <span className="text-[10px] text-gray-400">{new Date(order.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
              
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailPopup 
            order={selectedOrder} 
            onClose={() => setSelectedOrder(null)}
            onUpdateStatus={onUpdateStatus}
            onPrint={onPrint}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const SalesView = ({ orders }: { orders: Order[] }) => {
  const finishedOrders = orders.filter(o => o.status === 'selesai');
  
  const now = new Date();
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));

  // Generate months from January to current month
  const months = [];
  for (let m = 0; m <= now.getMonth(); m++) {
    months.push(new Date(now.getFullYear(), m, 1));
  }

  const selectedMonth = viewDate.getMonth();
  const selectedYear = viewDate.getFullYear();

  const monthOrders = finishedOrders.filter(o => {
    const d = new Date(o.timestamp);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const monthlyTotal = monthOrders.reduce((sum, o) => sum + o.totalPrice, 0);

  // Calculate PPh Final (PP55) - 0.5% for cumulative sales > 500M per year
  const prevMonthsOrders = finishedOrders.filter(o => {
    const d = new Date(o.timestamp);
    return d.getFullYear() === selectedYear && d.getMonth() < selectedMonth;
  });
  const prevCumulative = prevMonthsOrders.reduce((sum, o) => sum + o.totalPrice, 0);
  const totalCumulative = prevCumulative + monthlyTotal;
  const threshold = 500000000;
  
  let pphFinal = 0;
  if (totalCumulative > threshold) {
    const taxableAmount = prevCumulative >= threshold 
      ? monthlyTotal 
      : totalCumulative - threshold;
    pphFinal = taxableAmount * 0.005;
  }

  // Get number of days in selected month
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  // If it's the current month, only show up to today
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const maxDay = isCurrentMonth ? now.getDate() : daysInMonth;

  const dailyData: { date: number; cash: number; bank: number; total: number }[] = [];
  for (let i = 1; i <= maxDay; i++) {
    const dayOrders = monthOrders.filter(o => new Date(o.timestamp).getDate() === i);
    
    const cash = dayOrders
      .filter(o => o.payment_method === 'cash' || !o.payment_method)
      .reduce((sum, o) => sum + o.totalPrice, 0);
    
    const bank = dayOrders
      .filter(o => o.payment_method === 'bank')
      .reduce((sum, o) => sum + o.totalPrice, 0);
      
    dailyData.push({
      date: i,
      cash,
      bank,
      total: cash + bank
    });
  }

  const formatCurrency = (amount: number) => {
    return (
      <div className="flex justify-between w-full">
        <span className="text-gray-400 font-normal">Rp</span>
        <span>{amount.toLocaleString('id-ID')}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Month Selector - Horizontal Scroll */}
      <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar snap-x">
        {months.map((date, idx) => {
          const isActive = viewDate.getMonth() === date.getMonth();
          return (
            <button 
              key={idx}
              onClick={() => setViewDate(date)}
              className={`snap-center shrink-0 px-6 py-2.5 rounded-2xl text-xs font-black transition-all shadow-sm border ${
                isActive 
                  ? 'bg-orange-500 text-white border-orange-400 shadow-orange-100' 
                  : 'bg-white text-gray-400 border-gray-100'
              }`}
            >
              {date.toLocaleString('id-ID', { month: 'long' }).toUpperCase()}
            </button>
          );
        })}
      </div>

      <motion.div 
        key={viewDate.getTime()}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-3xl text-white shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Total Penjualan {viewDate.toLocaleString('id-ID', { month: 'long' })}</p>
              <h2 className="text-2xl font-black">Rp {monthlyTotal.toLocaleString('id-ID')}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-right">
            <div className="p-2 bg-white/20 rounded-xl">
              <Receipt size={20} />
            </div>
            <div>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest">PPh Final (PP55)</p>
              <h2 className="text-xl font-black leading-tight">Rp {pphFinal.toLocaleString('id-ID')}</h2>
              <p className="text-[8px] opacity-60 font-bold">0.5% (Threshold 500jt)</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold bg-black/10 p-2 rounded-lg">
          <Calendar size={12} />
          <span>{viewDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</span>
        </div>
      </motion.div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <ClipboardList className="w-4 h-4 text-orange-500" />
          <h3 className="font-bold text-gray-800 text-xs uppercase tracking-tight">Detil Harian</h3>
        </div>
        
        <div className="bg-white rounded-2xl border border-gray-50 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[400px]">
            <thead>
              <tr className="bg-gray-50 text-[9px] uppercase font-black text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3 w-16">Tgl</th>
                <th className="px-4 py-3 text-right">Cash</th>
                <th className="px-4 py-3 text-right">Bank</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="text-[11px]">
              {dailyData.reverse().map((day, idx) => (
                <tr key={idx} className="border-b border-gray-50 active:bg-orange-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-600 font-bold">{day.date}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-700">
                    {formatCurrency(day.cash)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-700">
                    {formatCurrency(day.bank)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-black text-gray-800 bg-orange-50/30">
                    {formatCurrency(day.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ 
  user, 
  menu, 
  isPrinterConnected,
  onAddMenu, 
  onUpdateMenu,
  onConnectPrinter,
  onPrintTest
}: { 
  user: User; 
  menu: MenuItem[]; 
  isPrinterConnected: boolean;
  onAddMenu: (item: any) => void; 
  onUpdateMenu: (id: string, item: any) => void;
  onConnectPrinter: () => void;
  onPrintTest: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'toko' | 'menu'>('toko');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const formatRupiah = (val: string) => {
    const number = val.replace(/[^0-9]/g, '');
    if (!number) return '';
    return parseInt(number).toLocaleString('id-ID');
  };

  const parseRupiah = (val: string) => {
    return parseInt(val.replace(/[^0-9]/g, '')) || 0;
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setNewName(item.name);
    setNewPrice(item.price.toLocaleString('id-ID'));
    setActiveTab('menu');
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setNewName('');
    setNewPrice('');
  };

  const sortedMenu = [...menu].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4 pb-24">
      {/* Tab Switcher - Removed sticky to prevent overlapping content */}
      <div className="flex gap-2 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
        {(['toko', 'menu'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            {tab === 'toko' ? 'Info Warung' : 'Kelola Menu'}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="pt-2">
        {activeTab === 'toko' ? (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-50 shadow-sm space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-500 shadow-inner">
                  <Store className="w-7 h-7" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-black text-gray-800 leading-tight">{user.nama}</h2>
                  <p className="text-[10px] text-gray-400 font-bold tracking-wider">ID: {user.user}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-dashed border-gray-100 space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-gray-400 tracking-widest">Alamat Lengkap</label>
                  <p className="text-xs text-gray-600 leading-relaxed font-medium">{user.alamat}</p>
                </div>
              </div>
            </div>

            <button 
              onClick={onConnectPrinter}
              disabled={isPrinterConnected}
              className={`w-full p-4 rounded-2xl text-xs font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all ${
                isPrinterConnected 
                  ? 'bg-green-500 text-white shadow-green-100' 
                  : 'bg-gray-900 text-white shadow-gray-200'
              }`}
            >
              <Printer className="w-4 h-4" />
              {isPrinterConnected ? 'PRINTER TERHUBUNG' : 'HUBUNGKAN PRINTER BLUETOOTH'}
            </button>

            {isPrinterConnected && (
              <button 
                onClick={onPrintTest}
                className="w-full bg-orange-100 text-orange-600 p-4 rounded-2xl text-xs font-black flex items-center justify-center gap-3 shadow-sm active:scale-95 transition-all border border-orange-200"
              >
                <Printer className="w-4 h-4" />
                CETAK TEST PRINT
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-50 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-gray-800 uppercase tracking-tight">
                  {editingItem ? 'Edit Menu' : 'Tambah Menu Baru'}
                </h4>
                {editingItem && (
                  <button 
                    onClick={handleCancelEdit}
                    className="text-[9px] font-bold text-red-500 uppercase bg-red-50 px-2 py-1 rounded-md"
                  >
                    Batal Edit
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Nama Menu" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-medium"
                />
                <input 
                  type="text" 
                  placeholder="Harga" 
                  value={newPrice}
                  onChange={e => setNewPrice(formatRupiah(e.target.value))}
                  className="w-28 bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-bold"
                />
              </div>
              <button 
                onClick={() => {
                  if (newName && newPrice) {
                    const price = parseRupiah(newPrice);
                    if (editingItem) {
                      onUpdateMenu(editingItem.id, { name: newName, price });
                      setEditingItem(null);
                    } else {
                      onAddMenu({ name: newName, price });
                    }
                    setNewName('');
                    setNewPrice('');
                  }
                }}
                className="w-full bg-orange-500 text-white py-3 rounded-xl text-xs font-black shadow-lg shadow-orange-100 active:scale-95 transition-all"
              >
                {editingItem ? 'UPDATE MENU' : 'SIMPAN MENU'}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-50 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[9px] uppercase font-black text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-3 w-12">No</th>
                    <th className="px-4 py-3">Nama Menu</th>
                    <th className="px-4 py-3 text-right">Harga</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {sortedMenu.map((item, idx) => (
                    <tr 
                      key={item.id} 
                      onClick={() => handleEdit(item)}
                      className={`border-b border-gray-50 active:bg-orange-50 transition-colors cursor-pointer ${
                        editingItem?.id === item.id ? 'bg-orange-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-400 font-bold">{idx + 1}</td>
                      <td className="px-4 py-3 font-bold text-gray-700">{item.name}</td>
                      <td className="px-4 py-3 text-right font-black text-orange-500">
                        {item.price.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import { isSupabaseConfigured } from './lib/supabase';

const LoginView = ({ onLogin }: { onLogin: (u: string, p: string) => void }) => {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-orange-500 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl space-y-8"
      >
        {!isSupabaseConfigured && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase">
              <XCircle className="w-4 h-4" /> Konfigurasi Diperlukan
            </div>
            <p className="text-[10px] text-red-500 leading-relaxed">
              Supabase URL atau Anon Key belum diset. Silakan masukkan di panel <b>Secrets</b> di AI Studio (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY).
            </p>
          </div>
        )}

        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center text-orange-500 mx-auto mb-4">
            <Store className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-gray-800">Warung Jxxcok</h1>
          <p className="text-gray-400 text-sm">Masuk ke sistem POS Anda</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 ml-2">USER ID</label>
            <input 
              type="text" 
              value={u}
              onChange={e => setU(e.target.value)}
              placeholder="0601..."
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-orange-500 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 ml-2">PASSWORD</label>
            <input 
              type="password" 
              value={p}
              onChange={e => setP(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-orange-500 transition-all"
            />
          </div>
        </div>

        <button 
          disabled={loading}
          onClick={() => {
            setLoading(true);
            onLogin(u, p);
          }}
          className="w-full bg-orange-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-orange-200 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'Menghubungkan...' : 'MASUK SEKARANG'}
        </button>
      </motion.div>
    </div>
  );
};

const ReceiptPreview = ({ 
  order, 
  user, 
  payment,
  onClose, 
  onPrint 
}: { 
  order: Order; 
  user: User; 
  payment?: { type: 'cash' | 'bank', amount: number, change: number };
  onClose: () => void; 
  onPrint: () => void;
}) => (
  <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
    >
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-bold text-gray-800 text-sm">Preview Struk</h3>
        <button onClick={onClose} className="text-gray-400"><XCircle className="w-5 h-5" /></button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="bg-white p-5 shadow-sm font-mono text-[9px] leading-tight space-y-3">
          <div className="text-center space-y-1">
            <div className="font-bold text-xs">{user.nama}</div>
            <div>{user.alamat}</div>
            <div>--------------------------------</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between"><span>Antrian:</span> <span>#{order.queueNumber}</span></div>
            <div className="flex justify-between"><span>Pelanggan:</span> <span>{order.customerName}</span></div>
            <div className="flex justify-between"><span>Meja:</span> <span>{order.tableNumber}</span></div>
            <div>--------------------------------</div>
          </div>

          <div className="space-y-1">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="flex-1">{item.name}</span>
                <span className="w-4 text-center">{item.quantity}</span>
                <span className="w-16 text-right">{(item.price * item.quantity).toLocaleString('id-ID')}</span>
              </div>
            ))}
            <div>--------------------------------</div>
          </div>

          <div className="flex justify-between font-bold text-[10px]">
            <span>TOTAL:</span>
            <span>Rp {order.totalPrice.toLocaleString('id-ID')}</span>
          </div>

          {payment && (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>BAYAR ({payment.type.toUpperCase()}):</span>
                <span>Rp {payment.amount.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>KEMBALI:</span>
                <span>Rp {payment.change.toLocaleString('id-ID')}</span>
              </div>
              <div>--------------------------------</div>
            </div>
          )}
          
          <div className="text-center pt-2">
            <div>Terima Kasih!</div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <button 
          onClick={onPrint}
          className="w-full bg-gray-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs"
        >
          <Printer className="w-4 h-4" /> Cetak Sekarang
        </button>
      </div>
    </motion.div>
  </div>
);

const InstallBanner = ({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) => (
  <motion.div 
    initial={{ y: -50, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="bg-orange-600 text-white px-4 py-3 flex items-center justify-between shadow-lg relative z-[60]"
  >
    <div className="flex items-center gap-3">
      <div className="bg-white/20 p-1.5 rounded-lg">
        <Store className="w-4 h-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Aplikasi POS</span>
        <span className="text-xs font-black">Gunakan sebagai Aplikasi</span>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button 
        onClick={onInstall}
        className="bg-white text-orange-600 px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm active:scale-95 transition-all"
      >
        INSTALL
      </button>
      <button onClick={onDismiss} className="p-1 opacity-60">
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  </motion.div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('input');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [salesOrders, setSalesOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOrder, setPreviewOrder] = useState<{ order: Order; payment?: any } | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const savedUser = orderService.getCurrentUser();
    if (savedUser) {
      setUser(savedUser);
      loadData(savedUser.user);
    } else {
      setLoading(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const loadData = async (userId: string) => {
    try {
      await orderService.initializeAccounts(userId);
      const [m, o, s] = await Promise.all([
        orderService.getMenuItems(userId),
        orderService.getOrders(userId),
        orderService.getMonthlySalesData(userId)
      ]);
      setMenu(m);
      setOrders(o);
      setSalesOrders(s);
    } catch (e) {
      console.error("Gagal memuat data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (u: string, p: string) => {
    try {
      const loggedIn = await orderService.login(u, p);
      if (loggedIn) {
        setUser(loggedIn);
        loadData(loggedIn.user);
      } else {
        alert("Login gagal. Periksa User ID dan Password.");
      }
    } catch (e) {
      alert("Terjadi kesalahan koneksi.");
    }
  };

  const handleLogout = () => {
    orderService.logout();
    setUser(null);
    setActiveTab('input');
  };

  const handleAddOrder = async (orderData: any) => {
    try {
      setLoading(true);
      await orderService.saveOrder(orderData);
      if (user) await loadData(user.user);
      setActiveTab('orders');
    } catch (e) {
      alert("Gagal menyimpan pesanan.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: OrderStatus, paymentMethod?: 'cash' | 'bank') => {
    try {
      setLoading(true);
      await orderService.updateOrderStatus(id, status, paymentMethod);
      if (user) await loadData(user.user);
    } catch (e) {
      console.error("Update failed:", e);
      alert("Gagal memperbarui status: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddMenu = async (itemData: any) => {
    try {
      setLoading(true);
      await orderService.saveMenuItem(itemData);
      if (user) await loadData(user.user);
    } catch (e) {
      alert("Gagal menyimpan menu.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMenu = async (id: string, itemData: any) => {
    try {
      setLoading(true);
      await orderService.updateMenuItem(id, itemData);
      if (user) await loadData(user.user);
    } catch (e) {
      alert("Gagal memperbarui menu.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <LoginView onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-7xl mx-auto relative shadow-2xl">
      <Header 
        shopName={user.nama} 
        shopAddress={user.alamat} 
        isPrinterConnected={isPrinterConnected}
        onLogout={handleLogout} 
      />
      
      <AnimatePresence>
        {showInstallBanner && (
          <InstallBanner 
            onInstall={handleInstallClick} 
            onDismiss={() => setShowInstallBanner(false)} 
          />
        )}
      </AnimatePresence>
      
      <main className="flex-1 p-4 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'input' && <InputView menu={menu} onAddOrder={handleAddOrder} />}
            {activeTab === 'orders' && (
              <OrdersView 
                orders={orders} 
                onUpdateStatus={handleUpdateStatus} 
                onPrint={(order, payment) => setPreviewOrder({ order, payment })}
              />
            )}
            {activeTab === 'sales' && <SalesView orders={salesOrders} />}
            {activeTab === 'reports' && <ReportsView user={user} />}
            {activeTab === 'settings' && (
              <SettingsView 
                user={user} 
                menu={menu} 
                isPrinterConnected={isPrinterConnected}
                onAddMenu={handleAddMenu} 
                onUpdateMenu={handleUpdateMenu}
                onConnectPrinter={async () => {
                  try {
                    await bluetoothService.connect();
                    setIsPrinterConnected(true);
                  } catch (e) {
                    setIsPrinterConnected(false);
                    alert("Gagal menghubungkan printer.");
                  }
                }}
                onPrintTest={async () => {
                  try {
                    await bluetoothService.printTest(user.nama);
                  } catch (e) {
                    alert("Gagal mencetak test print.");
                  }
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {previewOrder && user && (
        <ReceiptPreview 
          order={previewOrder.order} 
          user={user} 
          payment={previewOrder.payment}
          onClose={() => setPreviewOrder(null)}
          onPrint={async () => {
            try {
              await bluetoothService.printReceipt(previewOrder.order, user.nama, user.alamat, previewOrder.payment);
              setIsPrinterConnected(true);
            } catch (e) {
              setIsPrinterConnected(false);
              alert("Gagal mencetak. Pastikan printer terhubung.");
            }
            setPreviewOrder(null);
          }}
        />
      )}

      {loading && (
        <div className="fixed inset-0 z-[200] bg-white/50 backdrop-blur-sm flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}
