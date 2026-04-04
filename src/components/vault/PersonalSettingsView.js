import React, { useState } from 'react';
import { Settings, Plus, Trash2, X, PieChart, Banknote, Edit2, Landmark, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { doc, setDoc } from 'firebase/firestore';
import { personalDb } from '../../services/firebase';

const PersonalSettingsView = ({ data, setData, setModal, onBack }) => {
    const rawCategories = data.personalCategories || { income: ['Salary', 'Gift'], expense: ['Food', 'Rent', 'Travel'], sub: {} };
    
    // Normalize: old format stored categories as objects {name, subCategories}, new format uses plain strings
    const normalizeList = (list) => (list || []).map(item => typeof item === 'object' ? (item.name || JSON.stringify(item)) : item);
    const categories = {
        ...rawCategories,
        income: normalizeList(rawCategories.income),
        expense: normalizeList(rawCategories.expense),
        sub: rawCategories.sub || {}
    };
    
    const [selectedCatType, setSelectedCatType] = useState('expense');
    const [isAddingCat, setIsAddingCat] = useState(false);
    const [newCatName, setNewCatName] = useState('');

    const updateCategories = async (next) => {
        await setDoc(doc(personalDb, "settings", "categories"), next, { merge: true });
    };

    const handleAddCat = async () => {
        if(!newCatName.trim()) return;
        const next = { ...categories, [selectedCatType]: [...(categories[selectedCatType] || []), newCatName.trim()] };
        await updateCategories(next);
        setNewCatName('');
        setIsAddingCat(false);
    };

    const deleteCat = async (cat) => {
        if(!window.confirm(`Delete "${cat}"?`)) return;
        const next = { ...categories, [selectedCatType]: categories[selectedCatType].filter(c => c !== cat) };
        await updateCategories(next);
    };

    const addSubCat = async (cat) => {
        const n = prompt(`Add sub-category for ${cat}:`);
        if(n) {
            const currentSubs = categories.sub?.[cat] || [];
            const nextSub = { ...(categories.sub || {}), [cat]: [...currentSubs, n.trim()] };
            const next = { ...categories, sub: nextSub };
            await updateCategories(next);
        }
    };

    const deleteSubCat = async (cat, sub) => {
        if(!window.confirm(`Delete "${sub}" from ${cat}?`)) return;
        const currentSubs = categories.sub?.[cat] || [];
        const nextSub = { ...categories.sub, [cat]: currentSubs.filter(s => s !== sub) };
        const next = { ...categories, sub: nextSub };
        await updateCategories(next);
    };

    const renameSubCat = async (cat, oldSub) => {
        const n = prompt(`Rename sub-category "${oldSub}":`, oldSub);
        if(n && n !== oldSub) {
            const currentSubs = categories.sub?.[cat] || [];
            const nextSub = { ...categories.sub, [cat]: currentSubs.map(s => s === oldSub ? n.trim() : s) };
            const next = { ...categories, sub: nextSub };
            await updateCategories(next);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Vault Control</h2>
                    <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase mt-1">Classification Settings</h1>
                </div>
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1 shadow-inner">
                    <button onClick={()=>setSelectedCatType('expense')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${selectedCatType === 'expense' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'text-slate-400'}`}>Expense</button>
                    <button onClick={()=>setSelectedCatType('income')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${selectedCatType === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'text-slate-400'}`}>Income</button>
                </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-100 p-8 space-y-6 shadow-sm border-b-4 border-b-slate-100">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active {selectedCatType} Tags</p>
                    <button onClick={() => setIsAddingCat(true)} className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 hover:bg-blue-100 transition-all"><Plus size={14}/> Add New Category</button>
                </div>

                {isAddingCat && (
                    <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-[32px] flex gap-3 animate-in zoom-in-95 origin-top mb-6">
                        <input autoFocus placeholder="e.g. Shopping, Bills..." className="flex-1 bg-white px-5 py-4 rounded-2xl text-[11px] font-black outline-none border border-slate-100 shadow-sm" value={newCatName} onChange={e=>setNewCatName(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleAddCat()}/>
                        <button onClick={handleAddCat} className="px-6 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">OK</button>
                        <button onClick={() => { setIsAddingCat(false); setNewCatName(''); }} className="p-4 bg-white text-slate-300 rounded-2xl hover:text-rose-500 transition-colors"><X size={18}/></button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(categories[selectedCatType] || []).map(cat => (
                        <div key={cat} className="p-6 bg-slate-50 border border-slate-100 rounded-[36px] space-y-4 group hover:bg-slate-100/50 transition-all">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shadow-sm ${selectedCatType === 'expense' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>{cat[0]}</div>
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight truncate max-w-[150px]">{cat}</span>
                                </div>
                                <button onClick={() => deleteCat(cat)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={16}/></button>
                            </div>

                             <div className="flex flex-wrap gap-2 pt-2">
                                {(() => {
                                    const subCats = categories.sub?.[cat] || [];
                                    const txs = data.personalTransactions || [];
                                    const legacySubs = [...new Set(txs.filter(t => t.category === cat && t.subCategory && !subCats.includes(t.subCategory)).map(t => t.subCategory))];
                                    const allSubs = [...subCats, ...legacySubs];

                                    return allSubs.map(sub => (
                                        <div key={sub} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 text-[8px] font-black text-slate-500 shadow-sm uppercase group/sub">
                                            <span>{sub} {legacySubs.includes(sub) && <span className="opacity-40 italic font-medium">(Legacy)</span>}</span>
                                            <div className="flex gap-1">
                                                {!legacySubs.includes(sub) && <button onClick={() => renameSubCat(cat, sub)} className="text-slate-400 hover:text-blue-500"><Edit2 size={10}/></button>}
                                                <button onClick={() => deleteSubCat(cat, sub)} className="text-slate-400 hover:text-rose-500"><X size={10}/></button>
                                            </div>
                                        </div>
                                    ));
                                })()}
                                <button onClick={() => addSubCat(cat)} className="px-3 py-1.5 border border-dashed border-slate-200 rounded-full text-[8px] font-black text-slate-400 uppercase hover:bg-white hover:border-slate-300 transition-all">+ Add Sub</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[48px] text-white space-y-6 shadow-2xl relative overflow-hidden border border-white/5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl"></div>
                <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/10 rounded-2xl"><Landmark className="text-blue-400" size={20}/></div>
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 leading-none">Vouters & Anchors</h3>
                            <p className="text-sm font-black tracking-tight mt-1">Manage Linked Accounts</p>
                        </div>
                    </div>
                    <button onClick={() => setModal({ type: 'personalAccount' })} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-blue-600/20">
                        <Plus size={14}/> Define New
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
                    {(data.personalAccounts || []).map(acc => (
                        <div key={acc.id} className="p-5 bg-white/5 border border-white/10 rounded-[32px] hover:bg-white/[0.08] transition-all flex justify-between items-center group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                    <Banknote size={18}/>
                                </div>
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-tight text-white/90">{acc.name}</p>
                                    <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">{formatCurrency(acc.balance || 0)}</p>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => setModal({ type: 'personalAccount', data: acc })} className="p-2 bg-white/10 rounded-xl hover:bg-blue-600 transition-colors"><Edit2 size={14}/></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                    <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em]">Operational Integrity v2.1</p>
                    <button onClick={() => setModal({ type: 'backup' })} className="flex items-center gap-2 text-[9px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors">
                        <PieChart size={14}/> View Engine Logs
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PersonalSettingsView;
