import React, { useState } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { X, Trash2 } from 'lucide-react';

const PersonalAccountForm = ({ data, setData, record, onClose }) => {
    const { saveRecord, deleteRecord } = useDatabase(data, setData);
    const [form, setForm] = useState(record ? {
        ...record,
        name: record.name || '',
        type: record.type || 'Bank',
        parentAccount: record.parentAccount || '',
        initialBalance: record.initialBalance || 0,
    } : {
        name: '',
        type: 'Bank',
        parentAccount: '',
        initialBalance: 0,
    });

    const handleSave = async () => {
        if (!form.name) return alert("Account name is required!");
        
        const finalRecord = {
            ...form,
            id: record ? record.id : `ACC-${Date.now()}`,
            initialBalance: parseFloat(form.initialBalance || 0),
        };

        await saveRecord('personalAccounts', finalRecord, 'personalAccount');
        onClose();
    };

    const handleDelete = async () => {
        if (!window.confirm("Permanently delete this account?")) return;
        await deleteRecord('personalAccounts', record.id, 'personalAccount');
        onClose();
    };

    return (
        <div className="p-6 space-y-5 animate-in slide-in-from-bottom-6 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase">{record ? 'Edit Account' : 'New Account'}</h2>
                <div className="flex items-center gap-2">
                    {record && <button onClick={handleDelete} className="p-2 text-rose-500 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all"><Trash2 size={16}/></button>}
                    <button onClick={onClose} className="p-2 text-slate-400 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"><X size={16}/></button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Account Name</label>
                    <input 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 focus:bg-white transition-all outline-none" 
                        placeholder="e.g. Savings, Salary, Cash" 
                        value={form.name} 
                        onChange={e => setForm({...form, name: e.target.value})} 
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Parent Account</label>
                    <select 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none appearance-none cursor-pointer"
                        value={form.parentAccount}
                        onChange={e => setForm({...form, parentAccount: e.target.value})}
                    >
                        <option value="">None (Top Level)</option>
                        {(data.personalAccounts || []).filter(a => !record || a.id !== record.id).map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Type</label>
                    <div className="grid grid-cols-3 gap-2">
                        {['Bank', 'Card', 'Cash'].map(t => (
                            <button 
                                key={t}
                                onClick={() => setForm({...form, type: t})}
                                className={`py-3 rounded-xl font-black text-[9px] uppercase tracking-widest border transition-all ${form.type === t ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Opening Balance</label>
                    <input 
                        type="number"
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 focus:bg-white transition-all outline-none" 
                        placeholder="0.00" 
                        value={form.initialBalance} 
                        onChange={e => setForm({...form, initialBalance: e.target.value})} 
                    />
                </div>
            </div>

            <div className="pt-4 flex gap-3">
                <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={handleSave} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20">Save Account</button>
            </div>
        </div>
    );
};

export default PersonalAccountForm;
