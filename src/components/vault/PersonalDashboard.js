import React, { useState, useMemo } from 'react';
import { 
  Lock, Wallet, TrendingUp, TrendingDown, RefreshCcw, 
  CheckSquare, Plus, ChevronRight, PieChart as PieIcon, 
  History, Landmark, CreditCard as CardIcon, Banknote,
  Search, Filter, ArrowUpRight, ArrowDownLeft, Settings,
  ArrowRightLeft, List, Edit2, Trash2, X, PlusCircle
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { formatCurrency, formatDate } from '../../utils/helpers';

const PersonalDashboard = ({ data, setData, setViewDetail, setModal }) => {
    const transactions = data.personalTransactions || [];
    const accounts = data.personalAccounts || [];
    const tasks = data.personalTasks || [];
    const categories = data.personalCategories || { income: ['Salary', 'Gift'], expense: ['Food', 'Rent', 'Travel'] };
    const [pTab, setPTab] = useState('ledger');
    const [selectedCat, setSelectedCat] = useState(null);
    const [isAddingCat, setIsAddingCat] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [statsType, setStatsType] = useState('expense');
    const [subCatDrillDown, setSubCatDrillDown] = useState(null);

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
                    <button onClick={() => setPTab('tasks')} className={`p-2 rounded-xl transition-all ${pTab === 'tasks' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><CheckSquare size={16}/></button>
                    <button onClick={() => setPTab('stats')} className={`p-2 rounded-xl transition-all ${pTab === 'stats' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><PieIcon size={16}/></button>
                    <button onClick={() => setPTab('manage')} className={`p-2 rounded-xl transition-all ${pTab === 'manage' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><Settings size={16}/></button>
                </div>
            </div>

            {pTab === 'ledger' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {/* TOP ACTION BAR - INCOME/EXPENSE/TRANSFER */}
                    <div className="grid grid-cols-3 gap-3 px-1">
                        <button onClick={() => setModal({ type: 'personalTransaction', intent: 'income' })} className="py-4 bg-emerald-50 border border-emerald-100 rounded-3xl flex flex-col items-center gap-1 active:scale-95 transition-all group">
                            <ArrowUpRight className="text-emerald-500 group-hover:scale-110 transition-transform" size={20}/>
                            <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest">Inflow</span>
                        </button>
                        <button onClick={() => setModal({ type: 'personalTransaction', intent: 'expense' })} className="py-4 bg-rose-50 border border-rose-100 rounded-3xl flex flex-col items-center gap-1 active:scale-95 transition-all group">
                            <ArrowDownLeft className="text-rose-500 group-hover:scale-110 transition-transform" size={20}/>
                            <span className="text-[8px] font-black text-rose-700 uppercase tracking-widest">Outflow</span>
                        </button>
                        <button onClick={() => setModal({ type: 'personalTransaction', intent: 'transfer' })} className="py-4 bg-blue-50 border border-blue-100 rounded-3xl flex flex-col items-center gap-1 active:scale-95 transition-all group">
                            <ArrowRightLeft className="text-blue-500 group-hover:scale-110 transition-transform" size={20}/>
                            <span className="text-[8px] font-black text-blue-700 uppercase tracking-widest">Transfer</span>
                        </button>
                    </div>

                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden border-b-4 border-b-slate-100">
                        <div onClick={() => setViewDetail({ type: 'personalFinance' })} className="p-6 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Complete Ledger History</h3>
                                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Audit Trail & Statements</p>
                            </div>
                            <button className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-all"><History size={16}/></button>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map(t => (
                                <div key={t.id} onClick={() => setModal({ type: 'personalTransaction', data: t })} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-90 transition-all ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : t.type === 'expense' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {t.type === 'income' ? <ArrowUpRight size={20}/> : t.type === 'expense' ? <ArrowDownLeft size={20}/> : <ArrowRightLeft size={20}/>}
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-slate-800 tracking-tight leading-none mb-1 uppercase">{t.category || t.note || 'Internal Transfer'}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t.date} • <span className="text-slate-500 font-black">{t.account}</span></p>
                                        </div>
                                    </div>
                                    <p className={`text-xs font-black tracking-tighter ${t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-blue-600'}`}>
                                        {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {pTab === 'tasks' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Private Tasks</h3>
                        <button onClick={() => setModal({ type: 'task' })} className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 active:scale-90 transition-all"><Plus size={16}/></button>
                    </div>
                    
                    <div className="space-y-3">
                        {tasks.filter(t => t.status !== 'Done').sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(t => (
                            <div key={t.id} onClick={() => setModal({ type: 'task', data: t })} className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.priority === 'High' ? 'bg-rose-50 text-rose-500' : t.priority === 'Medium' ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-400'}`}>
                                        <CheckSquare size={18}/>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight mb-0.5">{t.title}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t.dueDate ? `Due: ${t.dueDate}` : 'No Deadline'}</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-slate-200 group-hover:translate-x-1 group-hover:text-blue-500 transition-all"/>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {pTab === 'stats' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-10">
                    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl overflow-hidden relative">
                         <div className="bg-slate-50 p-1.5 rounded-2xl flex mb-10 shadow-inner">
                            <button onClick={() => { setStatsType('expense'); setSubCatDrillDown(null); }} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${statsType === 'expense' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}>Expense Breakdown</button>
                            <button onClick={() => { setStatsType('income'); setSubCatDrillDown(null); }} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${statsType === 'income' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>Income Breakdown</button>
                         </div>

                         {/* LEGACY SVG PIE CHART WITH DRILLDOWN */}
                         <div className="flex flex-col items-center mb-8">
                             {(() => {
                                 const chartData = transactions.filter(t => t.type === statsType && (!subCatDrillDown || t.category === subCatDrillDown));
                                 const groupByKey = subCatDrillDown ? 'subCategory' : 'category';
                                 const statsMap = {};
                                 chartData.forEach(t => { 
                                     const key = t[groupByKey] || 'Other';
                                     statsMap[key] = (statsMap[key] || 0) + parseFloat(t.amount || 0);
                                 });
                                 const total = Object.values(statsMap).reduce((a,b)=>a+b, 0) || 1;
                                 const itemsSorted = Object.entries(statsMap).sort((a,b)=>b[1]-a[1]);

                                 return (
                                     <>
                                        <div className="relative w-56 h-56 group/chart">
                                            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 drop-shadow-2xl">
                                                {(() => {
                                                    let cumulativePercent = 0;
                                                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
                                                    return itemsSorted.map(([key, value], i) => {
                                                        const p = value / total;
                                                        const startX = Math.cos(2 * Math.PI * cumulativePercent);
                                                        const startY = Math.sin(2 * Math.PI * cumulativePercent);
                                                        cumulativePercent += p;
                                                        const endX = Math.cos(2 * Math.PI * cumulativePercent);
                                                        const endY = Math.sin(2 * Math.PI * cumulativePercent);
                                                        const largeArcFlag = p > 0.5 ? 1 : 0;
                                                        const pathData = [`M 50 50`, `L ${50 + 40 * startX} ${50 + 40 * startY}`, `A 40 40 0 ${largeArcFlag} 1 ${50 + 40 * endX} ${50 + 40 * endY}`, `Z`].join(' ');
                                                        return <path key={key} d={pathData} fill={colors[i%8]} stroke="white" strokeWidth="1" className="hover:scale-105 transition-transform cursor-pointer" onClick={() => !subCatDrillDown && setSubCatDrillDown(key)} />;
                                                    });
                                                })()}
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/20 backdrop-blur-[1px] rounded-full scale-50 pointer-events-none">
                                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{subCatDrillDown ? 'Sub' : 'Main'}</p>
                                            </div>
                                        </div>

                                        <div className="w-full mt-10 space-y-3">
                                            {subCatDrillDown && (
                                                <button onClick={()=>setSubCatDrillDown(null)} className="flex items-center gap-2 mb-4 text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-2 rounded-xl"><ArrowLeft size={14}/> Back to Categories</button>
                                            )}
                                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{subCatDrillDown ? `Sub-categories of ${subCatDrillDown}` : 'Category Analytics'}</h4>
                                            {itemsSorted.map(([key, value], i) => (
                                                <div key={key} onClick={() => !subCatDrillDown && setSubCatDrillDown(key)} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'][i%8] }}></div>
                                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{key}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                         <span className="text-xs font-black text-slate-900">{formatCurrency(value)}</span>
                                                         {!subCatDrillDown && <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors"/>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                     </>
                                 );
                             })()}
                         </div>
                    </div>
                </div>
            )}

            {pTab === 'manage' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20 px-1">
                    {/* ACCOUNTS MANAGEMENT */}
                    <div className="bg-white rounded-[40px] border border-slate-100 p-8 space-y-6 shadow-sm border-b-4 border-b-slate-100">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.25em]">Personal Vault</h3>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Wallet Management</p>
                            </div>
                            <button onClick={() => setModal({ type: 'personalAccount' })} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all"><Plus size={16}/></button>
                        </div>
                        <div className="space-y-2">
                             {accounts.map(acc => (
                                 <div key={acc.id} className="p-5 bg-slate-50 rounded-[32px] flex justify-between items-center group hover:bg-slate-100 transition-all">
                                     <div className="flex items-center gap-4">
                                         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm">
                                             {acc.type === 'Bank' ? <Landmark size={20}/> : <CardIcon size={20}/>}
                                         </div>
                                         <div>
                                             <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{acc.name}</p>
                                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{acc.type} • Secured</p>
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-3">
                                         <span className="text-xs font-black text-slate-900 mr-2">{formatCurrency(stats.accBals[acc.name] || 0)}</span>
                                         <button onClick={() => setModal({ type: 'personalAccount', data: acc })} className="p-2.5 bg-white rounded-xl text-slate-300 hover:text-blue-600 transition-all"><Edit2 size={14}/></button>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    </div>

                    {/* CATEGORY MANAGEMENT */}
                    <div className="bg-white rounded-[40px] border border-slate-100 p-8 space-y-6 shadow-sm border-b-4 border-b-slate-100">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.25em]">Classification</h3>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Smart Categories</p>
                            </div>
                            <div className="bg-slate-50 p-1 rounded-xl flex gap-1">
                                <button onClick={()=>setSelectedCat('expense')} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${selectedCat === 'expense' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'text-slate-400'}`}>Exp</button>
                                <button onClick={()=>setSelectedCat('income')} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${selectedCat === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'text-slate-400'}`}>Inc</button>
                            </div>
                        </div>

                        {selectedCat ? (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{selectedCat} Categories</h4>
                                    <button onClick={() => setIsAddingCat(true)} className="flex items-center gap-1 text-[8px] font-black text-blue-600 uppercase tracking-widest"><PlusCircle size={14}/> Add New</button>
                                </div>
                                {isAddingCat && (
                                    <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-3xl flex gap-2 animate-in zoom-in-95">
                                        <input autoFocus placeholder="Category Name..." className="flex-1 bg-white px-4 py-3 rounded-xl text-[10px] font-black outline-none border border-slate-100" value={newCatName} onChange={e=>setNewCatName(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleAddCat()}/>
                                        <button onClick={handleAddCat} className="px-4 bg-blue-600 text-white rounded-xl text-[8px] font-black uppercase">Save</button>
                                        <button onClick={() => { setIsAddingCat(false); setNewCatName(''); }} className="p-3 bg-white text-slate-400 rounded-xl"><X size={14}/></button>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    {(categories[selectedCat] || []).map(cat => (
                                        <div key={cat} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center group hover:bg-slate-100 transition-all">
                                            <span className="text-[10px] font-black text-slate-700 uppercase truncate pr-2">{cat}</span>
                                            <button 
                                                onClick={async () => {
                                                    if(window.confirm(`Delete "${cat}"?`)) {
                                                        const next = { ...categories, [selectedCat]: categories[selectedCat].filter(c => c !== cat) };
                                                        await updateDoc(doc(db, "companies", "smees_pro_data"), { personalCategories: next });
                                                    }
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-400 hover:text-rose-600 transition-all"
                                            ><Trash2 size={12}/></button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={()=>setSelectedCat(null)} className="w-full py-4 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-600 transition-colors">Close Controls</button>
                            </div>
                        ) : (
                            <div className="py-10 text-center grayscale opacity-30">
                                <PlusCircle size={40} className="mx-auto mb-4 text-slate-300"/>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Mode to Manage</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    async function handleAddCat() {
        if(!newCatName.trim()) return;
        const next = { ...categories, [selectedCat]: [...(categories[selectedCat] || []), newCatName.trim()] };
        await updateDoc(doc(db, "companies", "smees_pro_data"), { personalCategories: next });
        setNewCatName('');
        setIsAddingCat(false);
    }
};

export default PersonalDashboard;
