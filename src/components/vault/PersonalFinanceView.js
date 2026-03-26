import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Search, Filter, TrendingUp, TrendingDown, 
  RefreshCcw, Calendar, Trash2, Edit2, ChevronRight, 
  FileText, Download, Banknote, Landplot
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useDatabase } from '../../hooks/useDatabase';

const PersonalFinanceView = ({ data, setData, onBack, accountId: initialAccountId }) => {
    const { deleteRecord } = useDatabase(data, setData);
    const [accountId, setAccountId] = useState(initialAccountId || 'all');
    const [filter, setFilter] = useState('This Month');
    const [search, setSearch] = useState('');

    const transactions = data.personalTransactions || [];
    const accounts = data.personalAccounts || [];

    const filtered = useMemo(() => {
        return transactions.filter(t => {
            const matchesAcc = accountId === 'all' || t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId;
            const matchesSearch = !search || t.category?.toLowerCase().includes(search.toLowerCase()) || t.notes?.toLowerCase().includes(search.toLowerCase());
            
            const d = new Date(t.date);
            const now = new Date();
            let matchesDate = true;
            if (filter === 'This Month') matchesDate = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            else if (filter === 'This Year') matchesDate = d.getFullYear() === now.getFullYear();

            return matchesAcc && matchesSearch && matchesDate;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [transactions, accountId, filter, search]);

    const stats = useMemo(() => {
        let inflow = 0, outflow = 0;
        filtered.forEach(t => {
            const amt = parseFloat(t.amount || 0);
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
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Financial Ledger</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Personal Vault History</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <select className="bg-slate-50 border-none text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl outline-none" value={filter} onChange={e => setFilter(e.target.value)}>
                        <option>This Month</option><option>This Year</option><option>All Time</option>
                    </select>
                </div>
            </div>

            <div className="p-6 space-y-8 pb-20">
                {/* Quick Summary Bar */}
                <div className="flex gap-4">
                    <div className="flex-1 bg-emerald-50 p-4 rounded-3xl border border-emerald-100/50">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><TrendingUp size={10}/> Total Inflow</span>
                        <span className="text-lg font-black text-emerald-900 tracking-tighter">{formatCurrency(stats.inflow)}</span>
                    </div>
                    <div className="flex-1 bg-rose-50 p-4 rounded-3xl border border-rose-100/50">
                        <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><TrendingDown size={10}/> Total Outflow</span>
                        <span className="text-lg font-black text-rose-900 tracking-tighter">{formatCurrency(stats.outflow)}</span>
                    </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    <button onClick={() => setAccountId('all')} className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${accountId === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>All Wallets</button>
                    {accounts.map(acc => (
                        <button key={acc.id} onClick={() => setAccountId(acc.id)} className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${accountId === acc.id ? 'bg-blue-600 text-white border-blue-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>{acc.name}</button>
                    ))}
                </div>

                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16}/>
                    <input className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-[28px] text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="Search memos or categories..." value={search} onChange={e => setSearch(e.target.value)}/>
                </div>

                <div className="space-y-3">
                    {filtered.map((t, idx) => {
                        const isIncome = t.type === 'income';
                        const isTransfer = t.type === 'transfer';
                        const accName = accounts.find(a => a.id === t.accountId)?.name || 'Account';
                        const fromName = accounts.find(a => a.id === t.fromAccountId)?.name;
                        const toName = accounts.find(a => a.id === t.toAccountId)?.name;

                        return (
                            <div key={idx} className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex justify-between items-center group hover:shadow-xl hover:scale-[1.01] transition-all">
                                <div className="flex items-center gap-5">
                                    <div className={`w-12 h-12 rounded-[20px] flex items-center justify-center ${isIncome ? 'bg-emerald-50 text-emerald-600' : isTransfer ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {isIncome ? <TrendingUp size={20}/> : isTransfer ? <RefreshCcw size={20}/> : <TrendingDown size={20}/>}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{t.category}</span>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{isTransfer ? `${fromName} → ${toName}` : accName}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                                            <span className="flex items-center gap-1"><Calendar size={12}/> {formatDate(t.date)}</span>
                                            {t.notes && <span className="flex items-center gap-1 italic">"{t.notes}"</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2">
                                    <span className={`text-lg font-black tracking-tight ${isIncome ? 'text-emerald-600' : isTransfer ? 'text-blue-600' : 'text-rose-600'}`}>
                                        {isIncome ? '+' : isTransfer ? '⇄' : '-'}{formatCurrency(t.amount)}
                                    </span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => deleteRecord('personalTransactions', t.id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div className="py-24 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6"><History className="text-slate-200" size={40}/></div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No entries recorded for this view</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonalFinanceView;
