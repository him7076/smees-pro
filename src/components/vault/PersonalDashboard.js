import React, { useState, useMemo } from 'react';
import { 
  Lock, Wallet, TrendingUp, TrendingDown, RefreshCcw, 
  CheckSquare, Plus, ChevronRight, PieChart as PieIcon, 
  History, Landmark, CreditCard as CardIcon, Banknote,
  Search, Filter, ArrowUpRight, ArrowDownLeft, Settings,
  ArrowRightLeft, List
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';

const PersonalDashboard = ({ data, setData, setViewDetail, setModal }) => {
    const transactions = data.personalTransactions || [];
    const accounts = data.personalAccounts || [];
    const [pTab, setPTab] = useState('ledger');

    const stats = useMemo(() => {
        let totalIncome = 0, totalExpense = 0;
        const accBals = {};
        accounts.forEach(a => accBals[a.name] = parseFloat(a.initialBalance || 0));

        transactions.forEach(t => {
            const amt = parseFloat(t.amount || 0);
            if (t.type === 'income') {
                totalIncome += amt;
                if (t.account) accBals[t.account] = (accBals[t.account] || 0) + amt;
            } else if (t.type === 'expense') {
                totalExpense += amt;
                if (t.account) accBals[t.account] = (accBals[t.account] || 0) - amt;
            } else if (t.type === 'transfer') {
                if (t.account) accBals[t.account] = (accBals[t.account] || 0) - amt;
                if (t.toAccount) accBals[t.toAccount] = (accBals[t.toAccount] || 0) + amt;
            }
        });
        const totalBalance = Object.values(accBals).reduce((a, b) => a + b, 0);
        return { totalIncome, totalExpense, totalBalance, accBals };
    }, [transactions, accounts]);

    const ShieldCheck = ({ size, className }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
        </svg>
    );

    return (
        <div className="space-y-6 pb-32">
            {/* COMPACT VAULT HEADER */}
            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-900/20">
                        <Lock className="text-white" size={16}/>
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none text-[14px] uppercase opacity-40">The Vault</h1>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0.5">#{stats.totalBalance.toLocaleString()}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setPTab('ledger')} className={`p-2 rounded-xl transition-all ${pTab === 'ledger' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><List size={16}/></button>
                    <button onClick={() => setPTab('stats')} className={`p-2 rounded-xl transition-all ${pTab === 'stats' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><PieIcon size={16}/></button>
                    <button onClick={() => setPTab('manage')} className={`p-2 rounded-xl transition-all ${pTab === 'manage' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><Settings size={16}/></button>
                </div>
            </div>

            {pTab === 'ledger' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {/* TOP ACTION BAR - INCOME/EXPENSE/TRANSFER */}
                    <div className="grid grid-cols-3 gap-3">
                        <button onClick={() => setModal({ type: 'personalTransaction', intent: 'income' })} className="py-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center gap-1 active:scale-95 transition-all group">
                            <ArrowUpRight className="text-emerald-500 group-hover:scale-110 transition-transform" size={18}/>
                            <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest">Income</span>
                        </button>
                        <button onClick={() => setModal({ type: 'personalTransaction', intent: 'expense' })} className="py-4 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col items-center gap-1 active:scale-95 transition-all group">
                            <ArrowDownLeft className="text-rose-500 group-hover:scale-110 transition-transform" size={18}/>
                            <span className="text-[8px] font-black text-rose-700 uppercase tracking-widest">Expense</span>
                        </button>
                        <button onClick={() => setModal({ type: 'personalTransaction', intent: 'transfer' })} className="py-4 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col items-center gap-1 active:scale-95 transition-all group">
                            <ArrowRightLeft className="text-blue-500 group-hover:scale-110 transition-transform" size={18}/>
                            <span className="text-[8px] font-black text-blue-700 uppercase tracking-widest">Transfer</span>
                        </button>
                    </div>

                    {/* HISTORY LIST */}
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <div onClick={() => setViewDetail({ type: 'personalFinance' })} className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors">
                            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Complete Ledger History</h3>
                            <button className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400"><History size={12}/></button>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => (
                                <div key={t.id} onClick={() => setModal({ type: 'personalTransaction', data: t })} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : t.type === 'expense' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {t.type === 'income' ? <ArrowUpRight size={18}/> : t.type === 'expense' ? <ArrowDownLeft size={18}/> : <ArrowRightLeft size={18}/>}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-800 tracking-tight leading-none mb-1">{t.category || t.note || 'Transfer'}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t.date} • {t.account || 'Private'}</p>
                                        </div>
                                    </div>
                                    <p className={`text-xs font-black tracking-tighter ${t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-blue-600'}`}>
                                        {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                                    </p>
                                </div>
                            ))}
                            {transactions.length === 0 && (
                                <div className="py-20 text-center grayscale opacity-30">
                                    <History size={40} className="mx-auto mb-4 text-slate-300"/>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Historical Traces</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {pTab === 'stats' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Yield Distribution</p>
                        <div className="flex justify-center mb-10">
                             <div className="relative w-48 h-48 flex items-center justify-center">
                                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                    <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#f1f5f9" strokeWidth="3"/>
                                    {(() => {
                                        const total = (stats.totalIncome + stats.totalExpense) || 1;
                                        const incP = (stats.totalIncome / total) * 100;
                                        return (
                                            <>
                                                <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#10b981" strokeWidth="3" strokeDasharray={`${incP} ${100-incP}`} strokeDashoffset="0"/>
                                                <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#f43f5e" strokeWidth="3" strokeDasharray={`${100-incP} ${incP}`} strokeDashoffset={-incP}/>
                                            </>
                                        );
                                    })()}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <p className="text-xs font-black text-slate-900 tracking-tighter">{Math.round((stats.totalIncome/((stats.totalIncome+stats.totalExpense)||1))*100)}%</p>
                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Inflow</p>
                                </div>
                             </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100">
                                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Inflow</p>
                                <p className="text-lg font-black text-emerald-900">{formatCurrency(stats.totalIncome)}</p>
                            </div>
                            <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100">
                                <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest mb-1">Outflow</p>
                                <p className="text-lg font-black text-rose-900">{formatCurrency(stats.totalExpense)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {pTab === 'manage' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="bg-white rounded-[32px] border border-slate-100 p-6 space-y-4 shadow-sm">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Personal Accounts</h3>
                            <button onClick={() => setModal({ type: 'personalAccount' })} className="text-[10px] font-black text-blue-600 uppercase tracking-widest">+ New</button>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                             {accounts.map(acc => (
                                 <div key={acc.id} onClick={() => setViewDetail({ type: 'personalFinance', accountId: acc.name })} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-all active:scale-95">
                                     <div className="flex items-center gap-3">
                                         <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400">
                                             {acc.type === 'Bank' ? <Landmark size={14}/> : <CardIcon size={14}/>}
                                         </div>
                                         <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{acc.name}</span>
                                     </div>
                                     <span className="text-[10px] font-black text-slate-900">{formatCurrency(stats.accBals[acc.name] || 0)}</span>
                                 </div>
                             ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonalDashboard;
