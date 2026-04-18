import React, { useState, useMemo } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { X, Plus, Calendar, Banknote, ShieldCheck } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import { personalDb } from '../../services/firebase';
import { doc, setDoc } from 'firebase/firestore';

const PersonalFinanceForm = ({ data, setData, record, onClose, intent }) => {
    const { saveRecord } = useDatabase(data, setData);
    
    // LEGACY: Categories & Accounts from direct data keys
    const categories = data.personalCategories || { income: ['Salary'], expense: ['Food'], transfer: [] };
    const accounts = data.personalAccounts || [{ id: 'cash', name: 'Cash', group: 'Cash', initialBalance: 0 }];

    const [type, setType] = useState(record?.type || intent || 'expense');
    const [form, setForm] = useState(record ? {
        ...record,
        date: record.date || new Date().toISOString().split('T')[0],
        amount: record.amount || '',
        fee: record.fee || '',
        account: record.account || '',
        toAccount: record.toAccount || '',
        category: record.category || '',
        subCategory: record.subCategory || '',
        note: record.note || record.notes || '',
    } : {
        date: new Date().toISOString().split('T')[0],
        amount: '',
        fee: '',
        account: '',
        toAccount: '',
        category: '',
        subCategory: '',
        note: '',
    });

    const handleSave = async (reset = false) => {
        if (!form.amount || !form.account) return alert("Account and Amount are required!");
        
        const finalRecord = {
            ...form,
            id: record ? record.id : null,
            type: type,
            amount: parseFloat(form.amount || 0),
            fee: parseFloat(form.fee || 0)
        };

        // If transfer with fee, handle double entry logic if needed (Legacy did this in handleSaveTransaction)
        // For simplicity here, we save the main record.
        await saveRecord('personalTransactions', finalRecord, 'personalTransaction');

        if (reset) {
            setForm({
                ...form,
                amount: '',
                fee: '',
                subCategory: '',
                note: '',
                // Keep date and account for "Save & Continue"
            });
        } else {
            onClose();
        }
    };

    // Category Logic - Direct from Legacy
    const normCats = useMemo(() => {
        const list = categories[type] || [];
        return list.map(c => typeof c === 'string' ? { name: c, subCategories: [] } : c);
    }, [categories, type]);

    const subCatOptions = useMemo(() => {
        const selectedCatObj = normCats.find(c => c.name === form.category);
        return selectedCatObj ? (selectedCatObj.subCategories || []) : [];
    }, [normCats, form.category]);

    return (
        <div className="fixed inset-0 z-[250] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* STICKY HEADER - LEGACY STYLE */}
            <div className="p-4 border-b flex items-center justify-between bg-white shadow-sm">
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={24} /></button>
                <h2 className="font-black text-slate-900 uppercase tracking-[0.2em]">Add {(type || '').toUpperCase()}</h2>
                <div className="w-10"></div>
            </div>

            {/* TYPE TABS - LEGACY STYLE */}
            <div className="flex p-2 gap-2 bg-slate-50 border-b border-slate-100">
                {['income', 'expense', 'transfer'].map(t => (
                    <button 
                        key={t} 
                        onClick={() => setType(t)} 
                        className={`flex-1 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border ${
                            type === t 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* FORM BODY - LEGACY STYLE HIGH DENSITY */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white pb-32">
                <div className="flex gap-3">
                    <div className="flex-1 space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                            <input type="date" className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                        </div>
                    </div>
                    <div className="flex-1 space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount</label>
                        <div className="relative">
                            <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                            <input type="number" className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-lg outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-slate-900" placeholder="0.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Account (Wallet)</label>
                    <SearchableSelect 
                        options={accounts.map(a => ({ id: a.name, name: a.name }))} 
                        value={form.account} 
                        onChange={v => setForm({...form, account: v, fromAccountId: v})} 
                        onAddNew={v => setForm({...form, account: v, fromAccountId: v})} 
                        placeholder="Select Account Ledger..."
                    />
                </div>

                {type === 'transfer' && (
                    <div className="flex gap-3 items-end animate-in slide-in-from-top-4 duration-300">
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">To Account (Safe)</label>
                            <SearchableSelect 
                                options={accounts.map(a => ({ id: a.name, name: a.name }))} 
                                value={form.toAccount} 
                                onChange={v => setForm({...form, toAccount: v})} 
                                onAddNew={v => setForm({...form, toAccount: v})} 
                                placeholder="Destination..."
                            />
                        </div>
                        <div className="w-32 space-y-1.5">
                            <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Transfer Fee</label>
                            <input type="number" className="w-full p-4 bg-rose-50 border border-rose-100 rounded-[24px] font-black text-sm text-rose-600 outline-none" placeholder="0" value={form.fee} onChange={e => setForm({...form, fee: e.target.value})} />
                        </div>
                    </div>
                )}

                {type !== 'transfer' && (
                    <div className="flex gap-3">
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                            <SearchableSelect 
                                options={normCats.map(c => ({ id: c.name, name: c.name }))} 
                                value={form.category} 
                                onChange={v => setForm({...form, category: v, subCategory: ''})} 
                                onAddNew={(v) => { if(v) setForm({...form, category: v}); }} 
                                placeholder="Select Type..."
                            />
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sub Category</label>
                            <SearchableSelect 
                                options={(subCatOptions||[]).map(sc => ({ id: sc, name: sc }))}
                                value={form.subCategory}
                                onChange={v => setForm({...form, subCategory: v})}
                                onAddNew={async () => {
                                    if(!form.category) return alert("Select category first");
                                    const newSub = prompt("Enter new sub-category:");
                                    if(!newSub) return;
                                    
                                    let newData = {...data};
                                    let updatedCats = [...(newData.personalCategories[type] || [])];
                                    const catIdx = updatedCats.findIndex(c => (typeof c === 'string' ? c : c.name) === form.category);
                                    
                                    if (catIdx >= 0) {
                                        const existingObj = typeof updatedCats[catIdx] === 'string' ? { name: updatedCats[catIdx], subCategories: [] } : updatedCats[catIdx];
                                        updatedCats[catIdx] = { ...existingObj, subCategories: [...(existingObj.subCategories||[]), newSub] };
                                    } else {
                                        updatedCats.push({ name: form.category, subCategories: [newSub] });
                                    }
                                    
                                    newData.personalCategories = { ...newData.personalCategories, [type]: updatedCats };
                                    setData(newData);
                                    await setDoc(doc(personalDb, "settings", "categories"), newData.personalCategories, { merge: true });
                                    setForm({...form, subCategory: newSub});
                                }}
                                placeholder="Sub-Division..."
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brief Description (Memo)</label>
                    <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[24px] font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" placeholder="e.g. Dinner with Friends" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
                </div>
            </div>

            {/* ACTION BAR - LEGACY FIDELITY */}
            <div className="p-4 border-t bg-white flex gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[40px]">
                <button 
                    onClick={() => handleSave(false)} 
                    className="flex-1 py-5 border border-slate-200 rounded-[32px] font-black text-slate-600 text-xs uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all"
                >
                    Secure Save
                </button>
                <button 
                    onClick={() => handleSave(true)} 
                    className="flex-[1.5] py-5 bg-slate-900 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <ShieldCheck size={18}/>
                    Commit & Continue
                </button>
            </div>
        </div>
    );
};

export default PersonalFinanceForm;
