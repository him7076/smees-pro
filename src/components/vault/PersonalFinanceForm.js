import React, { useState, useMemo } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { 
    TrendingUp, TrendingDown, RefreshCcw, Save, Calendar, 
    Banknote, FileText, ArrowRight, X, Users, CreditCard,
    ChevronDown, Plus, Info
} from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import { db } from '../../services/firebase';
import { doc, setDoc } from 'firebase/firestore';

const PersonalFinanceForm = ({ data, setData, record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const accounts = data.personalAccounts || [
        { id: 'Cash', name: 'Cash Wallet', type: 'cash' },
        { id: 'Bank', name: 'Primary Bank', type: 'bank' }
    ];

    // LEGACY: Categories can be strings or objects with subCategories
    const categories = data.personalCategories || { income: ['Salary'], expense: ['Food'], transfer: [] };

    const [form, setForm] = useState(record ? {
        ...record,
        amount: record.amount || '',
        category: record.category || '',
        subCategory: record.subCategory || '',
        notes: record.notes || record.note || '',
        date: record.date || new Date().toISOString().split('T')[0],
        paymentMode: record.paymentMode || 'Cash',
        personName: record.personName || '',
        creditCardName: record.creditCardName || '',
        accountId: record.accountId || record.account || (accounts.length > 0 ? accounts[0].name : 'Cash'),
    } : {
        type: 'expense',
        amount: '',
        category: '',
        subCategory: '',
        notes: '',
        date: new Date().toISOString().split('T')[0],
        accountId: accounts[0]?.id || 'Cash',
        paymentMode: 'Cash',
        personName: '',
        creditCardName: '',
        fromAccountId: '',
        toAccountId: ''
    });

    const handleSave = async (reset = false) => {
        if (!form.amount || parseFloat(form.amount) <= 0) return alert("Enter valid amount");
        if (form.type !== 'transfer' && !form.category) return alert("Select category");
        
        const isUdhar = ['Udhar Given', 'Udhar Taken', 'Udhar Return'].includes(form.category);
        if (isUdhar && !form.personName) return alert("Enter person name");
        if (form.paymentMode === 'Credit Card' && !form.creditCardName) return alert("Enter card name");

        const finalRecord = {
            ...form,
            amount: parseFloat(form.amount),
            account: form.accountId, // Sync legacy 'account' field
            updatedAt: new Date().toISOString()
        };

        await saveRecord('personalTransactions', finalRecord, 'personalTransaction');
        
        if (reset) {
            setForm({ ...form, amount: '', subCategory: '', notes: '', personName: '' });
        } else {
            onClose();
        }
    };

    // Normalize categories to object array for the UI
    const normCats = useMemo(() => {
        const list = categories[form.type] || [];
        return list.map(c => typeof c === 'string' ? { id: c, name: c, subCategories: [] } : { id: c.name, name: c.name, subCategories: c.subCategories || [] });
    }, [categories, form.type]);

    const subCats = useMemo(() => {
        const catObj = normCats.find(c => c.name === form.category);
        return catObj ? catObj.subCategories : [];
    }, [normCats, form.category]);

    const handleAddSub = async () => {
        if(!form.category) return alert("Select category first");
        const newSub = prompt("New Sub-Category:");
        if(!newSub) return;

        const updatedCategories = { ...categories };
        const typeList = [...(updatedCategories[form.type] || [])];
        const idx = typeList.findIndex(c => (typeof c === 'string' ? c : c.name) === form.category);

        if (idx >= 0) {
            const existing = typeof typeList[idx] === 'string' ? { name: typeList[idx], subCategories: [] } : typeList[idx];
            typeList[idx] = { ...existing, subCategories: [...(existing.subCategories || []), newSub] };
        } else {
            typeList.push({ name: form.category, subCategories: [newSub] });
        }

        updatedCategories[form.type] = typeList;
        setData({ ...data, personalCategories: updatedCategories });
        await setDoc(doc(db, "companies", "smees_pro_data"), { personalCategories: updatedCategories }, { merge: true });
        setForm({ ...form, subCategory: newSub });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-32 scrollbar-hide">
            {/* Header Sticky Bar */}
            <div className="sticky top-0 z-[110] bg-white border-b border-slate-100 p-4 shadow-sm flex justify-between items-center bg-white/80 backdrop-blur-xl">
                <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Voucher Control</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Personal Intel Mode</p>
                </div>
                <button onClick={onClose} className="p-2.5 bg-slate-100 text-slate-400 rounded-xl active:scale-95 transition-all"><X size={18}/></button>
            </div>

            <div className="p-4 md:p-8 space-y-6 max-w-2xl mx-auto w-full">
                {/* Type Picker - High Fidelity */}
                <div className="grid grid-cols-3 gap-2 bg-white/80 backdrop-blur-xl p-1.5 rounded-[28px] border border-slate-100 shadow-sm">
                    {[
                        { id: 'expense', label: 'Spent', icon: <TrendingDown size={14}/>, color: 'text-rose-600', active: 'bg-rose-50 text-rose-600 border-rose-100' },
                        { id: 'income', label: 'Gained', icon: <TrendingUp size={14}/>, color: 'text-emerald-600', active: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                        { id: 'transfer', label: 'Transfer', icon: <RefreshCcw size={14}/>, color: 'text-blue-600', active: 'bg-blue-50 text-blue-600 border-blue-100' }
                    ].map(t => (
                        <button key={t.id} onClick={() => setForm({...form, type: t.id, category: '', subCategory: ''})} className={`py-4 rounded-[22px] text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1.5 border border-transparent ${form.type === t.id ? t.active : 'text-slate-400'}`}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* Main Entry Field */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full pointer-events-none group-focus-within:bg-blue-100/50 transition-colors"></div>
                    <div className="relative z-10 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Banknote size={14} className="text-blue-600"/> Currency Value</label>
                        <input type="number" className="w-full text-5xl font-black text-slate-900 outline-none placeholder:text-slate-100 leading-none bg-transparent" placeholder="0.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Timeline</label>
                        <div className="relative">
                            <Calendar className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                            <input type="date" className="w-full pl-6 bg-transparent text-sm font-black text-slate-800 outline-none" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 leading-none">Account Sync</label>
                        <SearchableSelect 
                            options={accounts.map(acc => ({ id: acc.id || acc.name, name: acc.name }))} 
                            value={form.accountId} 
                            onChange={v => setForm({...form, accountId: v})} 
                            onAddNew={v => setForm({...form, accountId: v})}
                            placeholder="Select Master Ledger..."
                        />
                    </div>
                </div>

                {/* TRANSFER FLOW */}
                {form.type === 'transfer' && (
                    <div className="bg-blue-600 p-8 rounded-[40px] shadow-xl space-y-6 relative overflow-hidden animate-in zoom-in-95">
                        <div className="absolute top-0 right-0 p-6 opacity-20"><RefreshCcw size={60} className="text-white"/></div>
                        <div className="space-y-4">
                            <div className="bg-white/10 p-5 rounded-[28px] border border-white/10">
                                <label className="text-[9px] font-black text-blue-100 uppercase tracking-widest ml-1">Destination Target</label>
                                <SearchableSelect 
                                    options={accounts.map(acc => ({ id: acc.id || acc.name, name: acc.name }))} 
                                    value={form.toAccountId} 
                                    onChange={v => setForm({...form, toAccountId: v})} 
                                    onAddNew={v => setForm({...form, toAccountId: v})}
                                    placeholder="Destination Hub..."
                                    className="bg-transparent border-none text-white placeholder:text-blue-300"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* CATEGORY & SUB-CATEGORY FLOW */}
                {form.type !== 'transfer' && (
                    <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category Intel</label>
                                <SearchableSelect 
                                    options={normCats} 
                                    value={form.category} 
                                    onChange={v => setForm({...form, category: v, subCategory: ''})} 
                                    onAddNew={(v) => setForm({...form, category: v})}
                                    placeholder="Type/Root"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sub-Division</label>
                                <SearchableSelect 
                                    options={subCats.map(sc => ({ id: sc, name: sc }))} 
                                    value={form.subCategory} 
                                    onChange={v => setForm({...form, subCategory: v})} 
                                    onAddNew={handleAddSub}
                                    placeholder={subCats.length > 0 ? "Specific Branch" : "No Sub-Levels"}
                                />
                            </div>
                        </div>

                        {['Udhar Given', 'Udhar Taken', 'Udhar Return'].includes(form.category) && (
                            <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100 space-y-2 animate-in slide-in-from-top-4">
                                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Counterpart Descriptor</label>
                                <div className="relative">
                                    <Users size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-blue-300"/>
                                    <input className="w-full pl-6 bg-transparent text-sm font-black text-blue-900 outline-none placeholder:text-blue-200" placeholder="Person/Entity Name" value={form.personName} onChange={e => setForm({...form, personName: e.target.value})} />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* PAYMENT MODE & CC DETAILS */}
                <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transaction Channel</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {['Cash', 'Bank', 'UPI', 'Credit Card'].map(mode => (
                                <button key={mode} onClick={() => setForm({...form, paymentMode: mode})} className={`py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all ${form.paymentMode === mode ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}>
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>

                    {form.paymentMode === 'Credit Card' && (
                        <div className="bg-rose-50 p-6 rounded-[32px] border border-rose-100 space-y-2 animate-in slide-in-from-bottom-4">
                            <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest ml-1">Asset Identity (Card Name)</label>
                            <div className="relative">
                                <CreditCard size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-rose-300"/>
                                <input className="w-full pl-6 bg-transparent text-sm font-black text-rose-900 outline-none placeholder:text-rose-200" placeholder="e.g. AMEX / ICICI Platinum" value={form.creditCardName} onChange={e => setForm({...form, creditCardName: e.target.value})} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Notes Journal */}
                <div className="bg-white p-7 rounded-[40px] border border-slate-100 shadow-sm space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Intelligence Memo (Optional)</label>
                    <textarea className="w-full bg-slate-50 p-5 rounded-[28px] text-xs font-bold text-slate-800 outline-none min-h-[120px] placeholder:text-slate-200" placeholder="Add memorandum regarding this value sequence..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
            </div>

            {/* HIGH FIDELITY ACTIONS */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-[120] flex gap-4 max-w-2xl mx-auto rounded-t-[40px] shadow-2xl">
                <button onClick={() => handleSave(true)} className="flex-1 py-5 bg-slate-100 text-slate-700 rounded-3xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm border border-slate-200">
                    <Plus size={16}/>
                    Batch Entry
                </button>
                <button onClick={() => handleSave(false)} className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <Save size={20}/>
                    Commit to Vault
                </button>
            </div>
        </div>
    );
};

export default PersonalFinanceForm;
