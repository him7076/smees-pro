import React, { useState, useMemo } from 'react';
import { 
  Lock, Wallet, TrendingUp, TrendingDown, RefreshCcw, 
  CheckSquare, Plus, ChevronRight, PieChart as PieIcon, 
  History, Landmark, CreditCard as CardIcon, Banknote,
  Search, Filter, ArrowUpRight, ArrowDownLeft, Settings,
  ArrowRightLeft, List, Edit2, Trash2, X, PlusCircle, ArrowLeft
} from 'lucide-react';
import { personalDb } from '../../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { formatCurrency, formatDate } from '../../utils/helpers';

const PersonalDashboard = ({ data, setData, setViewDetail, setModal }) => {
    const transactions = data.personalTransactions || [];
    const accounts = data.personalAccounts || [];
    const tasks = data.personalTasks || [];
    const categories = data.personalCategories || { income: ['Salary', 'Gift'], expense: ['Food', 'Rent', 'Travel'], sub: {} };
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

    const handleAddCat = async () => {
        if(!newCatName.trim()) return;
        const next = { ...categories, [selectedCat]: [...(categories[selectedCat] || []), newCatName.trim()] };
        await setDoc(doc(personalDb, "settings", "categories"), next, { merge: true });
        // Local state will update via onSnapshot in useFirebaseSync
        setNewCatName('');
        setIsAddingCat(false);
    };

    const updateCategories = async (next) => {
        await setDoc(doc(personalDb, "settings", "categories"), next, { merge: true });
    };

    return (
        <div className="space-y-6 pb-32">
            {/* COMPACT VAULT HEADER */}
            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-900/20">
                        <Lock className="text-white" size={16}/>
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none text-[10px] uppercase opacity-40">Personal Vault</h1>
                        <p className="text-[14px] font-black text-blue-600 uppercase tracking-widest mt-1">{formatCurrency(stats.totalBalance)}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setPTab('ledger')} className={`p-2.5 rounded-xl transition-all ${pTab === 'ledger' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><List size={18}/></button>
                    <button onClick={() => setPTab('stats')} className={`p-2.5 rounded-xl transition-all ${pTab === 'stats' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><PieIcon size={18}/></button>
                    <button onClick={() => setPTab('tasks')} className={`p-2.5 rounded-xl transition-all ${pTab === 'tasks' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><CheckSquare size={18}/></button>
                    <button onClick={() => setPTab('manage')} className={`p-2.5 rounded-xl transition-all ${pTab === 'manage' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><Settings size={18}/></button>
                </div>
            </div>

            {pTab === 'ledger' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {/* TOP ACTION BAR - INCOME/EXPENSE/TRANSFER */}
                    <div className="grid grid-cols-3 gap-3 px-1">
                        <button onClick={() => setModal({ type: 'personalTransaction', intent: 'income', context: 'personal' })} className="py-5 bg-emerald-50 border border-emerald-100 rounded-[32px] flex flex-col items-center gap-1 active:scale-95 transition-all group">
                            <ArrowUpRight className="text-emerald-500 group-hover:scale-110 transition-transform" size={24}/>
                            <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Inflow</span>
                        </button>
                        <button onClick={() => setModal({ type: 'personalTransaction', intent: 'expense', context: 'personal' })} className="py-5 bg-rose-50 border border-rose-100 rounded-[32px] flex flex-col items-center gap-1 active:scale-95 transition-all group">
                            <ArrowDownLeft className="text-rose-500 group-hover:scale-110 transition-transform" size={24}/>
                            <span className="text-[9px] font-black text-rose-700 uppercase tracking-widest">Outflow</span>
                        </button>
                        <button onClick={() => setModal({ type: 'personalTransaction', intent: 'transfer', context: 'personal' })} className="py-5 bg-blue-50 border border-blue-100 rounded-[32px] flex flex-col items-center gap-1 active:scale-95 transition-all group">
                            <ArrowRightLeft className="text-blue-500 group-hover:scale-110 transition-transform" size={24}/>
                            <span className="text-[9px] font-black text-blue-700 uppercase tracking-widest">Move</span>
                        </button>
                    </div>

                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden border-b-4 border-b-slate-100">
                        <div onClick={() => setViewDetail({ type: 'personalFinance' })} className="p-6 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Operational History</h3>
                                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Audit Trail & Statements</p>
                            </div>
                            <button className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-all"><History size={16}/></button>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map(t => (
                                <div key={t.id} onClick={() => setModal({ type: 'personalTransaction', data: t, context: 'personal' })} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
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
                    <div className="flex justify-between items-center px-4">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Private Operations</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secured Context Tasks</p>
                        </div>
                        <button onClick={() => setModal({ type: 'task', context: 'personal' })} className="w-12 h-12 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 active:scale-90 transition-all flex items-center justify-center"><Plus size={20}/></button>
                    </div>
                    
                    <div className="space-y-3 px-2">
                        {tasks.filter(t => t.status !== 'Done').sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).map(t => (
                            <div key={t.id} onClick={() => setModal({ type: 'task', data: t, context: 'personal' })} className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.priority === 'High' ? 'bg-rose-50 text-rose-500' : t.priority === 'Medium' ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-400'}`}>
                                        <CheckSquare size={18}/>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight mb-0.5">{t.name || t.title}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t.dueDate ? `Due: ${t.dueDate}` : 'No Deadline'}</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-slate-200 group-hover:translate-x-1 group-hover:text-blue-500 transition-all"/>
                            </div>
                        ))}
                        {tasks.filter(t => t.status !== 'Done').length === 0 && (
                            <div className="py-20 text-center opacity-30 grayscale">
                                <CheckSquare size={48} className="mx-auto mb-4 text-slate-300"/>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Operational Vacuum</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {pTab === 'stats' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-10">
                    <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-xl overflow-hidden relative">
                         <div className="bg-slate-50 p-1.5 rounded-2xl flex mb-6 shadow-inner">
                            <button onClick={() => { setStatsType('expense'); setSubCatDrillDown(null); }} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${statsType === 'expense' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}>Expense Breakdown</button>
                            <button onClick={() => { setStatsType('income'); setSubCatDrillDown(null); }} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${statsType === 'income' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>Income Breakdown</button>
                         </div>

                         {/* LEGACY SVG PIE CHART WITH DRILLDOWN & LABELS */}
                         {(() => {
                             const currentTxs = transactions.filter(t => t.type === statsType && (!subCatDrillDown || t.category === subCatDrillDown));
                             const groupByKey = subCatDrillDown ? 'subCategory' : 'category';
                             const statsMap = {};
                             currentTxs.forEach(t => { 
                                 const key = t[groupByKey] || 'Other';
                                 statsMap[key] = (statsMap[key] || 0) + parseFloat(t.amount || 0);
                             });
                             const totalAmount = Object.values(statsMap).reduce((a, b) => a + b, 0) || 1;
                             const sortedCats = Object.entries(statsMap).sort((a,b) => b[1] - a[1]);
                             
                             const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
                             
                             // SVG Settings
                             const cx = 120, cy = 120, radius = 55;
                             let currentAngle = -Math.PI / 2;

                             const slices = sortedCats.map(([key, amt], i) => {
                                 const percent = amt / totalAmount;
                                 const angle = percent * Math.PI * 2;
                                 const nextAngle = currentAngle + angle;
                                 const midAngle = currentAngle + angle / 2;
                                 
                                 const x1 = cx + radius * Math.cos(currentAngle);
                                 const y1 = cy + radius * Math.sin(currentAngle);
                                 
                                 let pathData;
                                 if (percent > 0.999) {
                                     pathData = `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius} Z`;
                                 } else {
                                     const x2 = cx + radius * Math.cos(nextAngle);
                                     const y2 = cy + radius * Math.sin(nextAngle);
                                     const largeArc = angle > Math.PI ? 1 : 0;
                                     pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                                 }

                                 const labelRadius = radius + 15;
                                 const lineX = cx + labelRadius * Math.cos(midAngle);
                                 const lineY = cy + labelRadius * Math.sin(midAngle);
                                 const isRight = Math.cos(midAngle) >= 0;
                                 const textX = lineX + (isRight ? 10 : -10);
                                 const textAnchor = isRight ? "start" : "end";

                                 const sliceData = { key, amt, percent: (percent * 100).toFixed(1), pathData, lineX, lineY, textX, textAnchor, color: colors[i % colors.length], midAngle };
                                 currentAngle = nextAngle;
                                 return sliceData;
                             });

                             return (
                                 <div className="flex flex-col items-center">
                                     <div className="text-center mb-4">
                                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total {statsType}</p>
                                         <p className={`text-2xl font-black ${statsType === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(totalAmount)}</p>
                                     </div>

                                     {sortedCats.length > 0 ? (
                                         <svg viewBox="0 0 240 240" className="w-full h-64 font-sans drop-shadow-sm">
                                             {slices.map((slice, i) => (
                                                 <g key={slice.key} onClick={() => !subCatDrillDown && setSubCatDrillDown(slice.key)} className="cursor-pointer group">
                                                     <path d={slice.pathData} fill={slice.color} stroke="#fff" strokeWidth="1.5" className="group-hover:scale-[1.02] transition-transform origin-[120px_120px]" />
                                                     {parseFloat(slice.percent) > 2 && (
                                                         <>
                                                             <polyline 
                                                                 points={`${cx + (radius-5) * Math.cos(slice.midAngle)},${cy + (radius-5) * Math.sin(slice.midAngle)} ${slice.lineX},${slice.lineY} ${slice.textX},${slice.lineY}`} 
                                                                 fill="none" stroke={slice.color} strokeWidth="1" opacity="0.4"
                                                             />
                                                             <text x={slice.textX + (slice.textAnchor==='start'?3:-3)} y={slice.lineY - 3} fontSize="8" fontWeight="900" fill="#1e293b" textAnchor={slice.textAnchor} className="uppercase tracking-tighter">
                                                                 {slice.key.length > 12 ? slice.key.substring(0,12)+'..' : slice.key}
                                                             </text>
                                                             <text x={slice.textX + (slice.textAnchor==='start'?3:-3)} y={slice.lineY + 7} fontSize="7" fontWeight="bold" fill={slice.color} textAnchor={slice.textAnchor}>
                                                                 {slice.percent}% • {formatCurrency(slice.amt).replace('.00','')}
                                                             </text>
                                                         </>
                                                     )}
                                                 </g>
                                             ))}
                                         </svg>
                                     ) : (
                                         <div className="py-20 text-[10px] font-black text-slate-300 uppercase tracking-widest">No data for chart</div>
                                     )}

                                     <div className="w-full mt-4 space-y-3">
                                         {subCatDrillDown && (
                                             <button onClick={()=>setSubCatDrillDown(null)} className="flex items-center gap-2 mb-4 text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 active:scale-95 transition-all"><ArrowLeft size={14}/> Back to Summary</button>
                                         )}
                                         <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-2">{subCatDrillDown ? `Breakdown: ${subCatDrillDown}` : 'Distribution Analysis'}</h4>
                                         {slices.map((slice, i) => (
                                             <div key={slice.key} onClick={() => !subCatDrillDown && setSubCatDrillDown(slice.key)} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl hover:bg-white hover:shadow-md hover:border-slate-100 border border-transparent transition-all cursor-pointer group">
                                                 <div className="flex items-center gap-3">
                                                     <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: slice.color }}></div>
                                                     <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{slice.key}</span>
                                                 </div>
                                                 <div className="flex items-center gap-3">
                                                      <span className="text-xs font-black text-slate-900">{formatCurrency(slice.amt)}</span>
                                                      {!subCatDrillDown && <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors"/>}
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             );
                         })()}
                    </div>
                </div>
            )}

            {pTab === 'manage' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20 px-1">
                    {/* LEGACY RECOVERY SYSTEM (Point 2) */}
                    <div className="bg-rose-50 border border-rose-100 rounded-[40px] p-8 space-y-4">
                        <div>
                            <h3 className="text-[10px] font-black text-rose-900 uppercase tracking-[0.25em]">Vault Restoration</h3>
                            <p className="text-[8px] font-bold text-rose-500 uppercase tracking-widest mt-1">Recover legacy data from old system</p>
                        </div>
                        <p className="text-[9px] font-bold text-rose-400 uppercase leading-relaxed">If you cannot see your old personal transactions or accounts, use this one-click migration to bridge your data from the legacy infrastructure to the new isolated vault.</p>
                        <button 
                            onClick={async () => {
                                if(!window.confirm("Restore legacy data? Existing data will be merged.")) return;
                                try {
                                    const { doc, getDoc, setDoc, collection } = await import('firebase/firestore');
                                    const { db, personalDb } = await import('../../services/firebase');
                                    const legacyRef = doc(db, "companies", "smees_pro_data");
                                    const snap = await getDoc(legacyRef);
                                    if(snap.exists()) {
                                        const l = snap.data();
                                        // Migrate Accounts
                                        if(l.personalAccounts) {
                                            for(const acc of l.personalAccounts) {
                                                await setDoc(doc(personalDb, "accounts", acc.id || acc.name), acc);
                                            }
                                        }
                                        // Migrate Transactions
                                        if(l.personalTransactions) {
                                            for(const tx of l.personalTransactions) {
                                                await setDoc(doc(personalDb, "transactions", tx.id), tx);
                                            }
                                        }
                                        // Migrate Tasks
                                        if(l.personalTasks) {
                                            for(const t of l.personalTasks) {
                                                await setDoc(doc(personalDb, "tasks", t.id), t);
                                            }
                                        }
                                        // Migrate Categories
                                        if(l.personalCategories) {
                                            await setDoc(doc(personalDb, "settings", "categories"), l.personalCategories);
                                        }
                                        alert("Legacy Data Recovery Successful!");
                                    } else {
                                        alert("No legacy data found in old system.");
                                    }
                                } catch (e) {
                                    console.error(e);
                                    alert("Recovery Failed: " + e.message);
                                }
                            }}
                            className="w-full py-4 bg-white border border-rose-200 text-rose-600 rounded-[28px] text-[9px] font-black uppercase tracking-[0.2em] shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCcw size={14}/> Trigger Master Recovery
                        </button>
                    </div>

                    {/* ACCOUNTS MANAGEMENT */}
                    <div className="bg-white rounded-[40px] border border-slate-100 p-8 space-y-6 shadow-sm border-b-4 border-b-slate-100">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.25em]">Storage Vault</h3>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Acres & Wallet Security</p>
                            </div>
                            <button onClick={() => setModal({ type: 'personalAccount', context: 'personal' })} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center"><Plus size={16}/></button>
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
                                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{acc.type} • Isolated</p>
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-3">
                                         <span className="text-xs font-black text-slate-900 mr-2">{formatCurrency(stats.accBals[acc.name] || 0)}</span>
                                         <button onClick={() => setModal({ type: 'personalAccount', data: acc, context: 'personal' })} className="p-2.5 bg-white rounded-xl text-slate-300 hover:text-blue-600 transition-all"><Edit2 size={14}/></button>
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
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Intelligence Sorting</p>
                            </div>
                            <div className="bg-slate-50 p-1 rounded-xl flex gap-1">
                                <button onClick={()=>setSelectedCat('expense')} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${selectedCat === 'expense' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'text-slate-400'}`}>Exp</button>
                                <button onClick={()=>setSelectedCat('income')} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${selectedCat === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'text-slate-400'}`}>Inc</button>
                            </div>
                        </div>

                        {selectedCat ? (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{selectedCat} Context</h4>
                                    <button onClick={() => setIsAddingCat(true)} className="flex items-center gap-1 text-[8px] font-black text-blue-600 uppercase tracking-widest"><PlusCircle size={14}/> Define New</button>
                                </div>
                                {isAddingCat && (
                                    <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-3xl flex gap-2 animate-in zoom-in-95">
                                        <input autoFocus placeholder="Label..." className="flex-1 bg-white px-4 py-3 rounded-xl text-[10px] font-black outline-none border border-slate-100" value={newCatName} onChange={e=>setNewCatName(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleAddCat()}/>
                                        <button onClick={handleAddCat} className="px-4 bg-blue-600 text-white rounded-xl text-[8px] font-black uppercase">Secure</button>
                                        <button onClick={() => { setIsAddingCat(false); setNewCatName(''); }} className="p-3 bg-white text-slate-400 rounded-xl"><X size={14}/></button>
                                    </div>
                                )}
                                 <div className="grid grid-cols-2 gap-2">
                                    {(categories[selectedCat] || []).map(cat => (
                                        <div key={cat} className="p-4 bg-slate-50 rounded-2xl flex flex-col gap-2 group hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-700 uppercase truncate pr-2">{cat}</span>
                                                <button 
                                                    onClick={async () => {
                                                        if(window.confirm(`Delete "${cat}"?`)) {
                                                            const next = { ...categories, [selectedCat]: categories[selectedCat].filter(c => c !== cat) };
                                                            await updateCategories(next);
                                                        }
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 transition-all"
                                                ><Trash2 size={12}/></button>
                                            </div>
                                            
                                            {/* Sub-categories */}
                                            <div className="space-y-1">
                                                {(categories.sub?.[cat] || []).map(sub => (
                                                    <div key={sub} className="flex justify-between items-center bg-white/80 px-2 py-1.5 rounded-lg text-[7px] font-black text-slate-500 uppercase">
                                                        <span>{sub}</span>
                                                        <button 
                                                            onClick={async () => {
                                                                const nextSub = { ...categories.sub, [cat]: categories.sub[cat].filter(s => s !== sub) };
                                                                await updateCategories({ ...categories, sub: nextSub });
                                                            }}
                                                            className="text-slate-300 hover:text-rose-500"
                                                        ><X size={10}/></button>
                                                    </div>
                                                ))}
                                                <button 
                                                    onClick={() => {
                                                        const n = prompt(`Add sub-category for ${cat}:`);
                                                        if(n) {
                                                            const nextSub = { ...categories.sub, [cat]: [...(categories.sub?.[cat] || []), n.trim()] };
                                                            updateCategories({ ...categories, sub: nextSub });
                                                        }
                                                    }}
                                                    className="w-full py-1.5 border border-dashed border-slate-200 rounded-lg text-[7px] font-black text-slate-400 uppercase hover:bg-white active:scale-95 transition-all"
                                                >+ Add Logic</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={()=>setSelectedCat(null)} className="w-full py-4 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-600 transition-colors">Relock Classification</button>
                            </div>
                        ) : (
                            <div className="py-10 text-center grayscale opacity-10">
                                <PlusCircle size={40} className="mx-auto mb-4 text-slate-300"/>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Encrypted Domain</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonalDashboard;
