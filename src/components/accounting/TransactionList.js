import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  X, 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Landmark, 
  Banknote, 
  CheckCircle2, 
  ReceiptText 
} from 'lucide-react';
import { formatCurrency, formatDate, sortData, getTransactionTotals, getBillStats } from '../../utils/helpers';

const TransactionList = ({ data, setViewDetail, setModal, listFilter = 'all', listPaymentMode = '', categoryFilter = '' }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [sort, setSort] = useState('DateDesc');
    const [filter, setFilter] = useState(listFilter);
    const [visibleCount, setVisibleCount] = useState(50);
    const [selectedIds, setSelectedIds] = useState([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const longPressTimer = useRef(null);

    useEffect(() => { setFilter(listFilter); }, [listFilter]);

    // Handle Back Button Warning
    useEffect(() => {
        const handleBack = () => {
            if (isSelectionMode) {
                if(window.confirm("Selection will be lost. Exit selection mode?")) {
                    setIsSelectionMode(false);
                    setSelectedIds([]);
                }
                window.history.pushState(null, '', ''); 
            }
        };
        if(isSelectionMode) {
            window.history.pushState(null, '', ''); 
            window.addEventListener('popstate', handleBack);
        }
        return () => window.removeEventListener('popstate', handleBack);
    }, [isSelectionMode]);

    const linksMap = useMemo(() => {
        const map = {}; 
        data.transactions.forEach(tx => {
            if (tx.linkedBills && tx.status !== 'Cancelled') {
                tx.linkedBills.forEach(link => {
                    const targetId = String(link.billId);
                    if (!map[targetId]) map[targetId] = 0;
                    map[targetId] += parseFloat(link.amount || 0);
                });
            }
        });
        return map;
    }, [data.transactions]);

    const filtered = useMemo(() => {
        return data.transactions.filter(tx => {
            if (filter !== 'all' && tx.type !== filter) return false;
            if (listPaymentMode && (tx.paymentMode || 'Cash') !== listPaymentMode) return false;
            if (categoryFilter && tx.category !== categoryFilter) return false;
            if (dateRange && dateRange.start && tx.date < dateRange.start) return false;
            if (dateRange && dateRange.end && tx.date > dateRange.end) return false;
            
            if (listPaymentMode) {
                if (tx.type === 'estimate') return false;
                const amt = ['sales'].includes(tx.type) ? parseFloat(tx.received||0) : 
                           ['purchase','expense'].includes(tx.type) ? parseFloat(tx.paid||0) : parseFloat(tx.amount||0);
                if (amt <= 0) return false;
            }
            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                const party = data.parties.find(p => p.id === tx.partyId);
                const matchVoucher = tx.id.toLowerCase().includes(lowerQuery);
                const matchName = (party?.name || tx.category || '').toLowerCase().includes(lowerQuery);
                const matchDesc = (tx.description || '').toLowerCase().includes(lowerQuery);
                const matchAmount = (tx.amount || tx.finalTotal || 0).toString().includes(lowerQuery);
                return matchVoucher || matchName || matchDesc || matchAmount;
            }
            return true;
        });
    }, [data.transactions, filter, listPaymentMode, categoryFilter, dateRange, searchQuery, data.parties]);

    const statsData = useMemo(() => {
        return filtered.reduce((acc, tx) => {
            if (tx.status === 'Cancelled' || tx.status === 'cancelled') return acc;
            const amount = parseFloat(tx.amount || tx.finalTotal || 0);
            acc.total += amount;
            if(['sales', 'purchase', 'expense'].includes(tx.type)) {
               const linkedPaid = linksMap[String(tx.id)] || 0;
                const directPaid = parseFloat(tx.received || tx.paid || 0);
                const totalPaid = linkedPaid + directPaid;
                const pending = Math.max(0, amount - totalPaid);
                acc.pending += pending;
            }
            return acc;
        }, { total: 0, pending: 0 });
    }, [filtered, linksMap]);

    const selectedTotal = useMemo(() => {
        return filtered
            .filter(t => selectedIds.includes(t.id))
            .reduce((sum, t) => sum + parseFloat(t.amount || t.finalTotal || 0), 0);
    }, [selectedIds, filtered]);

    const sortedData = useMemo(() => sortData(filtered, sort), [filtered, sort]);
    const visibleData = sortedData.slice(0, visibleCount);

    const ignoreClick = useRef(false);

    const handleHold = (id) => {
        longPressTimer.current = setTimeout(() => {
            ignoreClick.current = true;
            setIsSelectionMode(true);
            toggleSelect(id);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 600);
    };

    const handleRelease = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleClick = (tx) => {
        if (ignoreClick.current) {
            ignoreClick.current = false;
            return;
        }
        setViewDetail({ type: 'transaction', id: tx.id });
    };

    return (
      <div className="space-y-4 px-1">
        <div className="flex flex-col gap-4">
           {isSelectionMode ? (
               <div className="bg-blue-600 p-4 rounded-3xl text-white flex justify-between items-center animate-in slide-in-from-top sticky top-4 z-20 shadow-2xl">
                   <div>
                       <p className="text-xs font-bold opacity-75 uppercase tracking-wider">{selectedIds.length} Selected</p>
                       <p className="text-2xl font-black">{formatCurrency(selectedTotal)}</p>
                   </div>
                   <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><X/></button>
               </div>
           ) : (
               <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                          {listPaymentMode ? `${listPaymentMode} Book` : `Accounting ${categoryFilter ? `(${categoryFilter})` : ''}`}
                        </h1>
                        {listPaymentMode && (
                            <button onClick={() => setModal({ type: 'adjustCash', data: { mode: listPaymentMode } })} className="px-3 py-1 bg-gray-900 text-white text-[10px] rounded-full font-bold uppercase tracking-widest hover:bg-black transition-colors">Adjust {listPaymentMode}</button>
                        )}
                    </div>
                    <select className="bg-white border text-xs font-bold p-2 px-4 rounded-2xl outline-none shadow-sm focus:ring-2 focus:ring-blue-500" value={sort} onChange={e => setSort(e.target.value)}>
                        <option value="DateDesc">Newest</option>
                        <option value="DateAsc">Oldest</option>
                        <option value="AmtDesc">High Amt</option>
                        <option value="AmtAsc">Low Amt</option>
                    </select>
                  </div>
                  <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1">Start Date</label>
                        <input type="date" className="w-full p-3 border rounded-2xl text-xs bg-white shadow-sm font-medium" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1">End Date</label>
                        <input type="date" className="w-full p-3 border rounded-2xl text-xs bg-white shadow-sm font-medium" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                      </div>
                  </div>
                </div>
           )}

            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input className="w-full pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-3xl text-sm font-medium shadow-sm transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none" placeholder="Search invoices, clients, notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
        </div>

                <div className="flex justify-between items-center mb-2 px-1">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <p className="text-[7px] font-black text-blue-500 uppercase tracking-widest leading-none">Flow ({filtered.length} tx)</p>
                            <p className="text-sm font-black text-gray-900 tracking-tighter">{formatCurrency(statsData.total)}</p>
                        </div>
                        <div className="w-px h-6 bg-gray-100 mx-1"></div>
                        <div className="flex flex-col">
                            <p className="text-[7px] font-black text-red-500 uppercase tracking-widest leading-none">Due ({filtered.filter(t=>linksMap[t.id]<parseFloat(t.amount||t.finalTotal||0)).length} tx)</p>
                            <p className="text-sm font-black text-red-600 tracking-tighter">{formatCurrency(statsData.pending)}</p>
                        </div>
                    </div>
                </div>

        {!isSelectionMode && (
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                {['all', 'sales', 'estimate', 'purchase', 'expense', 'payment'].map(t => (
                    <button 
                        key={t} 
                        onClick={() => { setFilter(t); setSearchQuery(''); }} 
                        className={`px-6 py-2.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-all duration-300 border ${filter === t ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>
        )}

        <div className="space-y-4 pb-20">
          {visibleData.map(tx => {
            const party = data.parties.find(p => p.id === tx.partyId);
            const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
            
            let totalAmt = parseFloat(tx.amount || tx.finalTotal || 0);
            if (listPaymentMode) {
                 if (tx.type === 'sales') totalAmt = parseFloat(tx.received || 0);
                 else if (tx.type === 'purchase' || tx.type === 'expense') totalAmt = parseFloat(tx.paid || 0);
            }
            
            const linkedPaid = linksMap[tx.id] || 0;
            const directPaid = parseFloat(tx.received || tx.paid || 0);
            const totalPaid = linkedPaid + directPaid;
            const pendingAmt = Math.max(0, totalAmt - totalPaid);
            
            let status = 'UNPAID';
            if (pendingAmt <= 0.5) status = 'PAID'; 
            else if (totalPaid > 0) status = 'PARTIAL';
            
            const payStats = tx.type === 'payment' ? getBillStats(tx, data.transactions) : null,
            paymentStatus = payStats?.status || 'Unused',
            paymentUnused = payStats?.pending || 0;

            let typeLabel = tx.type;
            if(tx.type === 'payment') typeLabel = tx.subType === 'in' ? 'Payment IN' : 'Payment OUT';

            const mode = tx.paymentMode || 'Cash';
            const ModeIcon = (mode === 'Bank' || mode === 'UPI') ? Landmark : Banknote;
            const showPayIcon = (['sales','purchase','expense'].includes(tx.type) && (parseFloat(tx.received||0) > 0 || parseFloat(tx.paid||0) > 0));

            let Icon = ReceiptText, iconColor = 'text-gray-600', bg = 'bg-gray-100';
            if (tx.type === 'sales') { Icon = TrendingUp; iconColor = 'text-emerald-600'; bg = 'bg-emerald-50'; }
            if (tx.type === 'purchase') { Icon = ShoppingCart; iconColor = 'text-blue-600'; bg = 'bg-blue-50'; }
            if (tx.type === 'payment') { Icon = ModeIcon; iconColor = 'text-purple-600'; bg = 'bg-purple-50'; }
            
            const isCancelled = tx.status === 'Cancelled';
            const isSelected = selectedIds.includes(tx.id);
            
            return (
              <div 
                key={tx.id} 
                onTouchStart={() => handleHold(tx.id)}
                onTouchEnd={handleRelease}
                onMouseDown={() => handleHold(tx.id)}
                onMouseUp={handleRelease}
                onMouseLeave={handleRelease}
                onClick={() => handleClick(tx)}
                className={`p-5 rounded-3xl flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden group border border-transparent ${isCancelled ? 'opacity-40 grayscale bg-gray-50' : 'bg-white shadow-sm hover:shadow-md hover:border-blue-100'} ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200' : ''}`}
              >
                {isSelectionMode && (
                    <div className="mr-4 -ml-1 transition-all" onClick={(e) => { e.stopPropagation(); toggleSelect(tx.id); }}>
                         <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/20' : 'border-gray-200'}`}>
                             {isSelected && <CheckCircle2 size={14} className="text-white"/>}
                         </div>
                    </div>
                )}
                <div className="flex gap-5 items-center flex-1">
                  <div className={`p-4 rounded-2xl ${bg} ${iconColor} transition-transform group-hover:scale-110`}><Icon size={22} /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5"><p className="font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors">{party?.name || tx.category || 'Uncategorized'}</p></div>
                    <div className="text-[10px] text-gray-400 uppercase font-black tracking-widest flex flex-wrap gap-2 items-center">
                        {tx.type === 'payment' ? (
                            <div className="flex items-center gap-2">
                                <span className={`bg-gray-100 px-2 py-0.5 rounded-lg tracking-tight ${tx.subType === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>{tx.subType === 'in' ? 'Payment In' : 'Payment Out'}:{tx.id.split(':')[1] || tx.id}</span>
                                <span className="bg-gray-50 px-2 py-0.5 rounded-lg flex items-center gap-1"><ModeIcon size={12}/> {mode}</span>
                                <span>{formatDate(tx.date)}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="bg-gray-100 px-2 py-0.5 rounded-lg text-gray-600 tracking-tight">{tx.id}</span>
                                {showPayIcon && <span className="text-emerald-600 flex items-center gap-1 font-black" title={mode}><ModeIcon size={10}/> {mode}{directPaid > 0 ? `: ${formatCurrency(directPaid)}` : ''}</span>}
                                <span className="text-gray-300">|</span> 
                                <span>{formatDate(tx.date)}</span>
                            </div>
                        )} 
                    </div>
                    {(tx.type === 'payment' || (searchQuery && tx.description && tx.description.toLowerCase().includes(searchQuery.toLowerCase()))) && tx.description && ( 
                        <p className="text-[11px] text-gray-400 font-medium italic truncate max-w-[200px] mt-1">"{tx.description}"</p> 
                    )}
                    <div className="flex gap-2 mt-2">
                        {isCancelled ? (
                            <span className="text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest bg-gray-200 text-gray-600 shadow-inner">CANCELLED</span>
                        ) : (
                            <>
                                {['sales', 'purchase', 'expense'].includes(tx.type) && (
                                    <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-sm ${status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                                        {status}
                                    </span>
                                )}
                                {tx.type === 'payment' && (
                                    <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-sm ${payStats.status === 'FULLY USED' ? 'bg-emerald-100 text-emerald-800' : payStats.status === 'PARTIALLY USED' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                                        {payStats.status}
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black tracking-tight ${isCancelled ? 'text-gray-300 line-through' : isIncoming ? 'text-emerald-600' : 'text-rose-600'}`}>{isIncoming ? '+' : '-'}{formatCurrency(totalAmt)}</p>
                  {['sales', 'purchase', 'expense'].includes(tx.type) && status !== 'PAID' && !isCancelled && <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mt-1">Bal: {formatCurrency(pendingAmt)}</p>}
                  {tx.type === 'payment' && !isCancelled && paymentUnused > 0.1 && <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mt-1">Unused: {formatCurrency(paymentUnused)}</p>}
                </div>
              </div>
            );
          })}
          {visibleCount < filtered.length && ( 
            <button onClick={() => setVisibleCount(prev => prev + 50)} className="w-full py-5 bg-white border border-gray-100 text-gray-500 font-black uppercase tracking-widest rounded-3xl text-[10px] hover:bg-gray-50 hover:border-gray-200 transition-all shadow-sm">
                Load More Content ({filtered.length - visibleCount})
            </button> 
          )}
        </div>
      </div>
    );
};

export default TransactionList;
