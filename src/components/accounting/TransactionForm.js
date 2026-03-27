import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Save, Calculator, Link as LinkIcon, ShoppingBag, Package, Banknote, Calendar, ChevronRight, CheckCircle2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import { useDatabase } from '../../hooks/useDatabase';
import { getTransactionTotals, formatCurrency, getBillStats, getNextId, getPartyBalances } from '../../utils/helpers';

const TransactionForm = ({ data, setData, type: initialType = 'sales', record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [type, setType] = useState(record?.type || initialType);
    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        partyId: '',
        items: [],
        received: 0,
        paid: 0,
        amount: 0, 
        discountType: '₹',
        discountValue: 0,
        roundOff: 0,
        notes: '',
        paymentMode: 'Cash',
        subType: (initialType === 'sales' || initialType === 'estimate') ? 'in' : 'out',
        linkedBills: [],
        ...(record || {})
    });

    const nextId = useMemo(() => {
        if (record) return record.id;
        return getNextId(data, type).id;
    }, [data, type, record]);

    const partyStats = useMemo(() => {
        if (!form.partyId) return { balance: 0, type: 'DR' };
        const balances = getPartyBalances(data);
        return balances[form.partyId] || { balance: 0, type: 'DR' };
    }, [data, form.partyId]);

    const [tempItem, setTempItem] = useState({ itemId: '', name: '', brand: '', qty: 1, price: 0, lastRate: 0 });

    const addItem = (itemToPush) => {
        const itemMaster = data.items.find(i => i.id === itemToPush.itemId);
        const newItem = { 
            ...itemToPush, 
            lineId: `L-${Date.now()}-${Math.random()}`,
            linkedItems: itemMaster?.linkedItems || [] 
        };
        setForm({ ...form, items: [...form.items, newItem] });
        setTempItem({ itemId: '', name: '', brand: '', qty: 1, price: 0, lastRate: 0 });
    };

    const addLinkedItem = (parentIdx, linkIdx) => {
        const parent = form.items[parentIdx];
        const linkInfo = parent.linkedItems[linkIdx];
        const master = data.items.find(i => i.name === linkInfo.name);
        const newItems = [...form.items];
        
        const linkedItem = {
            itemId: master?.id || `L-${Date.now()}`,
            name: linkInfo.name,
            brand: linkInfo.brand || '',
            qty: parent.qty * (linkInfo.qty || 1),
            price: linkInfo.price || (type === 'purchase' ? master?.buyPrice : master?.sellPrice) || 0,
            isLinked: true,
            parentLineId: parent.lineId,
            parentName: parent.name
        };

        newItems.splice(parentIdx + 1, 0, linkedItem);
        setForm({ ...form, items: newItems });
    };

    const totals = useMemo(() => getTransactionTotals(form), [form]);

    const applyRoundOff = () => {
        const currentFinal = totals.gross - (form.discountType === '%' ? (totals.gross * parseFloat(form.discountValue || 0) / 100) : parseFloat(form.discountValue || 0));
        const rounded = Math.round(currentFinal);
        setForm({ ...form, roundOff: (rounded - currentFinal) });
    };

    const handleSave = async () => {
        if (!form.partyId && type !== 'expense' && form.paymentMode !== 'Cash') return alert("Select Party");
        if (['sales', 'purchase', 'estimate'].includes(type) && form.items.length === 0) return alert("Items required");
        
        const finalToSave = { 
            ...form, 
            type, 
            id: nextId,
            finalTotal: totals.final,
            grossTotal: totals.gross,
            updatedAt: new Date().toISOString()
        };

        await saveRecord('transactions', finalToSave, type);
        onClose();
    };

    const party = data.parties.find(p => p.id === form.partyId);
    
    // Get last purchase/sale rate for item
    useEffect(() => {
        if (tempItem.itemId) {
            const master = data.items.find(i => i.id === tempItem.itemId);
            const history = data.transactions
                .filter(t => t.partyId === form.partyId && t.type === type)
                .sort((a,b) => new Date(b.date) - new Date(a.date));
            
            let lastR = type === 'purchase' ? master?.buyPrice : master?.sellPrice;
            if (history.length > 0) {
                const prevLine = history[0].items?.find(i => i.itemId === tempItem.itemId);
                if (prevLine) lastR = prevLine.price;
            }
            setTempItem(prev => ({ ...prev, price: lastR, lastRate: lastR }));
        }
    }, [tempItem.itemId, form.partyId, type, data]);

    return (
        <div className="flex flex-col h-full bg-white md:bg-slate-50 overflow-y-auto pb-32 scrollbar-hide">
            {/* Header: Modular Type Selector */}
            <div className="sticky top-0 z-[101] bg-white border-b border-slate-100 p-4 md:p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner w-full sm:w-auto">
                        {['sales', 'purchase', 'estimate', 'payment', 'expense'].map(t => (
                            <button 
                                key={t} 
                                onClick={() => { setType(t); setForm(prev => ({ ...prev, subType: (t === 'sales' || t === 'estimate') ? 'in' : 'out', items: [], amount: 0 })); }} 
                                className={`flex-1 sm:flex-none px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === t ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="flex-1 sm:flex-none flex items-center gap-3 bg-blue-50 border border-blue-100 px-5 py-3 rounded-2xl">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Voucher:</span>
                            <span className="text-sm font-black text-blue-700 leading-none">{nextId}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
                {/* Section 1: Entity Core */}
                <div className="grid grid-cols-1 md:grid-cols-[1.5fr,1fr] gap-6">
                    <div className="space-y-6">
                        <div className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><LinkIcon size={14}/> Entity Information</p>
                            <SearchableSelect 
                                options={data.parties.map(p => ({ id: p.id, name: p.name, subText: p.type === 'DR' ? 'Customer' : 'Vendor' }))}
                                value={form.partyId}
                                onChange={v => setForm({...form, partyId: v})}
                                placeholder={`Select ${type === 'purchase' ? 'Vendor' : 'Customer'}...`}
                            />
                            {form.partyId && (
                                <div className={`flex justify-between items-center p-4 rounded-2xl border ${partyStats.type === 'CR' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Outstanding Balance:</span>
                                    <span className="text-sm font-black">{formatCurrency(partyStats.balance)} {partyStats.type}</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Timeline</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                    <input type="date" className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Hub</label>
                                <select className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold outline-none font-black text-slate-800" value={form.paymentMode} onChange={e => setForm({...form, paymentMode: e.target.value})}>
                                    <option>Cash</option><option>Bank</option><option>UPI</option><option>Cheque</option><option>Credit</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Overlay (Mobile friendly) */}
                    <div className="hidden md:block p-8 bg-slate-900 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Real-time Impact</p>
                        <div className="space-y-6">
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Gross Inventory</p>
                                <h3 className="text-2xl font-black tracking-tighter">{formatCurrency(totals.gross)}</h3>
                            </div>
                            <div className="pt-6 border-t border-white/5">
                                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Payable Net</p>
                                <h2 className="text-4xl font-black tracking-tighter text-blue-400">{formatCurrency(totals.final)}</h2>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Line Items (Sales/Purchase/Estimate) */}
                {['sales', 'purchase', 'estimate'].includes(type) && (
                    <div className="space-y-6">
                        <div className="p-8 bg-white border border-slate-100 rounded-[40px] shadow-sm space-y-6">
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 w-full space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Browse Inventory Item</label>
                                    <SearchableSelect 
                                        options={data.items.map(i => ({ id: i.id, name: i.name, subText: `Stk: 0 | Price: ₹${type === 'purchase' ? i.buyPrice : i.sellPrice}` }))}
                                        value={tempItem.itemId}
                                        onChange={v => setTempItem({...tempItem, itemId: v, name: data.items.find(i=>i.id===v)?.name})}
                                        placeholder="Pick Item..."
                                    />
                                    {tempItem.lastRate > 0 && (
                                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-2 flex items-center gap-1.5"><AlertCircle size={10}/> Last Rate: {formatCurrency(tempItem.lastRate)}</p>
                                    )}
                                </div>
                                <div className="flex-1 w-full grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Quantity</label>
                                        <input type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none" value={tempItem.qty} onChange={e => setTempItem({...tempItem, qty: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Rate</label>
                                        <input type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none" value={tempItem.price} onChange={e => setTempItem({...tempItem, price: e.target.value})} />
                                    </div>
                                </div>
                                <button onClick={() => { if(!tempItem.itemId) return; addItem(tempItem); }} className="w-full md:w-auto p-5 bg-slate-900 text-white rounded-2xl shadow-xl active:scale-95 transition-all"><Plus size={24}/></button>
                            </div>
                        </div>

                        {/* List rendering */}
                        <div className="space-y-3">
                            {form.items.map((item, idx) => (
                                <div key={idx} className={`group bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-xl transition-all ${item.isLinked ? 'ml-12 border-orange-100 bg-orange-50/20' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.isLinked ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {item.isLinked ? <LinkIcon size={20}/> : <Package size={20}/>}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 tracking-tight text-sm uppercase">{item.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.qty} Qty × ₹{item.price} {item.isLinked && `(Linked Item)`}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <p className="text-base font-black text-slate-900 tracking-tighter">{formatCurrency(item.qty * item.price)}</p>
                                        <button onClick={() => setForm({...form, items: form.items.filter((_, i) => i !== idx)})} className="p-2 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Section 3: Monetary Adjustments */}
                <div className="pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discount</label>
                                <div className="flex bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                    <input type="number" className="flex-1 p-4 text-sm font-black outline-none bg-transparent" value={form.discountValue} onChange={e=>setForm({...form, discountValue: e.target.value})} />
                                    <button onClick={()=>setForm({...form, discountType: form.discountType === '₹' ? '%' : '₹'})} className="px-5 bg-slate-900 text-white text-[10px] font-black uppercase">{form.discountType}</button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">Round Off <Calculator size={10} className="text-blue-500 cursor-pointer" onClick={applyRoundOff}/></label>
                                <input type="number" step="0.01" className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black outline-none shadow-sm" value={form.roundOff} onChange={e=>setForm({...form, roundOff: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Voucher Notes</label>
                            <textarea className="w-full p-5 bg-white border border-slate-100 rounded-[32px] text-sm font-medium outline-none shadow-sm min-h-[100px]" placeholder="Add remarks or memo..." value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} />
                        </div>
                   </div>

                   <div className="p-10 bg-white border-4 border-slate-900 rounded-[48px] shadow-2xl flex flex-col justify-center space-y-4">
                        <div className="flex justify-between items-baseline mb-4">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Final Amount</p>
                            <h2 className="text-5xl font-black text-slate-900 tracking-tighter">{formatCurrency(totals.final)}</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Payment Received</span>
                                <input type="number" className="w-32 bg-transparent text-right font-black text-emerald-900 outline-none" value={type === 'purchase' ? form.paid : form.received} onChange={e=>setForm({...form, [type === 'purchase' ? 'paid' : 'received']: e.target.value})} />
                            </div>
                            <div className="flex justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Dues</span>
                                <span className="font-black text-slate-900">{formatCurrency(Math.max(0, totals.final - (type === 'purchase' ? form.paid : form.received)))}</span>
                            </div>
                        </div>
                   </div>
                </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-[102] flex gap-4">
                <button onClick={onClose} className="flex-1 py-6 bg-slate-100 text-slate-400 rounded-3xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
                <button onClick={handleSave} className="flex-[2] py-6 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <CheckCircle2 size={20}/>
                    Commit Voucher
                </button>
            </div>
        </div>
    );
};

export default TransactionForm;
