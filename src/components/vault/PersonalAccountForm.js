import React, { useState } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { X, Landmark, CreditCard, Wallet, ShieldCheck, Trash2 } from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

const PersonalAccountForm = ({ data, setData, record, onClose }) => {
    const { saveRecord, deleteRecord } = useDatabase(data, setData);
    const [form, setForm] = useState(record ? {
        ...record,
        name: record.name || '',
        type: record.type || 'Bank',
        group: record.group || 'Savings',
        initialBalance: record.initialBalance || 0,
    } : {
        name: '',
        type: 'Bank',
        group: 'Savings',
        initialBalance: 0,
    });

    const handleSave = async () => {
        if (!form.name) return alert("Name is required!");
        
        const finalRecord = {
            ...form,
            id: record ? record.id : Date.now().toString(),
            initialBalance: parseFloat(form.initialBalance || 0),
            updatedAt: new Date().toISOString()
        };

        await saveRecord('personalAccounts', finalRecord, 'personalAccount');
        onClose();
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this account? Transactions will remain but this account reference might break.")) return;
        await deleteRecord('personalAccounts', record.id, 'personalAccount');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[250] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* HEADER */}
            <div className="p-4 border-b flex items-center justify-between bg-white shadow-sm">
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900"><X size={24} /></button>
                <h2 className="font-black text-slate-900 uppercase tracking-[0.2em]">{record ? 'Edit Wallet' : 'New Wallet'}</h2>
                {record ? (
                    <button onClick={handleDelete} className="p-2 text-rose-500"><Trash2 size={20}/></button>
                ) : <div className="w-10"></div>}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Wallet Name</label>
                    <input 
                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[28px] font-black text-lg outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-slate-900" 
                        placeholder="e.g. HDFC Bank, My Cash" 
                        value={form.name} 
                        onChange={e => setForm({...form, name: e.target.value})} 
                    />
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {['Bank', 'Card', 'Cash'].map(t => (
                        <button 
                            key={t}
                            onClick={() => setForm({...form, type: t})}
                            className={`py-4 rounded-2xl flex flex-col items-center gap-2 border transition-all ${form.type === t ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                        >
                            {t === 'Bank' ? <Landmark size={20}/> : t === 'Card' ? <CreditCard size={20}/> : <Wallet size={20}/>}
                            <span className="text-[8px] font-black uppercase tracking-widest">{t}</span>
                        </button>
                    ))}
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Group (Category)</label>
                    <select 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-xs uppercase outline-none"
                        value={form.group}
                        onChange={e => setForm({...form, group: e.target.value})}
                    >
                        <option value="Savings">Savings</option>
                        <option value="Salary">Salary</option>
                        <option value="Investments">Investments</option>
                        <option value="Credit Cards">Credit Cards</option>
                        <option value="Cash">Cash</option>
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial / Current Balance</label>
                    <input 
                        type="number"
                        className="w-full p-4 bg-emerald-50 border border-emerald-100 rounded-[24px] font-black text-lg outline-none text-emerald-700" 
                        placeholder="0.00" 
                        value={form.initialBalance} 
                        onChange={e => setForm({...form, initialBalance: e.target.value})} 
                    />
                </div>
            </div>

            <div className="p-6 bg-white border-t rounded-t-[40px] shadow-[0_-15px_40px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={handleSave}
                    className="w-full py-5 bg-blue-600 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <ShieldCheck size={18}/>
                    Authorize Wallet
                </button>
            </div>
        </div>
    );
};

export default PersonalAccountForm;
