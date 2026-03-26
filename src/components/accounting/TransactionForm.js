import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Save, Calculator, Link as LinkIcon, ShoppingBag, Package, Banknote, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import { useDatabase } from '../../hooks/useDatabase';
import { getTransactionTotals, formatCurrency, getBillStats } from '../../utils/helpers';

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
        subType: 'out', // for payments
        linkedBills: [],
        linkedAssetId: '',
        ...(record || {})
    });

    const [tempItem, setTempItem] = useState({ itemId: '', name: '', brand: '', qty: 1, price: 0, buyPrice: 0 });

    // 1. Auto-Kit Logic: When an item is added, check for linked items
    const addItem = (itemToPush) => {
        const itemMaster = data.items.find(i => i.name === itemToPush.name || i.id === itemToPush.itemId);
        let newItems = [...form.items, { ...itemToPush, itemId: itemMaster?.id || itemToPush.itemId }];

        // Check for linked items (Kits)
        if (itemMaster?.linkedItems && itemMaster.linkedItems.length > 0) {
            itemMaster.linkedItems.forEach(li => {
                const liMaster = data.items.find(i => i.name === li.name);
                newItems.push({
                    itemId: liMaster?.id || `L-${Date.now()}-${Math.random()}`,
                    name: li.name,
                    brand: li.brand || '',
                    qty: itemToPush.qty * (li.qty || 1),
                    price: li.price || 0,
                    buyPrice: liMaster?.buyPrice || 0,
                    isLinked: true,
                    parentItem: itemMaster.name
                });
            });
        }
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
            finalTotal: totals.final,
            grossTotal: totals.gross,
            updatedAt: new Date().toISOString()
        };

        await saveRecord('transactions', finalToSave, type);
        onClose();
    };

    const party = data.parties.find(p => p.id === form.partyId);
    const unpaidBills = useMemo(() => {
        if (!form.partyId || type !== 'payment') return [];
        return data.transactions
            .filter(t => t.partyId === form.partyId && ['sales', 'purchase'].includes(t.type) && t.status !== 'Cancelled')
            .map(t => ({ ...t, stats: getBillStats(t, data.transactions) }))
            .filter(t => t.stats.pending > 0.5);
    }, [form.partyId, type, data.transactions]);

    return (
        <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 scrollbar-hide py-2">
            {/* Header / Type Switcher */}
            {!record && (
                <div className="flex bg-slate-100 p-1 rounded-[24px]">
                    {['sales', 'estimate', 'purchase', 'expense', 'payment'].map(t => (
                        <button 
                            key={t} 
                            onClick={() => setType(t)} 
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all ${type === t ? 'bg-white text-blue-600 shadow-sm scale-100' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="space-y-4">
                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-[32px] space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Package size={14}/> Inventory Selection</p>
                        
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1">
                                <SearchableSelect 
                                    options={data.items.map(i => ({ 
                                        id: i.id, 
                                        name: i.name, 
                                        subText: `Stk: 0 | ₹${type === 'purchase' ? i.buyPrice : i.sellPrice}`,
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
                                            price: type === 'purchase' ? item?.buyPrice : item?.sellPrice,
                                            buyPrice: item?.buyPrice
                                        });
                                    }}
                                    placeholder="Search Product..."
                                />
                            </div>
                            
                            {tempItem.itemId && data.items.find(i => i.id === tempItem.itemId)?.brands?.length > 0 && (
                                <select 
                                    className="md:w-40 p-4 bg-white border border-slate-100 rounded-2xl text-xs font-bold outline-none"
                                    value={tempItem.brand}
                                    onChange={e => {
                                        const bName = e.target.value;
                                        const master = data.items.find(i => i.id === tempItem.itemId);
                                        const bData = master?.brands?.find(b => b.name === bName);
                                        setTempItem({
                                            ...tempItem, 
                                            brand: bName, 
                                            price: bData ? (type === 'purchase' ? bData.buyPrice : bData.sellPrice) : (type === 'purchase' ? master.buyPrice : master.sellPrice),
                                            buyPrice: bData ? bData.buyPrice : master.buyPrice
                                        });
                                    }}
                                >
                                    <option value="">Default Brand</option>
                                    {data.items.find(i => i.id === tempItem.itemId).brands.map(b => (
                                        <option key={b.name} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                            )}

                            <input type="number" className="w-20 p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold outline-none" placeholder="Qty" value={tempItem.qty} onChange={e => setTempItem({...tempItem, qty: e.target.value})} />
                            <input type="number" className="w-24 p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold outline-none" placeholder="Rate" value={tempItem.price} onChange={e => setTempItem({...tempItem, price: e.target.value})} />
                            <button onClick={() => { if(!tempItem.itemId) return; addItem(tempItem); setTempItem({ itemId: '', name: '', brand: '', qty: 1, price: 0 }); }} className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20 active:scale-90 transition-all"><Plus size={20}/></button>
                        </div>
                    </div>

                    {/* Item List */}
                    <div className="space-y-2">
                        {form.items.map((item, idx) => (
                            <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-in slide-in-from-bottom-2 ${item.isLinked ? 'bg-orange-50/50 border-orange-100' : 'bg-white border-slate-100'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.isLinked ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {item.isLinked ? <LinkIcon size={18}/> : <Package size={18}/>}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.name} {item.brand && `(${item.brand})`}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{item.qty} {item.unit || 'pcs'} × ₹{item.price} {item.isLinked && `[Bundle: ${item.parentItem}]`}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-black text-slate-900">{formatCurrency(item.qty * item.price)}</span>
                                    <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payments / Expenses Section */}
            {['payment', 'expense'].includes(type) && (
                <div className="p-6 bg-purple-50 rounded-[32px] border border-purple-100 space-y-4">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-2"><Banknote size={14}/> Transaction Details</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount</label>
                            <input type="number" className="w-full p-4 bg-white border border-purple-100 rounded-2xl text-xl font-black text-purple-700 outline-none" value={form.amount} onChange={e => setForm({...form, amount: e.target.value, received: e.target.value, paid: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mode</label>
                            <select className="w-full p-4 bg-white border border-purple-100 rounded-2xl text-sm font-bold outline-none" value={form.paymentMode} onChange={e => setForm({...form, paymentMode: e.target.value})}>
                                <option>Cash</option>
                                <option>Bank</option>
                                <option>UPI</option>
                                <option>Cheque</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Financial Summary Box */}
            <div className="p-8 bg-slate-900 rounded-[40px] text-white shadow-2xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                
                <div className="flex justify-between items-end border-b border-white/10 pb-6">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Final Amount</p>
                        <h2 className="text-5xl font-black tracking-tighter">{formatCurrency(totals.final)}</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items: {form.items.length}</p>
                        <p className="text-xs font-bold text-blue-400">Gross: {formatCurrency(totals.gross)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discount</label>
                        <div className="flex bg-white/5 rounded-2xl p-1">
                            <input type="number" className="flex-1 bg-transparent p-3 text-sm font-bold outline-none" value={form.discountValue} onChange={e => setForm({...form, discountValue: e.target.value})} />
                            <button onClick={() => setForm({...form, discountType: form.discountType === '₹' ? '%' : '₹'})} className="px-4 bg-blue-600 rounded-xl text-xs font-black">{form.discountType}</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                            Round Off 
                            <button onClick={applyRoundOff} className="text-blue-400 hover:text-blue-300"><Calculator size={12}/></button>
                        </label>
                        <input type="number" step="0.01" className="w-full bg-white/5 p-4 rounded-2xl text-sm font-bold outline-none" value={form.roundOff} onChange={e => setForm({...form, roundOff: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {type === 'purchase' ? 'Paid Amount' : 'Received'}
                        </label>
                        <input type="number" className="w-full bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-sm font-black text-emerald-400 outline-none" value={type === 'purchase' ? form.paid : form.received} onChange={e => setForm({...form, [type === 'purchase' ? 'paid' : 'received']: e.target.value})} />
                    </div>
                </div>
            </div>

            {/* Floating Save Action */}
            <div className="pt-4">
                <button onClick={handleSave} className="w-full bg-blue-600 text-white py-6 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(37,99,235,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4">
                    <CheckCircle2 size={24}/>
                    Verify & Finalize {type.toUpperCase()}
                </button>
            </div>
        </div>
    );
};

export default TransactionForm;
