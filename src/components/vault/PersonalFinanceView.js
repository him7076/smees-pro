import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Search, Filter, TrendingUp, TrendingDown, 
  RefreshCcw, Calendar, History, Trash2, Edit2, ChevronRight, 
  FileText, Download, Banknote, Plus
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useDatabase } from '../../hooks/useDatabase';

const PersonalFinanceView = ({ data, setData, onBack, accountId: initialAccountId, setModal }) => {
    const { deleteRecord } = useDatabase(data, setData);
    const [accountId, setAccountId] = useState(initialAccountId || 'all');
    const [filter, setFilter] = useState('This Month');
    const [search, setSearch] = useState('');

    const transactions = data.personalTransactions || [];
    const accounts = data.personalAccounts || [];

    const filtered = useMemo(() => {
        return transactions.filter(t => {
            const matchesAcc = accountId === 'all' || t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId || t.paymentMode === accountId;
            const searchTerm = (t.category || t.categoryName || '').toLowerCase() + (t.notes || t.note || '').toLowerCase();
            const matchesSearch = !search || searchTerm.includes(search.toLowerCase());
            
            const d = new Date(t.date || t.createdAt);
            const now = new Date();
            let matchesDate = true;
            if (filter === 'This Month') matchesDate = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            else if (filter === 'This Year') matchesDate = d.getFullYear() === now.getFullYear();

            return matchesAcc && matchesSearch && matchesDate;
        }).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    }, [transactions, accountId, filter, search]);

    const stats = useMemo(() => {
        let inflow = 0, outflow = 0;
        filtered.forEach(t => {
            const amt = parseFloat(t.amount || t.finalTotal || 0);
            if (t.type === 'income') inflow += amt;
            else if (t.type === 'expense') outflow += amt;
        });
        return { inflow, outflow };
    }, [filtered]);

    return (
        <div className="fixed inset-0 z-[70] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 p-6 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-colors"><ArrowLeft size={20}/></button>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Personal Vault</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Managed Assets & Ledger</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setModal({ type: 'personalFinance' })} className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all"><Plus size={20}/></button>
                </div>
            </div>

            <div className="p-6 space-y-8 pb-24">
                <div className="flex gap-4">
                    <div className="flex-1 bg-emerald-50 p-6 rounded-[32px] border border-emerald-100/50">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-2"><TrendingUp size={10}/> Inflow Balance</span>
                        <span className="text-2xl font-black text-emerald-900 tracking-tighter">{formatCurrency(stats.inflow)}</span>
                    </div>
                    <div className="flex-1 bg-rose-50 p-6 rounded-[32px] border border-rose-100/50">
                        <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5 mb-2"><TrendingDown size={10}/> Outflow Balance</span>
                        <span className="text-2xl font-black text-rose-900 tracking-tighter">{formatCurrency(stats.outflow)}</span>
                    </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    <button onClick={() => setAccountId('all')} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${accountId === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}>Summary</button>
                    {accounts.map(acc => (
                        <button key={acc.id} onClick={() => setAccountId(acc.id)} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${accountId === acc.id ? 'bg-blue-600 text-white border-blue-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}>{acc.name}</button>
                    ))}
                    {/* Fallback for legacy payment modes */}
                    {['Cash', 'Bank', 'UPI', 'Credit Card'].map(pm => (
                         <button key={pm} onClick={() => setAccountId(pm)} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${accountId === pm ? 'bg-purple-600 text-white border-purple-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}>{pm}</button>
                    ))}
                </div>

                <div className="relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18}/>
                    <input className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-slate-100 rounded-[32px] text-sm font-bold shadow-inner outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" placeholder="Search categories, notes or wallets..." value={search} onChange={e => setSearch(e.target.value)}/>
                </div>

                <div className="space-y-4">
                    {filtered.map((t, idx) => {
                        const isIncome = t.type === 'income';
                        const isTransfer = t.type === 'transfer';
                        const accName = accounts.find(a => a.id === t.accountId)?.name || t.paymentMode || 'Wallet';
                        const categoryText = t.category || t.categoryName || 'General';
                        const noteText = t.notes || t.note;

                        return (
                            <div key={idx} className="bg-white p-6 rounded-[36px] border border-slate-100 shadow-sm flex justify-between items-center group hover:shadow-2xl hover:border-blue-50 transition-all active:scale-[0.98]">
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isIncome ? 'bg-emerald-50 text-emerald-600' : isTransfer ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {isIncome ? <TrendingUp size={24}/> : isTransfer ? <RefreshCcw size={24}/> : <TrendingDown size={24}/>}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{categoryText}</span>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{accName}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                                            <span className="flex items-center gap-1"><Calendar size={12}/> {formatDate(t.date || t.createdAt)}</span>
                                            {noteText && <span className="flex items-center gap-1 italic text-slate-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">"{noteText}"</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2">
                                    <span className={`text-xl font-black tracking-tighter ${isIncome ? 'text-emerald-600' : isTransfer ? 'text-blue-600' : 'text-rose-600'}`}>
                                        {isIncome ? '+' : isTransfer ? '⇄' : '-'}{formatCurrency(t.amount || t.finalTotal || 0)}
                                    </span>
                                    <button onClick={() => deleteRecord('personalTransactions', t.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div className="py-32 text-center bg-slate-50 border border-dashed border-slate-200 rounded-[48px] mx-2">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm"><History className="text-slate-200" size={48}/></div>
                            <p className="text-[12px] font-black text-slate-300 uppercase tracking-[0.3em]">Vault sequence empty</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonalFinanceView;
