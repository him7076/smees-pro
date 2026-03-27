import React, { useState, useMemo } from 'react';
import { ArrowLeft, Edit2, TrendingUp, ShoppingCart, Calendar, Search } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';

const ItemDetailView = ({ item, data, onBack, setViewDetail, setModal, pushHistory, itemStock }) => {
    const [activeBrand, setActiveBrand] = useState('All');

    // 1. Data Processing
    const processedData = useMemo(() => {
        const groups = { 'All': [] };
        const stats = { 'All': 0 };

        const sortedTxs = data.transactions
            .filter(tx => tx.status !== 'Cancelled' && tx.items?.some(l => l.itemId === item.id))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedTxs.forEach(tx => {
            const matchingLines = tx.items.filter(l => l.itemId === item.id);
            
            matchingLines.forEach(line => {
                const brand = line.brand || 'Uncategorized';
                const qty = parseFloat(line.qty || 0);
                const isOut = tx.type === 'sales';
                const movement = isOut ? -qty : qty;

                groups['All'].push({ tx, line });
                stats['All'] += movement;

                if (!groups[brand]) {
                    groups[brand] = [];
                    stats[brand] = 0;
                }
                groups[brand].push({ tx, line });
                stats[brand] += movement;
            });
        });
        return { groups, stats };
    }, [item, data.transactions]);

    const { groups, stats } = processedData;
    const currentList = groups[activeBrand] || [];
    const brands = Object.keys(groups).filter(k => k !== 'All').sort();

    if (!item) return null;

    return (
        <div id="detail-scroller" className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in slide-in-from-right duration-300 pb-24">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                    <h2 className="font-black text-slate-800 tracking-tight truncate max-w-[150px]">{item.name}</h2>
                </div>
                <button onClick={() => { setModal({ type: 'item', data: item }); }} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs hover:bg-blue-100 transition-colors">
                    <Edit2 size={14}/> Edit
                </button>
            </div>

            <div className="p-6 max-w-2xl mx-auto space-y-6">
                <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <ShoppingCart size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Inventory Status</p>
                                <h1 className="text-4xl font-black tracking-tighter">{itemStock[item.id] || 0} <span className="text-lg font-bold text-slate-400 uppercase ml-1">{item.unit}</span></h1>
                            </div>
                            <div className="text-right">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">In {activeBrand}</p>
                                 <p className={`text-2xl font-black ${stats[activeBrand] < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {stats[activeBrand] > 0 ? '+' : ''}{stats[activeBrand]}
                                 </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1 bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Standard Unit</p>
                                <p className="font-black text-sm">{item.unit || 'Nos'}</p>
                            </div>
                            <div className="flex-1 bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Item Category</p>
                                <p className="font-black text-sm">{item.category || 'General'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Brand Distribution</p>
                    <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
                        <button 
                            onClick={() => setActiveBrand('All')} 
                            className={`px-6 py-3 rounded-2xl text-xs font-black whitespace-nowrap border transition-all ${activeBrand === 'All' ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200 scale-105' : 'bg-white text-slate-500 border-slate-100'}`}
                        >
                            All Brands ({groups['All'].length})
                        </button>
                        {brands.map(b => (
                            <button 
                                key={b} 
                                onClick={() => setActiveBrand(b)} 
                                className={`px-6 py-3 rounded-2xl text-xs font-black whitespace-nowrap border transition-all ${activeBrand === b ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-105' : 'bg-white text-slate-500 border-slate-100'}`}
                            >
                                {b} ({stats[b] > 0 ? '+' : ''}{stats[b]})
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Transaction History</p>
                    <div className="space-y-3">
                        {currentList.map(({ tx, line }, idx) => {
                            const qty = parseFloat(line.qty || 0);
                            const isOut = tx.type === 'sales';
                            const displayQty = isOut ? -qty : qty;
                            const color = isOut ? 'text-rose-600' : 'text-emerald-600';
                            const party = data.parties.find(p => p.id === tx.partyId);

                            return (
                                <div 
                                    key={`${tx.id}-${idx}`} 
                                    onClick={() => setViewDetail({ type: 'transaction', id: tx.id })} 
                                    className="p-5 bg-white border border-slate-100 rounded-[24px] flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all hover:bg-slate-50 shadow-sm"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl ${isOut ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            {isOut ? <TrendingUp size={20}/> : <ShoppingCart size={20}/>}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-black text-slate-800 text-sm uppercase tracking-tight">{tx.type} #{tx.id.slice(-4)}</p>
                                                {activeBrand === 'All' && line.brand && (
                                                    <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-black uppercase tracking-widest">{line.brand}</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                                                <Calendar size={12}/> {formatDate(tx.date)} • {party?.name || 'Walk-in Client'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="text-right">
                                        <p className={`text-xl font-black tracking-tighter ${color}`}>
                                            {displayQty > 0 ? '+' : ''}{displayQty}
                                        </p>
                                        <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                            Rate: {formatCurrency(line.price)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {currentList.length === 0 && (
                            <div className="p-12 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                                <p className="text-slate-400 font-bold text-sm">No transactions found for this brand selection.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ItemDetailView;
