import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Search, Filter, TrendingUp, TrendingDown, 
  RefreshCcw, Calendar, History, Trash2, Edit2, ChevronRight, 
  Banknote, Plus, ShoppingCart, Users, CreditCard, Wallet
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useDatabase } from '../../hooks/useDatabase';

const PersonalFinanceView = ({ data, setData, onBack, setModal }) => {
    const { deleteRecord } = useDatabase(data, setData);
    const [filter, setFilter] = useState('all'); // all, income, expense, udhar, credit
    const [search, setSearch] = useState('');

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
            const searchTerm = (t.category || '').toLowerCase() + (t.notes || '').toLowerCase() + (t.personName || '').toLowerCase();
            if (search && !searchTerm.includes(search.toLowerCase())) return false;

            if (filter === 'income') return t.type === 'income';
            if (filter === 'expense') return t.type === 'expense';
            if (filter === 'udhar') return ['Udhar Given', 'Udhar Taken', 'Udhar Return'].includes(t.category);
            if (filter === 'credit') return t.paymentMode === 'Credit Card';
            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [transactions, filter, search]);

    const getIcon = (tx) => {
        if (['Udhar Given', 'Udhar Taken', 'Udhar Return'].includes(tx.category)) return <Users size={20} className="text-blue-600"/>;
        if (tx.paymentMode === 'Credit Card') return <CreditCard size={20} className="text-purple-600"/>;
        if (tx.type === 'income') return <TrendingUp size={20} className="text-emerald-600"/>;
        return <ShoppingCart size={20} className="text-rose-600"/>;
    };

    const getBgColor = (tx) => {
        if (['Udhar Given', 'Udhar Taken', 'Udhar Return'].includes(tx.category)) return 'bg-blue-50';
        if (tx.paymentMode === 'Credit Card') return 'bg-purple-50';
        if (tx.type === 'income') return 'bg-emerald-50';
        return 'bg-rose-50';
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto animate-in slide-in-from-right duration-300 scrollbar-hide">
            {/* Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 md:p-6 flex items-center justify-between z-20">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2.5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-colors"><ArrowLeft size={18}/></button>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Money Manager</h2>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Financial Intel & Vault</p>
                    </div>
                </div>
                <button onClick={() => setModal({ type: 'personalFinance' })} className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all"><Plus size={20}/></button>
            </div>

            <div className="p-4 md:p-8 space-y-4 max-w-2xl mx-auto pb-32">
                {/* Visual Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm">
                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp size={10}/> Income</p>
                        <p className="text-sm font-black text-slate-900 tracking-tight">{formatCurrency(stats.income)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm">
                        <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingDown size={10}/> Spent</p>
                        <p className="text-sm font-black text-slate-900 tracking-tight">{formatCurrency(stats.expense)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm">
                        <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">To Receive</p>
                        <p className="text-sm font-black text-slate-900 tracking-tight">{formatCurrency(stats.receivable)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm">
                        <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1">To Pay</p>
                        <p className="text-sm font-black text-slate-900 tracking-tight">{formatCurrency(stats.payable)}</p>
                    </div>
                </div>

                {/* Filter & Search Bar Compact */}
                <div className="flex gap-2 bg-white p-1.5 rounded-[24px] border border-slate-100 overflow-x-auto no-scrollbar shadow-sm">
                    {[
                        { key: 'all', label: 'Summary', icon: <History size={14}/> },
                        { key: 'income', label: 'Cash In', icon: <TrendingUp size={14}/> },
                        { key: 'expense', label: 'Cash Out', icon: <TrendingDown size={14}/> },
                        { key: 'udhar', label: 'Udhar', icon: <Users size={14}/> },
                        { key: 'credit', label: 'Card Control', icon: <CreditCard size={14}/> }
                    ].map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)} className={`flex-1 min-w-fit px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${filter === f.key ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>
                            {f.icon} {f.label}
                        </button>
                    ))}
                </div>

                <div className="relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={14}/>
                    <input className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-[24px] text-xs font-black shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-slate-800" placeholder="Find transactions, categories or memos..." value={search} onChange={e => setSearch(e.target.value)}/>
                </div>

                {/* Ledger Body */}
                <div className="space-y-3">
                    {filtered.map((t, idx) => {
                        const isIncome = t.type === 'income';
                        const isUdhar = ['Udhar Given', 'Udhar Taken', 'Udhar Return'].includes(t.category);
                        const isCC = t.paymentMode === 'Credit Card';

                        return (
                            <div key={idx} className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl hover:border-blue-50 transition-all active:scale-[0.98]">
                                <div className="flex items-center gap-4">
                                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${getBgColor(t)}`}>
                                        {getIcon(t)}
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{t.category}</span>
                                            {t.personName && <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">{t.personName}</span>}
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                            <span>{formatDate(t.date)}</span>
                                            <span>•</span>
                                            <span className={isCC ? "text-purple-600" : ""}>{t.paymentMode} {t.creditCardName ? `(${t.creditCardName})` : ""}</span>
                                        </div>
                                        {t.notes && <p className="text-[9px] text-slate-400 lowercase font-medium italic mt-1 truncate max-w-[140px] leading-none">"{t.notes}"</p>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-base font-black tracking-tighter ${
                                        isUdhar 
                                            ? (t.category === 'Udhar Given' || t.category === 'Udhar Return' ? 'text-blue-600' : 'text-amber-600')
                                            : (isIncome ? 'text-emerald-600' : 'text-rose-600')
                                    }`}>
                                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                    </p>
                                    <div className="flex gap-2 justify-end mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setModal({ type: 'personalFinance', data: t })} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600"><Edit2 size={12}/></button>
                                        <button onClick={() => deleteRecord('personalTransactions', t.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500"><Trash2 size={12}/></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div className="py-24 text-center">
                            <Wallet className="text-slate-200 mx-auto mb-4" size={48}/>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Vault sequence empty</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonalFinanceView;
