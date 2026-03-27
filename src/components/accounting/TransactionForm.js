import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Save, Calculator, Link as LinkIcon, ShoppingBag, Package, Banknote, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import { useDatabase } from '../../hooks/useDatabase';
import { getTransactionTotals, formatCurrency, getBillStats, getNextId } from '../../utils/helpers';

const TransactionForm = ({ data, setData, type: initialType = 'sales', record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [type, setType] = useState(record?.type || initialType);
    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        partyId: '',
        items: [],
        received: 0,
        paid: 0,
        amount: 0, // For payments/expenses
        discountType: '₹',
        discountValue: 0,
        roundOff: 0,
        notes: '',
        paymentMode: 'Cash',
        subType: initialType === 'sales' ? 'in' : 'out', // for payments
        linkedBills: [],
        linkedAssetId: '',
        ...(record || {})
    });

    const nextId = useMemo(() => {
        if (record) return record.id;
        const result = getNextId(data, type);
        return result.id;
    }, [data, type, record]);

    const [tempItem, setTempItem] = useState({ itemId: '', name: '', brand: '', qty: 1, price: 0, buyPrice: 0 });

    // 1. Logic for Items: Manual Linked Items added via button
    const addItem = (itemToPush) => {
        const itemMaster = data.items.find(i => i.id === itemToPush.itemId);
        // Important: Assign a temp ID to the line item to track link associations
        const newItem = { 
            ...itemToPush, 
            lineId: `L-${Date.now()}-${Math.random()}`,
            linkedItems: itemMaster?.linkedItems || [] 
        };
        setForm({ ...form, items: [...form.items, newItem] });
    };

    const addLinkedItem = (parentIdx, linkIdx) => {
        const parent = form.items[parentIdx];
        const linkInfo = parent.linkedItems[linkIdx];
        if (!linkInfo) return;

        const master = data.items.find(i => i.name === linkInfo.name);
        const newItems = [...form.items];
        
        const linkedItem = {
            itemId: master?.id || `L-${Date.now()}`,
            name: linkInfo.name,
            brand: linkInfo.brand || '',
            qty: parent.qty * (linkInfo.qty || 1),
            price: linkInfo.price || (master?.sellPrice || 0),
            buyPrice: master?.buyPrice || 0,
            isLinked: true,
            parentLineId: parent.lineId,
            parentName: parent.name
        };

        newItems.splice(parentIdx + 1, 0, linkedItem);
        setForm({ ...form, items: newItems });
    };

    const removeItem = (idx) => {
        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
    };

    // 2. Calculations
    const totals = useMemo(() => getTransactionTotals(form), [form]);

    // 3. Auto Round-off
    const applyRoundOff = () => {
        const currentFinal = totals.gross - (form.discountType === '%' ? (totals.gross * form.discountValue / 100) : form.discountValue);
        const rounded = Math.round(currentFinal);
        setForm({ ...form, roundOff: (rounded - currentFinal) });
    };

    const handleSave = async () => {
        if (!form.partyId && !['expense'].includes(type) && form.paymentMode !== 'Cash') {
            return alert("Party required for non-cash transactions");
        }
        if (['sales', 'purchase', 'estimate'].includes(type) && form.items.length === 0) {
            return alert("Add at least one item");
        }
        
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

    const handleLinkChange = (billId, amount) => {
        const amt = parseFloat(amount) || 0;
        let newLinked = [...(form.linkedBills || [])];
        const idx = newLinked.findIndex(l => l.billId === billId);

        if (amt <= 0) {
            if (idx >= 0) newLinked.splice(idx, 1);
        } else {
            if (idx >= 0) newLinked[idx] = { billId, amount: amt };
            else newLinked.push({ billId, amount: amt });
        }
        setForm({ ...form, linkedBills: newLinked });
    };

    const party = data.parties.find(p => p.id === form.partyId);
    const unpaidBills = useMemo(() => {
        if (!form.partyId || (type !== 'payment' && type !== 'sales' && type !== 'purchase')) return [];
        return data.transactions
            .filter(t => t.partyId === form.partyId && t.status !== 'Cancelled' && t.id !== record?.id)
            .map(t => ({ ...t, stats: getBillStats(t, data.transactions) }))
            .filter(t => t.stats.pending > 0.5);
    }, [form.partyId, type, data.transactions, record]);

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pr-2 scrollbar-hide py-2">
            {/* Header / Type Switcher & Voucher ID */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 mx-4 mt-2 shadow-sm">
                <div className="flex bg-slate-50 p-1 rounded-2xl shadow-inner overflow-x-auto scrollbar-hide">
                    {['sales', 'estimate', 'purchase', 'expense', 'payment'].map(t => (
                        <button 
                            key={t} 
                            onClick={() => { setType(t); setForm(prev => ({ ...prev, subType: (t === 'sales' || t === 'estimate') ? 'in' : 'out' })); }} 
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all whitespace-nowrap ${type === t ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-2xl">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">ID:</span>
                    <span className="text-xs font-black text-indigo-700">{nextId}</span>
                </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input type="date" className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                    </div>
                </div>

                <SearchableSelect 
                    label={type === 'payment' ? "Party / Account" : "Customer / Vendor"}
                    options={data.parties.map(p => ({ id: p.id, name: p.name, subText: `Bal: ${formatCurrency(0)}` }))}
                    value={form.partyId}
                    onChange={v => setForm({...form, partyId: v})}
                    placeholder="Search Party..."
                />
            </div>

            {/* Item Section (for Sales/Purchase/Estimate) */}
            {['sales', 'purchase', 'estimate'].includes(type) && (
                <div className="px-4 space-y-4">
                    <div className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Package size={14}/> Inventory Selection</p>
                        
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1">
                                <SearchableSelect 
                                    options={data.items.map(i => ({ 
                                        id: i.id, 
                                        name: i.name, 
                                        subText: `₹${type === 'purchase' ? i.buyPrice : i.sellPrice}`,
                                        brands: i.brands,
                                        buyPrice: i.buyPrice,
                                        sellPrice: i.sellPrice
                                    }))}
                                    value={tempItem.itemId}
                                    onChange={v => {
                                        const item = data.items.find(i => i.id === v);
                                        setTempItem({ 
                                            itemId: v, 
                                            name: item?.name, 
                                            brand: '', 
                                            qty: 1, 
                                            price: type === 'purchase' ? (item?.buyPrice || 0) : (item?.sellPrice || 0),
                                            buyPrice: item?.buyPrice || 0
                                        });
                                    }}
                                    placeholder="Select Item..."
                                />
                            </div>
                            
                            <div className="flex-1 flex gap-2">
                                <div className="flex-1">
                                    <select 
                                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none"
                                        value={tempItem.brand}
                                        onChange={e => {
                                            const bName = e.target.value;
                                            const master = data.items.find(i => i.id === tempItem.itemId);
                                            const bData = master?.brands?.find(b => b.name === bName);
                                            setTempItem({
                                                ...tempItem, 
                                                brand: bName, 
                                                price: bData ? (type === 'purchase' ? bData.buyPrice : bData.sellPrice) : (type === 'purchase' ? master.buyPrice : master.sellPrice),
                                                buyPrice: bData ? bData.buyPrice : (master?.buyPrice || 0)
                                            });
                                        }}
                                    >
                                        <option value="">Default Brand</option>
                                        {tempItem.itemId && data.items.find(i => i.id === tempItem.itemId)?.brands?.map(b => (
                                            <option key={b.name} value={b.name}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-24">
                                    <input type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" placeholder="Qty" value={tempItem.qty} onChange={e => setTempItem({...tempItem, qty: e.target.value})} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="w-32">
                                    <input type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" placeholder="Unit Rate" value={tempItem.price} onChange={e => setTempItem({...tempItem, price: e.target.value})} />
                                </div>
                                <button onClick={() => { if(!tempItem.itemId) return; addItem(tempItem); setTempItem({ itemId: '', name: '', brand: '', qty: 1, price: 0 }); }} className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-90 transition-all"><Plus size={24}/></button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {form.items.map((item, idx) => {
                            const addedLinkNames = form.items.filter(i => i.isLinked && i.parentLineId === item.lineId).map(i => i.name);
                            const hasLinks = (item.linkedItems || []).length > 0;

                            return (
                                <div key={idx} className="space-y-2">
                                    <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all ${item.isLinked ? 'bg-orange-50/50 border-orange-100 ml-8' : 'bg-white border-slate-100'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.isLinked ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {item.isLinked ? <LinkIcon size={18}/> : <Package size={18}/>}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight truncate max-w-[150px]">{item.name} {item.brand && `(${item.brand})`}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{item.qty} pcs × ₹{item.price} {item.isLinked && `[Bundle: ${item.parentName}]`}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-black text-slate-900">{formatCurrency(item.qty * item.price)}</span>
                                            <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                    {!item.isLinked && hasLinks && (
                                        <div className="flex flex-wrap gap-2 ml-14">
                                            {item.linkedItems.filter(l => !addedLinkNames.includes(l.name)).map((l, lIdx) => (
                                                <button 
                                                    key={lIdx} 
                                                    onClick={() => addLinkedItem(idx, lIdx)}
                                                    className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-orange-200 flex items-center gap-1.5 active:scale-95 transition-all"
                                                >
                                                    <Plus size={10}/> Add Linked: {l.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {['payment', 'expense'].includes(type) && (
                <div className="px-4">
                    <div className="p-6 bg-purple-50 rounded-[32px] border border-purple-100 shadow-sm space-y-4">
                        <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] flex items-center gap-2"><Banknote size={14}/> Transaction Matrix</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5 col-span-1 md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cashflow Direction</label>
                                <div className="flex bg-white p-1 rounded-2xl border border-purple-100">
                                    <button onClick={() => setForm({...form, subType: 'in'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${form.subType === 'in' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>Received (IN)</button>
                                    <button onClick={() => setForm({...form, subType: 'out'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${form.subType === 'out' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400'}`}>Paid (OUT)</button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Amount</label>
                                <input type="number" className="w-full p-4 bg-white border border-purple-100 rounded-2xl text-xl font-black text-slate-900 outline-none" value={form.amount} onChange={e => setForm({...form, amount: e.target.value, received: form.subType === 'in' ? e.target.value : 0, paid: form.subType === 'out' ? e.target.value : 0})} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Hub</label>
                                <select className="w-full p-4 bg-white border border-purple-100 rounded-2xl text-sm font-bold outline-none font-black text-purple-600" value={form.paymentMode} onChange={e => setForm({...form, paymentMode: e.target.value})}>
                                    <option>Cash</option><option>Bank</option><option>UPI</option><option>Cheque</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {unpaidBills.length > 0 && (
                <div className="px-4 mt-6">
                    <div className="p-6 bg-blue-50 border border-blue-100 rounded-[32px] space-y-4 shadow-sm">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><LinkIcon size={14}/> Pending Clearances</p>
                        <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
                            {unpaidBills.map(bill => {
                                const isLinked = form.linkedBills.some(l => l.billId === bill.id);
                                const linkedData = form.linkedBills.find(l => l.billId === bill.id);
                                return (
                                    <div key={bill.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isLinked ? 'bg-white border-blue-400 shadow-md ring-2 ring-blue-400/10' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex-1" onClick={() => handleLinkChange(bill.id, isLinked ? 0 : bill.stats.pending)}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black text-slate-800 uppercase">{bill.id}</span>
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${bill.type === 'sales' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{bill.type}</span>
                                            </div>
                                            <p className="text-sm font-black text-slate-900 tracking-tight">{formatCurrency(bill.stats.pending)} <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">due</span></p>
                                        </div>
                                        {isLinked && (
                                            <input 
                                                type="number" 
                                                className="w-24 p-2 bg-slate-50 border-none rounded-xl text-xs font-black text-blue-600 text-right outline-none"
                                                value={linkedData.amount}
                                                onChange={(e) => handleLinkChange(bill.id, e.target.value)}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div className="p-6 mx-4 bg-slate-900 rounded-[44px] text-white shadow-2xl mt-8 space-y-6 relative overflow-hidden ring-[12px] ring-slate-900/5">
                <div className="flex justify-between items-end border-b border-white/5 pb-6">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Financial Impact</p>
                        <h2 className="text-4xl font-black tracking-tighter text-blue-400">{formatCurrency(totals.final)}</h2>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Items: {form.items.length}</span>
                        <p className="text-xs font-bold text-slate-400">Total Pre-Adjustments: {formatCurrency(totals.gross)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Adjustment</label>
                        <div className="flex bg-white/5 rounded-2xl p-1 border border-white/5">
                            <input type="number" className="flex-1 bg-transparent p-3 text-sm font-black outline-none" value={form.discountValue} onChange={e => setForm({...form, discountValue: e.target.value})} />
                            <button onClick={() => setForm({...form, discountType: form.discountType === '₹' ? '%' : '₹'})} className="px-4 bg-blue-600 rounded-xl text-xs font-black transition-all active:scale-95">{form.discountType}</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between ml-1">Round Off <Calculator size={10} className="text-blue-500" onClick={applyRoundOff}/></label>
                        <input type="number" step="0.01" className="w-full bg-white/5 p-4 rounded-2xl text-sm font-baseline font-black outline-none border border-white/5" value={form.roundOff} onChange={e => setForm({...form, roundOff: e.target.value})} />
                    </div>
                    <div className="space-y-2 col-span-2 md:col-span-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cash Adjustment</label>
                        <input type="number" className="w-full bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-sm font-black text-emerald-400 outline-none shadow-inner" placeholder="Amt" value={type === 'purchase' ? form.paid : form.received} onChange={e => setForm({...form, [type === 'purchase' ? 'paid' : 'received']: e.target.value})} />
                    </div>
                </div>
            </div>

            <div className="px-4 py-8">
                <button onClick={handleSave} className="w-full bg-slate-900 text-white py-8 rounded-[40px] font-black text-sm uppercase tracking-[0.3em] shadow-[0_25px_50px_rgba(0,0,0,0.1)] active:scale-95 transition-all flex items-center justify-center gap-4 group">
                    <CheckCircle2 size={24} className="group-hover:scale-110 transition-transform"/>
                    Commit Transaction
                </button>
            </div>
        </div>
    );
};

export default TransactionForm;
