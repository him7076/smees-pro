import React, { useState, useMemo } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { 
    TrendingUp, TrendingDown, RefreshCcw, Save, Calendar, 
    Banknote, FileText, ArrowRight, X, Users, CreditCard 
} from 'lucide-react';

const PersonalFinanceForm = ({ data, setData, record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const accounts = data.personalAccounts || [
        { id: 'Cash', name: 'Cash Wallet', type: 'cash' },
        { id: 'Bank', name: 'Primary Bank', type: 'bank' }
    ];

    const [form, setForm] = useState(record ? {
        ...record,
        amount: record.amount || '',
        category: record.category || '',
        notes: record.notes || record.note || '',
        date: record.date || new Date().toISOString().split('T')[0],
        paymentMode: record.paymentMode || 'Cash',
        personName: record.personName || '',
        creditCardName: record.creditCardName || '',
        accountId: record.accountId || accounts[0]?.id || 'Cash',
    } : {
        type: 'expense',
        amount: '',
        category: '',
        notes: '',
        date: new Date().toISOString().split('T')[0],
        accountId: accounts[0]?.id || 'Cash',
        paymentMode: 'Cash',
        personName: '',
        creditCardName: '',
        fromAccountId: '',
        toAccountId: ''
    });

    const handleSave = async () => {
        if (!form.amount || parseFloat(form.amount) <= 0) return alert("Enter valid amount");
        if (form.type !== 'transfer' && !form.category) return alert("Select category");
        if ((form.category === 'Udhar Given' || form.category === 'Udhar Taken' || form.category === 'Udhar Return') && !form.personName) return alert("Enter person name");
        if (form.paymentMode === 'Credit Card' && !form.creditCardName) return alert("Enter card name");

        const finalRecord = {
            ...form,
            amount: parseFloat(form.amount),
            updatedAt: new Date().toISOString()
        };

        await saveRecord('personalTransactions', finalRecord, 'personalTransaction');
        onClose();
    };

    const expenseCategories = ['Food & Dining', 'Transport', 'Shopping', 'Bills & Utilities', 'Health', 'Entertainment', 'Education', 'Groceries', 'Fuel', 'Credit Card Bill', 'Other Expense'];
    const incomeCategories = ['Salary', 'Freelance', 'Investment Returns', 'Gift Received', 'Bonus', 'Side Income', 'Other Income'];
    const udharCategories = ['Udhar Given', 'Udhar Taken', 'Udhar Return'];

    const currentCategories = useMemo(() => {
        if (form.category === 'Udhar Given' || form.category === 'Udhar Taken' || form.category === 'Udhar Return') return udharCategories;
        return form.type === 'income' ? incomeCategories : expenseCategories;
    }, [form.type, form.category]);

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-32 scrollbar-hide">
            {/* Header Sticky Bar */}
            <div className="sticky top-0 z-[110] bg-white border-b border-slate-100 p-4 shadow-sm flex justify-between items-center bg-white/80 backdrop-blur-xl">
                <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">Voucher Entry</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Personal Ledger</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="p-2.5 bg-slate-100 text-slate-400 rounded-xl active:scale-95 transition-all"><X size={18}/></button>
                </div>
            </div>

            <div className="p-4 md:p-8 space-y-6 max-w-2xl mx-auto w-full">
                {/* Transaction Type Picker */}
                <div className="grid grid-cols-3 gap-2 bg-white/80 backdrop-blur-xl p-1.5 rounded-[28px] border border-slate-100 shadow-sm">
                    {[
                        { id: 'expense', label: 'Spent', icon: <TrendingDown size={14}/>, color: 'text-rose-600', active: 'bg-rose-50 text-rose-600 border-rose-100 font-black' },
                        { id: 'income', label: 'Gained', icon: <TrendingUp size={14}/>, color: 'text-emerald-600', active: 'bg-emerald-50 text-emerald-600 border-emerald-100 font-black' },
                        { id: 'udhar', label: 'Udhar', icon: <Users size={14}/>, color: 'text-blue-600', active: 'bg-blue-50 text-blue-600 border-blue-100 font-black' }
                    ].map(t => {
                        const isSelected = form.type === t.id || (t.id === 'udhar' && udharCategories.includes(form.category));
                        return (
                            <button 
                                key={t.id} 
                                onClick={() => {
                                    if (t.id === 'udhar') setForm({...form, type: 'expense', category: 'Udhar Given'});
                                    else setForm({...form, type: t.id, category: ''});
                                }} 
                                className={`py-4 rounded-[22px] text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1.5 border border-transparent ${isSelected ? t.active : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {t.icon} {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* Amount Entry */}
                <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5 leading-none"><Banknote size={12} className="text-blue-500"/> Sequence Amount</label>
                        <input type="number" className="w-full py-4 text-4xl font-black text-slate-900 outline-none placeholder:text-slate-100 leading-none" placeholder="0.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 leading-none">Timeline</label>
                        <input type="date" className="w-full p-2 bg-transparent text-sm font-black text-slate-800 outline-none leading-none" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                    </div>
                    <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 leading-none">Classification</label>
                        <select className="w-full p-2 bg-transparent text-sm font-black text-slate-800 outline-none appearance-none leading-none" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                            <option value="">Select Category</option>
                            {currentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* Conditional Fields: Udhar Person / Credit Card Name */}
                {udharCategories.includes(form.category) && (
                    <div className="bg-blue-50/50 p-6 rounded-[32px] border border-blue-100 shadow-sm animate-in zoom-in-95 space-y-1.5">
                        <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1 leading-none flex items-center gap-2"><Users size={12}/> Interaction Partner</label>
                        <input className="w-full p-2 bg-transparent text-sm font-black text-blue-900 outline-none placeholder:text-blue-300" placeholder="e.g. Rahul / Suman" value={form.personName} onChange={e => setForm({...form, personName: e.target.value})} />
                    </div>
                )}

                {/* Mode & Account Selection */}
                <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 leading-none">Payment Channel</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {['Cash', 'Bank', 'UPI', 'Credit Card'].map(mode => (
                                <button key={mode} onClick={() => setForm({...form, paymentMode: mode})} className={`py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all ${form.paymentMode === mode ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-50 hover:bg-slate-100'}`}>
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>

                    {form.paymentMode === 'Credit Card' && (
                        <div className="bg-purple-50/50 p-5 rounded-[24px] border border-purple-100 animate-in slide-in-from-top-2 space-y-1.5">
                            <label className="text-[9px] font-black text-purple-600 uppercase tracking-widest ml-1 leading-none flex items-center gap-2"><CreditCard size={12}/> Card Issuer Identifier</label>
                            <input className="w-full p-2 bg-transparent text-xs font-black text-purple-900 outline-none placeholder:text-purple-300" placeholder="e.g. HDFC / SBI Prime" value={form.creditCardName} onChange={e => setForm({...form, creditCardName: e.target.value})} />
                        </div>
                    )}

                    <div className="space-y-1.5 pt-4 border-t border-slate-50">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 leading-none">Journal Entry Memo</label>
                        <textarea className="w-full p-4 bg-slate-50 border border-slate-50 rounded-[28px] text-xs font-bold outline-none min-h-[100px] placeholder:text-slate-200" placeholder="Add memorandum regarding this value sequence..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                    </div>
                </div>
            </div>

            {/* Bottom Safe Action */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-[120] flex gap-4 max-w-2xl mx-auto rounded-t-[40px] shadow-2xl">
                <button onClick={onClose} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Discard</button>
                <button onClick={handleSave} className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <Save size={20}/>
                    Secure to Vault
                </button>
            </div>
        </div>
    );
};

export default PersonalFinanceForm;
