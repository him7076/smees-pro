import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Search, Filter, TrendingUp, TrendingDown, 
  RefreshCcw, Calendar, History, Trash2, Edit2, ChevronRight, 
  Banknote, Plus, ShoppingCart, Users, CreditCard, Wallet,
  PieChart as PieIcon, Layout, MoreVertical, Target
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useDatabase } from '../../hooks/useDatabase';

const PersonalFinanceView = ({ data, setData, onBack, setModal }) => {
    const { deleteRecord } = useDatabase(data, setData);
    const [filter, setFilter] = useState('all'); 
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const transactions = data.personalTransactions || [];

    const stats = useMemo(() => {
        let income = 0, expense = 0, udharG = 0, udharT = 0, udharR = 0, cc = 0;
        transactions.forEach(t => {
            const amt = parseFloat(t.amount || 0);
            if (t.type === 'income') income += amt;
            else if (t.type === 'expense') expense += amt;
            
            if (t.category === 'Udhar Given') udharG += amt;
            else if (t.category === 'Udhar Taken') udharT += amt;
            else if (t.category === 'Udhar Return') udharR += amt;
            
            if (t.paymentMode === 'Credit Card') cc += amt;
        });
        return { 
            income, expense, 
            receivable: Math.max(0, udharG - udharR), 
            payable: Math.max(0, udharT - udharR),
            creditCard: cc
        };
    }, [transactions]);

    const filtered = useMemo(() => {
        return transactions.filter(t => {
            const searchTerm = (t.category || '').toLowerCase() + (t.subCategory || '').toLowerCase() + (t.notes || t.note || '').toLowerCase() + (t.personName || '').toLowerCase();
            if (search && !searchTerm.includes(search.toLowerCase())) return false;

            if (filter === 'income') return t.type === 'income';
            if (filter === 'expense') return t.type === 'expense';
            if (filter === 'udhar') return ['Udhar Given', 'Udhar Taken', 'Udhar Return'].includes(t.category);
            if (filter === 'credit') return t.paymentMode === 'Credit Card';
            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [transactions, filter, search]);

    const getIcon = (tx) => {
        if (['Udhar Given', 'Udhar Taken', 'Udhar Return'].includes(tx.category)) return <Users size={18} className="text-blue-600"/>;
        if (tx.paymentMode === 'Credit Card') return <CreditCard size={18} className="text-purple-600"/>;
        if (tx.type === 'income') return <TrendingUp size={18} className="text-emerald-600"/>;
        return <ShoppingCart size={18} className="text-rose-600"/>;
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto animate-in slide-in-from-right duration-500 scrollbar-hide">
            {/* STICKY HEADER - HIGH FIDELITY */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-3xl border-b border-slate-100 p-4 md:p-6 flex items-center justify-between z-30 shadow-sm shadow-slate-200/20">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2.5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-colors active:scale-95"><ArrowLeft size={18}/></button>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] leading-none mb-1">Financial Suite</h2>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Wallet size={10} className="text-blue-500"/> Personal Vault Terminal</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setModal({ type: 'personalFinance' })} className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-900/10 active:scale-95 transition-all"><Plus size={18}/></button>
                </div>
            </div>

            <div className="p-4 md:p-8 space-y-6 max-w-2xl mx-auto pb-40">
                {/* ADVANCED SUMMARY CAROUSEL LOOK */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:rotate-12 transition-transform"><TrendingUp size={30} className="text-emerald-600"/></div>
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">Cash Inflow</p>
                        <p className="text-sm font-black text-slate-900 tracking-tight">{formatCurrency(stats.income)}</p>
                    </div>
                    <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:rotate-12 transition-transform"><TrendingDown size={30} className="text-rose-600"/></div>
                        <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-2">Cash Outflow</p>
                        <p className="text-sm font-black text-slate-900 tracking-tight">{formatCurrency(stats.expense)}</p>
                    </div>
                    <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:rotate-12 transition-transform"><Target size={30} className="text-blue-600"/></div>
                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">To Receive</p>
                        <p className="text-sm font-black text-slate-900 tracking-tight">{formatCurrency(stats.receivable)}</p>
                    </div>
                    <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:rotate-12 transition-transform"><ShoppingCart size={30} className="text-amber-600"/></div>
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">To Pay</p>
                        <p className="text-sm font-black text-slate-900 tracking-tight">{formatCurrency(stats.payable)}</p>
                    </div>
                </div>

                {/* SEARCH & FILTERS INLINE */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16}/>
                        <input className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-[28px] text-[11px] font-black shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-slate-800 placeholder:text-slate-200" placeholder="Analyze category, partner or note..." value={search} onChange={e => setSearch(e.target.value)}/>
                    </div>
                    <div className="flex gap-2 bg-white/50 p-1 rounded-[28px] border border-slate-100/50 backdrop-blur-xl overflow-x-auto no-scrollbar shadow-sm grow-0">
                        {[
                            { key: 'all', label: 'Brief', icon: <History size={14}/> },
                            { key: 'income', label: 'In', icon: <TrendingUp size={14}/> },
                            { key: 'expense', label: 'Out', icon: <TrendingDown size={14}/> },
                            { key: 'udhar', label: 'Udhar', icon: <Users size={14}/> },
                            { key: 'credit', label: 'Card', icon: <CreditCard size={14}/> }
                        ].map(f => (
                            <button key={f.key} onClick={() => setFilter(f.key)} className={`min-w-fit px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${filter === f.key ? 'bg-slate-900 text-white shadow-xl scale-105' : 'text-slate-400 hover:bg-slate-50'}`}>
                                {f.icon} {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* THE LEDGER - HIGH FIDELITY DENSITY */}
                <div className="space-y-3">
                    {filtered.map((t, idx) => {
                        const isIncome = t.type === 'income';
                        const isUdhar = ['Udhar Given', 'Udhar Taken', 'Udhar Return'].includes(t.category);
                        const isCC = t.paymentMode === 'Credit Card';

                        return (
                            <div key={idx} className="bg-white p-5 rounded-[36px] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-2xl hover:border-blue-50 transition-all active:scale-[0.98] animate-in slide-in-from-left duration-500" style={{ animationDelay: `${idx * 20}ms` }}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                                        isIncome ? 'bg-emerald-50 text-emerald-600' : 
                                        isUdhar ? 'bg-blue-50 text-blue-600' : 
                                        isCC ? 'bg-purple-50 text-purple-600' : 'bg-rose-50 text-rose-600'
                                    }`}>
                                        {getIcon(t)}
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{t.category}</span>
                                            {t.subCategory && <span className="text-[10px] font-black text-slate-400 capitalize bg-slate-50 px-2 py-0.5 rounded border border-slate-100 flex items-center gap-1"><ChevronRight size={10}/> {t.subCategory}</span>}
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                            <span>{formatDate(t.date)}</span>
                                            <span>•</span>
                                            <span className={`font-black uppercase ${isCC ? "text-purple-600" : "text-blue-500"}`}>
                                                {t.account || t.accountId || t.paymentMode || 'Wallet'}
                                                {t.creditCardName ? ` (${t.creditCardName})` : ""}
                                            </span>
                                            {t.personName && <span className="text-blue-600 font-black">@ {t.personName}</span>}
                                        </div>
                                        {(t.notes || t.note) && <p className="text-[9px] text-slate-400 lowercase font-medium italic mt-1 truncate max-w-[180px] opacity-70 italic leading-none">"{t.notes || t.note}"</p>}
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1">
                                    <p className={`text-base font-black tracking-tighter transition-colors ${
                                        isUdhar 
                                            ? (t.category === 'Udhar Given' || t.category === 'Udhar Return' ? 'text-blue-600' : 'text-amber-600')
                                            : (isIncome ? 'text-emerald-600' : 'text-rose-600')
                                    }`}>
                                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                    </p>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 duration-300">
                                        <button onClick={() => setModal({ type: 'personalFinance', data: t })} className="p-2 bg-slate-50 hover:bg-blue-50 rounded-xl text-blue-600 border border-slate-100 transition-colors"><Edit2 size={12}/></button>
                                        <button onClick={() => deleteRecord('personalTransactions', t.id)} className="p-2 bg-slate-50 hover:bg-rose-50 rounded-xl text-rose-500 border border-slate-100 transition-colors"><Trash2 size={12}/></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div className="py-32 text-center bg-white border border-dashed border-slate-200 rounded-[48px] mx-2">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><Wallet className="text-slate-200" size={48}/></div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Vault Sequence Nullified</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonalFinanceView;
