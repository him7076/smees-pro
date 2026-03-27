import React, { useState } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { TrendingUp, TrendingDown, RefreshCcw, Save, Calendar, Banknote, FileText } from 'lucide-react';

const PersonalFinanceForm = ({ data, setData, record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [form, setForm] = useState({
        type: 'expense',
        amount: '',
        category: '',
        notes: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'Cash',
        accountId: '',
        ...(record || {})
    });

    const handleSave = async () => {
        if (!form.amount || parseFloat(form.amount) <= 0) return alert("Enter valid amount");
        if (!form.category) return alert("Select category");

        const finalRecord = {
            ...form,
            amount: parseFloat(form.amount),
            updatedAt: new Date().toISOString()
        };

        // Use 'personalTransactions' collection
        await saveRecord('personalTransactions', finalRecord, 'personalTransaction');
        onClose();
    };

    const categories = form.type === 'income' 
        ? ['Salary', 'Business', 'Investment', 'Gift', 'Other Income']
        : ['Food', 'Rent', 'Travel', 'Shopping', 'Health', 'Bills', 'Udhar Given', 'Udhar Return', 'Other Expense'];

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex bg-slate-100 p-1.5 rounded-[28px] shadow-inner ring-1 ring-slate-200">
                {[
                    { id: 'expense', label: 'Expense', icon: <TrendingDown size={14}/>, color: 'text-rose-600', active: 'bg-white text-rose-600 shadow-xl' },
                    { id: 'income', label: 'Income', icon: <TrendingUp size={14}/>, color: 'text-emerald-600', active: 'bg-white text-emerald-600 shadow-xl' },
                    { id: 'transfer', label: 'Transfer', icon: <RefreshCcw size={14}/>, color: 'text-blue-600', active: 'bg-white text-blue-600 shadow-xl' }
                ].map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setForm({...form, type: t.id})} 
                        className={`flex-1 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${form.type === t.id ? t.active : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            <div className="p-8 bg-slate-50 border border-slate-100 rounded-[40px] space-y-8 shadow-sm">
                <div className="relative">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Transaction Pulse</p>
                    <div className="relative">
                        <Banknote className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={24}/>
                        <input 
                            type="number" 
                            className="w-full pl-16 pr-8 py-6 bg-white border border-slate-100 rounded-[32px] text-4xl font-black text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-200"
                            placeholder="0.00"
                            value={form.amount} 
                            onChange={e => setForm({...form, amount: e.target.value})} 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Timeline</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input type="date" className="w-full pl-12 pr-6 py-5 bg-white border border-slate-100 rounded-3xl text-sm font-bold shadow-sm outline-none" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Category</label>
                        <select className="w-full p-5 bg-white border border-slate-100 rounded-3xl text-sm font-bold shadow-sm outline-none font-black text-slate-800" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Payment Hub</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {['Cash', 'Bank', 'UPI', 'Credit Card'].map(pm => (
                            <button 
                                key={pm} 
                                onClick={() => setForm({...form, paymentMode: pm})}
                                className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${form.paymentMode === pm ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                            >
                                {pm}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Journal Entries (Notes)</label>
                    <div className="relative">
                        <FileText className="absolute left-5 top-5 text-slate-300" size={18}/>
                        <textarea 
                            className="w-full p-5 pl-14 bg-white border border-slate-100 rounded-3xl text-sm font-bold shadow-sm outline-none min-h-[120px]" 
                            placeholder="Add memo or transaction details..." 
                            value={form.notes} 
                            onChange={e => setForm({...form, notes: e.target.value})}
                        />
                    </div>
                </div>
            </div>

            <button onClick={handleSave} className="w-full bg-slate-900 text-white py-8 rounded-[40px] font-black text-xs uppercase tracking-[0.4em] shadow-[0_20px_50px_rgba(15,23,42,0.2)] active:scale-95 transition-all flex items-center justify-center gap-4">
                <CheckCircle2 size={24}/>
                Secure to Vault
            </button>
        </div>
    );
};

// Add dummy checkcircle2 since it is not imported
const CheckCircle2 = ({size}) => <Save size={size} />;

export default PersonalFinanceForm;
