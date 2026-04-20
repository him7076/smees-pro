import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Plus, Trash2, Save, Calculator, Link as LinkIcon, ShoppingBag, 
    Package, Banknote, Calendar, ChevronRight, CheckCircle2, AlertCircle, 
    TrendingUp, TrendingDown, Phone, MapPin, ShieldCheck, Info, Search
} from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import { useDatabase } from '../../hooks/useDatabase';
import { 
    getTransactionTotals, formatCurrency, getBillStats, getNextId, 
    getPartyBalances, getItemStock 
} from '../../utils/helpers';
import { doc, setDoc } from "firebase/firestore";
import { db } from '../../services/firebase';

const TransactionForm = ({ data, setData, type: initialType = 'sales', record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [type, setType] = useState(record?.type || initialType);
    const [tx, setTx] = useState({
        date: new Date().toISOString().split('T')[0],
        partyId: '',
        items: [],
        received: 0,
        paid: 0,
        amount: 0, 
        discountType: '%',
        discountValue: 0,
        roundOff: 0,
        notes: '',
        paymentMode: 'Cash',
        subType: (initialType === 'sales' || initialType === 'estimate') ? 'in' : 'out',
        linkedBills: [],
        linkedAssets: [],
        address: '',
        mobile: '',
        locationLabel: '',
        nextServiceDate: '',
        category: '',
        ...(record || {})
    });

    const [showLocPicker, setShowLocPicker] = useState(false);
    const [addBrandModal, setAddBrandModal] = useState(null);
    const [addItemModal, setAddItemModal] = useState(null);
    const [showLinking, setShowLinking] = useState(false);

    const nextId = useMemo(() => {
        if (record) return record.id;
        return getNextId(data, type, tx.date).id;
    }, [data, type, record, tx.date]);

    const itemStock = useMemo(() => getItemStock(data), [data]);
    const partyBalances = useMemo(() => getPartyBalances(data), [data]);

    const selectedParty = useMemo(() => data.parties.find(p => p.id === tx.partyId), [data.parties, tx.partyId]);

    const totals = useMemo(() => getTransactionTotals(tx), [tx]);

    const applyRoundOff = () => {
        const gross = totals.gross;
        let discVal = parseFloat(tx.discountValue || 0);
        if (tx.discountType === '%') discVal = (gross * discVal) / 100;
        const rawTotal = gross - discVal;
        const roundedTotal = Math.round(rawTotal);
        setTx(prev => ({ ...prev, roundOff: (roundedTotal - rawTotal).toFixed(2) }));
    };

    // Auto Round Off Effect (Legacy Match)
    useEffect(() => {
        const gross = tx.items?.reduce((acc, i) => acc + (parseFloat(i.qty || 0) * parseFloat(i.price || 0)), 0) || 0;
        let discVal = parseFloat(tx.discountValue || 0);
        if (tx.discountType === '%') discVal = (gross * discVal) / 100;
        const rawTotal = gross - discVal;
        const roundedTotal = Math.round(rawTotal);
        const autoRound = (roundedTotal - rawTotal).toFixed(2);
        if (parseFloat(tx.roundOff || 0).toFixed(2) !== autoRound) {
            setTx(prev => ({ ...prev, roundOff: autoRound }));
        }
    }, [tx.items, tx.discountValue, tx.discountType]);

    const updateLine = (idx, field, val) => {
        const newItems = [...tx.items];
        newItems[idx][field] = val;

        if (field === 'itemId') {
            const item = data.items.find(i => i.id === val);
            if (item) {
                newItems[idx].price = type === 'purchase' ? item.buyPrice : item.sellPrice;
                newItems[idx].buyPrice = item.buyPrice;
                newItems[idx].description = item.description || '';
                newItems[idx].brand = '';
                newItems[idx].linkedItems = item.linkedItems || [];
                newItems[idx].subItems = []; // Always initialize for bundles
            }
        }

        if (field === 'brand') {
            const item = data.items.find(i => i.id === newItems[idx].itemId);
            if (item && item.brands) {
                const brandData = item.brands.find(b => b.name === val);
                if (brandData) {
                    newItems[idx].price = type === 'purchase' ? brandData.buyPrice : brandData.sellPrice;
                    newItems[idx].buyPrice = brandData.buyPrice;
                }
            }
        }
        setTx({ ...tx, items: newItems });
    };

    const addSubItem = (lineIdx, subItemData) => {
        const newItems = [...tx.items];
        if (!newItems[lineIdx].subItems) newItems[lineIdx].subItems = [];
        newItems[lineIdx].subItems.push({
            ...subItemData,
            price: 0, // Customer doesn't see sub-item prices
            qty: 1
        });
        setTx({ ...tx, items: newItems });
    };

    const removeSubItem = (lineIdx, subIdx) => {
        const newItems = [...tx.items];
        newItems[lineIdx].subItems.splice(subIdx, 1);
        setTx({ ...tx, items: newItems });
    };

    const addLinkedItem = (parentIdx, linkIdx) => {
        const parentLine = tx.items[parentIdx];
        const linkInfo = parentLine.linkedItems[linkIdx];
        if(!linkInfo) return;

        const linkedData = data.items.find(i => i.name === linkInfo.name);
        if(!linkedData) return;

        const master = data.items.find(i => i.id === linkedData.id);
        const newItems = [...tx.items];
        
        const newLine = {
            itemId: linkedData.id,
            qty: parentLine.qty,
            brand: linkInfo.brand || '',
            price: linkInfo.price || (type === 'purchase' ? master?.buyPrice : master?.sellPrice) || 0,
            buyPrice: master?.buyPrice || 0,
            description: linkedData.description || 'Service Charge',
            isLinked: true,
            parentName: parentLine.name || data.items.find(i=>i.id===parentLine.itemId)?.name
        };

        newItems.splice(parentIdx + 1, 0, newLine);
        setTx({ ...tx, items: newItems });
    };

    const handleAddAsset = (assetName) => {
        const assetObj = selectedParty?.assets?.find(a => a.name === assetName);
        if (!assetObj) return;

        const interval = assetObj.serviceInterval ? parseInt(assetObj.serviceInterval) : 3;
        const d = new Date(tx.date);
        d.setMonth(d.getMonth() + interval);
        
        if (tx.linkedAssets.some(a => a.name === assetName)) return;

        setTx({
            ...tx,
            linkedAssets: [...tx.linkedAssets, { name: assetName, nextServiceDate: d.toISOString().split('T')[0] }]
        });
    };

    const handleLocationSelect = (loc) => {
        setTx({...tx, address: loc.address, mobile: loc.mobile || selectedParty?.mobile || '', locationLabel: loc.label });
        setShowLocPicker(false);
    };

    const handleSave = async () => {
        if (!tx.partyId && type !== 'expense' && tx.paymentMode !== 'Cash') return alert("Select Party");
        if (['sales', 'purchase', 'estimate'].includes(type) && tx.items.length === 0) return alert("Items required");
        
        const finalToSave = { 
            ...tx, 
            type, 
            id: nextId,
            finalTotal: totals.final,
            grossTotal: totals.gross,
            createdAt: record?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await saveRecord('transactions', finalToSave, type);
        onClose();
    };

    const unpaidBills = useMemo(() => {
        if (!tx.partyId) return [];
        return data.transactions.filter(t => {
            if (t.partyId !== tx.partyId || t.id === tx.id || t.type === 'estimate' || t.status === 'Cancelled') return false;
            
            const isAlreadyLinked = tx.linkedBills?.some(l => l.billId === t.id);
            if (isAlreadyLinked) return true;

            const isSourceCredit = (type === 'payment' && tx.subType === 'in') || type === 'purchase' || type === 'expense';
            const isTargetCredit = (t.type === 'payment' && t.subType === 'in') || t.type === 'purchase' || t.type === 'expense';

            if (isSourceCredit === isTargetCredit) return false;

            const stats = getBillStats(t, data.transactions);
            if (['sales', 'purchase', 'expense'].includes(t.type)) return stats.status !== 'PAID';
            if (t.type === 'payment') return stats.status !== 'FULLY USED';

            return false;
        });
    }, [tx.partyId, data.transactions, tx.linkedBills, type, tx.subType, tx.id]);

    const handleLinkChange = (billId, value) => {
        const amt = parseFloat(value) || 0;
        let maxLimit = totals.final;
        if (type === 'payment') {
            maxLimit = parseFloat(tx.amount || 0) + (parseFloat(tx.discountValue || 0));
        }
        
        // If amount is not set for payment, we can't link
        if (maxLimit <= 0) return alert("Please enter the total transaction amount first.");

        let newLinked = [...(tx.linkedBills || [])];
        const existingIdx = newLinked.findIndex(l => l.billId === billId);
        
        // Calculate total linked EXCEPT the current one
        const currentOtherTotal = newLinked.reduce((sum, l, i) => i === existingIdx ? sum : sum + (parseFloat(l.amount) || 0), 0);
        const available = Math.max(0, maxLimit - currentOtherTotal);

        let finalAmtToLink = amt;
        if (amt > available) {
            finalAmtToLink = available;
            if (amt > 0) {
                // Only alert if the user explicitly typed a too-large number
                // if they just clicked the pill, we silent-cap it.
            }
        }

        if (existingIdx >= 0) {
            if (finalAmtToLink <= 0) newLinked.splice(existingIdx, 1);
            else newLinked[existingIdx] = { ...newLinked[existingIdx], amount: finalAmtToLink };
        } else if (finalAmtToLink > 0) {
            newLinked.push({ billId, amount: finalAmtToLink });
        }

        setTx({ ...tx, linkedBills: newLinked });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-32 scrollbar-hide">
            {/* Header Sticky Bar */}
            <div className="sticky top-0 z-[110] bg-white border-b border-slate-100 p-3 shadow-sm flex items-center justify-between">
                <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner overflow-x-auto scrollbar-hide flex-1 mr-4">
                    {['sales', 'purchase', 'estimate', 'payment', 'expense'].map(t => (
                        <button 
                            key={t} 
                            onClick={() => { setType(t); setTx(prev => ({ ...prev, subType: (t === 'sales' || t === 'estimate') ? 'in' : 'out', items: [], amount: 0 })); }} 
                            className={`flex-1 min-w-[80px] px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${type === t ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl whitespace-nowrap shadow-sm">
                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-tight leading-none">VCh:</span>
                    <span className="text-xs font-black text-blue-700 leading-none">#{nextId}</span>
                </div>
            </div>

            <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto w-full">
                {type === 'payment' ? (
                     <div className="space-y-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm animate-in fade-in">
                        {/* ROW 1: Date & Type */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"><Calendar size={12} className="inline mr-1"/>Date</label>
                                <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none" value={tx.date} onChange={e => setTx({...tx, date: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Flow / Direction</label>
                                <div className="flex bg-slate-50 border border-slate-100 rounded-2xl p-1 h-[54px] md:h-auto">
                                    <button onClick={() => setTx({...tx, subType: 'in'})} className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tx.subType === 'in' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 hover:bg-slate-200'}`}>Pay In</button>
                                    <button onClick={() => setTx({...tx, subType: 'out'})} className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tx.subType === 'out' ? 'bg-rose-500 text-white shadow' : 'text-slate-500 hover:bg-slate-200'}`}>Pay Out</button>
                                </div>
                            </div>
                        </div>

                        {/* ROW 2: Party Name */}
                        <div className="space-y-1.5 pt-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Party Name</label>
                                {selectedParty && <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${partyBalances[tx.partyId] < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>Bal: {formatCurrency(Math.abs(partyBalances[tx.partyId] || 0))} {partyBalances[tx.partyId] < 0 ? 'CR' : 'DR'}</span>}
                            </div>
                            <SearchableSelect 
                                options={data.parties.map(p => ({ id: p.id, name: p.name, subText: p.type === 'DR' ? 'Customer' : 'Vendor' }))}
                                value={tx.partyId}
                                onChange={v => setTx({...tx, partyId: v, locationLabel: '', address: ''})}
                                placeholder="Select Party..."
                            />
                        </div>

                        {/* ROW 3: Amount & Type */}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Amount</label>
                                <input type="number" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xl font-black text-blue-600 outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="0.00" value={tx.amount || ''} onChange={e=>setTx({...tx, amount: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mode</label>
                                <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none h-[64px]" value={tx.paymentMode} onChange={e => setTx({...tx, paymentMode: e.target.value})}>
                                    {['Cash', 'Bank', 'UPI', 'Credit'].map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* ROW 4: Link Bills */}
                        <div className="pt-2">
                            <button onClick={() => setShowLinking(true)} disabled={unpaidBills.length === 0} className="w-full flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600 font-black text-xs uppercase tracking-widest active:scale-95 transition-all outline-none">
                                <span className="flex items-center gap-2"><LinkIcon size={16}/> Link Pending Bills</span>
                                <div className="flex gap-2">
                                    <span className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow text-[10px]">{tx.linkedBills?.length || 0} Linked</span>
                                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px]">{unpaidBills.length} Avail</span>
                                </div>
                            </button>
                        </div>

                        {/* ROW 5: Discount & Round Off */}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Discount Settled</label>
                                <div className="flex bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden p-1 h-[54px] md:h-[64px]">
                                    <input type="number" className="flex-1 min-w-0 bg-transparent px-3 text-sm font-black outline-none" placeholder="0" value={tx.discountValue || ''} onChange={e=>setTx({...tx, discountValue: e.target.value})} />
                                    <button onClick={() => setTx({...tx, discountType: tx.discountType === '%' ? '₹' : '%'})} className="px-4 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 shadow-sm transition-all">{tx.discountType}</button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Round Off Amt</label>
                                <input type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none h-[54px] md:h-[64px]" placeholder="0.00" value={tx.roundOff || ''} onChange={e=>setTx({...tx, roundOff: e.target.value})} />
                            </div>
                        </div>

                        {/* ROW 6: Description */}
                        <div className="space-y-1.5 pt-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                            <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none resize-none min-h-[100px]" placeholder="Add remarks..." value={tx.notes || ''} onChange={e=>setTx({...tx, notes: e.target.value})} />
                        </div>
                     </div>
                ) : (
                    <>
                        {/* PRIMARY INPUTS: Timeline & Identification */}
                        <div className="grid grid-cols-1 gap-4">
                     <div className="space-y-1.5 p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Calendar size={14}/> Date</label>
                        <input type="date" className="w-full p-4 bg-slate-50 border border-slate-50 rounded-2xl text-sm font-black outline-none shadow-inner" value={tx.date} onChange={e => setTx({...tx, date: e.target.value})} />
                     </div>
                </div>

                {/* SECONDARY INPUTS: Counterparty & Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><LinkIcon size={14}/> {type === 'expense' ? 'Expense Category' : 'Party / Client Name'}</p>
                            {selectedParty && type !== 'expense' && (
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${partyBalances[tx.partyId] < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    Bal: {formatCurrency(Math.abs(partyBalances[tx.partyId] || 0))} {partyBalances[tx.partyId] < 0 ? 'CR' : 'DR'}
                                </span>
                            )}
                        </div>
                        {type === 'expense' ? (
                            <div className="space-y-3">
                                <SearchableSelect 
                                    options={(data.categories?.expense || []).map(c => ({ id: c, name: c }))}
                                    value={tx.category}
                                    onChange={v => setTx({...tx, category: v})}
                                    placeholder="Select Expense Category..."
                                    onAddNew={async (v) => {
                                        const newCats = [...(data.categories?.expense || []), v];
                                        const updatedCategories = { ...data.categories, expense: newCats };
                                        await setDoc(doc(db, "settings", "categories"), updatedCategories, { merge: true });
                                        setData(prev => ({ ...prev, categories: updatedCategories }));
                                        setTx({ ...tx, category: v });
                                    }}
                                />
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Party Name (Optional)</p>
                                    <SearchableSelect 
                                        options={data.parties.map(p => ({ id: p.id, name: p.name, subText: p.type === 'DR' ? 'Customer' : 'Vendor' }))}
                                        value={tx.partyId}
                                        onChange={v => setTx({...tx, partyId: v})}
                                        placeholder="Select Party..."
                                    />
                                </div>
                            </div>
                        ) : (
                            <SearchableSelect 
                                options={data.parties.map(p => ({ id: p.id, name: p.name, subText: p.type === 'DR' ? 'Customer' : 'Vendor' }))}
                                value={tx.partyId}
                                onChange={v => setTx({...tx, partyId: v, locationLabel: '', address: ''})}
                                placeholder="Select Party..."
                            />
                        )}

                        {/* Mobile & Location Picker */}
                        {selectedParty && type !== 'expense' && (selectedParty.locations?.length > 0 || selectedParty.mobileNumbers?.length > 0) && (
                            <div className="relative pt-2">
                                <div className="flex justify-between items-center bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
                                     <div className="text-[10px] text-slate-800 flex-1 min-w-0">
                                         <span className="font-black">Direct: </span> 
                                         <span className="font-black bg-white px-2 py-0.5 rounded-lg border ml-1 text-blue-600 truncate inline-block max-w-[100px]">{tx.locationLabel || 'Main'}</span>
                                         <div className="truncate text-slate-500 mt-1 font-bold">{tx.address || selectedParty.address}</div>
                                         <div className="font-black text-emerald-600 flex items-center gap-1 mt-0.5"><Phone size={10}/> {tx.mobile || selectedParty.mobile}</div>
                                     </div>
                                     <button onClick={() => setShowLocPicker(!showLocPicker)} className="text-[9px] font-black bg-white border px-4 py-2.5 rounded-xl shadow-sm text-blue-600 active:scale-95 transition-all">Relocate</button>
                                </div>
                                {showLocPicker && (
                                    <div className="absolute z-[120] w-full mt-2 bg-white border border-slate-200 rounded-3xl shadow-2xl p-4 space-y-2 max-h-[350px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                        <div onClick={() => handleLocationSelect({ label: '', address: selectedParty.address, mobile: selectedParty.mobile })} className="p-3 hover:bg-slate-50 border-b border-slate-50 cursor-pointer bg-slate-50/50 rounded-xl mb-1">
                                            <span className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Base Address</span>
                                            <div className="text-xs font-bold text-slate-900 mt-1">{selectedParty.mobile}</div>
                                        </div>
                                        {selectedParty.mobileNumbers?.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1">Select Active Contacts</p>
                                                {selectedParty.mobileNumbers.map((mob, idx) => {
                                                    const isSelected = tx.mobile?.includes(mob.number);
                                                    return (
                                                        <div key={idx} onClick={() => {
                                                            let current = tx.mobile ? tx.mobile.split(', ').filter(Boolean) : [];
                                                            if (isSelected) current = current.filter(n => n !== mob.number);
                                                            else current.push(mob.number);
                                                            setTx({ ...tx, mobile: current.join(', ') });
                                                        }} className={`p-3 cursor-pointer rounded-xl border flex justify-between items-center transition-all ${isSelected ? 'bg-emerald-50 border-emerald-100' : 'hover:bg-slate-50 border-transparent'}`}>
                                                            <span className="text-xs font-bold">{mob.label}</span>
                                                            <span className={`text-[11px] font-black ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`}>{mob.number}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {selectedParty.locations?.length > 0 && (
                                            <div className="space-y-1 pt-2 border-t border-slate-50">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1">Logistics / Site</p>
                                                {selectedParty.locations.map((loc, idx) => (
                                                    <div key={idx} onClick={() => handleLocationSelect(loc)} className="p-3 hover:bg-blue-50 cursor-pointer rounded-xl border border-transparent">
                                                        <span className="text-xs font-black text-blue-600 flex items-center gap-1"><MapPin size={10}/> {loc.label}</span>
                                                        <div className="text-[10px] font-bold text-slate-500 truncate mt-0.5">{loc.address}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        {/* AMC / Asset Linking (LEGACY Parity) */}
                        {['sales'].includes(type) && selectedParty?.assets?.length > 0 && (
                            <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-[32px] space-y-4">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><Package size={14}/> Asset Mapping</p>
                                    <span className="text-[9px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full">{tx.linkedAssets.length} LINKED</span>
                                </div>
                                <div className="space-y-2">
                                    {tx.linkedAssets.map((asset, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-2xl border border-indigo-100 flex justify-between items-center shadow-sm">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-indigo-900 truncate">{asset.name}</p>
                                                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-50">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">Service Interval:</span>
                                                    <input type="date" className="p-1 border-none bg-slate-50 rounded text-[10px] font-black text-indigo-600 outline-none" value={asset.nextServiceDate} onChange={(e) => {
                                                        const na = [...tx.linkedAssets];
                                                        na[idx].nextServiceDate = e.target.value;
                                                        setTx({ ...tx, linkedAssets: na });
                                                    }} />
                                                </div>
                                            </div>
                                            <button onClick={() => setTx({...tx, linkedAssets: tx.linkedAssets.filter((_, i) => i !== idx)})} className="p-2 text-rose-300 hover:text-rose-500 transition-colors"><X size={18}/></button>
                                        </div>
                                    ))}
                                </div>
                                <select className="w-full p-4 bg-white border border-indigo-200 rounded-2xl text-xs font-black text-indigo-600 outline-none shadow-sm" value="" onChange={e => handleAddAsset(e.target.value)}>
                                    <option value="">+ Connect Asset Data</option>
                                    {selectedParty.assets.map((a, i) => (
                                        <option key={i} value={a.name} disabled={tx.linkedAssets.some(la => la.name === a.name)}>{a.name} ({a.brand})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>                
                {/* Items Section */}
                {type !== 'payment' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center px-2">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShoppingBag size={16}/> Items / Bundles</h4>
                        </div>
                        
                        <div className="space-y-4">
                            {tx.items.map((line, idx) => {
                                const master = data.items.find(i => i.id === line.itemId);
                                const lineSubTotal = parseFloat(line.qty || 0) * parseFloat(line.price || 0);
                                const subItemsCost = (line.subItems || []).reduce((acc, sub) => acc + (parseFloat(sub.qty || 0) * parseFloat(sub.buyPrice || 0)), 0);
                                const lineProfit = (parseFloat(line.price || 0) - parseFloat(line.buyPrice || 0)) * parseFloat(line.qty || 0) - subItemsCost;

                                return (
                                    <div key={idx} className={`p-5 bg-white border border-slate-100 rounded-[32px] shadow-sm relative space-y-4 animate-in slide-in-from-bottom-2 ${line.isLinked ? 'ml-6 bg-orange-50/10 border-orange-50' : ''}`}>
                                        <button onClick={() => setTx({...tx, items: tx.items.filter((_, i) => i !== idx)})} className="absolute -top-3 -right-3 bg-white p-2 rounded-full shadow-xl border border-slate-50 text-rose-500 hover:scale-110 transition-all"><Trash2 size={16}/></button>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-4">
                                            <SearchableSelect 
                                                options={data.items.map(i => ({ id: i.id, name: i.name, subText: `Stk: ${itemStock[i.id] || 0}` }))}
                                                value={line.itemId}
                                                onChange={v => updateLine(idx, 'itemId', v)}
                                                onAddNew={() => setAddItemModal({ idx })}
                                                placeholder="Identify Product..."
                                            />
                                            {master && (
                                                <SearchableSelect 
                                                    placeholder={master.brands?.length ? "Brand/Variant" : "No Variants"}
                                                    options={master.brands?.map(b => ({ id: b.name, name: b.name, subText: `₹${b.sellPrice}` })) || []}
                                                    value={line.brand || ''}
                                                    onChange={v => updateLine(idx, 'brand', v)}
                                                    onAddNew={() => setAddBrandModal({ item: master, idx, name: '', sellPrice: master.sellPrice, buyPrice: master.buyPrice })}
                                                />
                                            )}
                                        </div>

                                        <div className={`grid ${type === 'sales' ? 'grid-cols-4' : 'grid-cols-3'} gap-4`}>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Qty</label>
                                                <input type="number" className="w-full p-3 bg-slate-50 border border-slate-50 rounded-xl text-xs font-black outline-none focus:bg-white focus:border-blue-100" value={line.qty} onChange={e => updateLine(idx, 'qty', e.target.value)} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-emerald-400 uppercase tracking-widest ml-1">{type === 'purchase' ? 'Buy Rate' : type === 'expense' ? 'Rate' : 'Sell Rate'}</label>
                                                <input type="number" className="w-full p-3 bg-emerald-50/30 border border-emerald-50 rounded-xl text-xs font-black text-emerald-700 outline-none focus:bg-white" value={line.price} onChange={e => updateLine(idx, 'price', e.target.value)} />
                                            </div>
                                            {type === 'sales' && (
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-rose-400 uppercase tracking-widest ml-1">Buy Rate</label>
                                                <input type="number" className="w-full p-3 bg-rose-50/30 border border-rose-50 rounded-xl text-xs font-black text-rose-700 outline-none focus:bg-white" value={line.buyPrice || line.purchasePrice || 0} onChange={e => updateLine(idx, 'buyPrice', e.target.value)} />
                                            </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Bundle Subtotal</p>
                                                <p className="text-sm font-black text-slate-900 ml-1">{formatCurrency(lineSubTotal)}</p>
                                            </div>
                                            {type === 'sales' && (
                                                <div className="space-y-1 border-l border-slate-200 pl-3">
                                                    <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-1">Total Yield (NET)</p>
                                                    <div className="flex items-center gap-1 ml-1">
                                                        {lineProfit >= 0 ? <TrendingUp size={10} className="text-emerald-500"/> : <TrendingDown size={10} className="text-rose-500"/>}
                                                        <p className={`text-xs font-black ${lineProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                            {formatCurrency(lineProfit)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="space-y-1 md:col-span-2">
                                                <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest ml-1">Warranty</label>
                                                <select className="w-full p-2 bg-white border border-blue-100 rounded-xl text-[10px] font-black text-blue-700 outline-none" onChange={(e) => {
                                                    const months = parseInt(e.target.value);
                                                    if(!months) return;
                                                    const d = new Date(tx.date || new Date()); 
                                                    d.setMonth(d.getMonth() + months);
                                                    updateLine(idx, 'warrantyDate', d.toISOString().split('T')[0]);
                                                }}>
                                                    <option value="">-</option>
                                                    <option value="6">6M</option>
                                                    <option value="12">1Y</option>
                                                    <option value="24">2Y</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* BUNDLE / SUB-ITEMS MANAGEMENT */}
                                        <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 space-y-3">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex justify-between items-center">
                                                <span>Internal Parts & Material (Hidden from Invoice)</span>
                                                <span className="text-blue-400">{line.subItems?.length || 0} Parts Attached</span>
                                            </p>
                                            
                                            {(line.subItems || []).map((sub, sIdx) => {
                                                const subMaster = data.items.find(i => i.id === sub.itemId);
                                                return (
                                                    <div key={sIdx} className="bg-white/5 p-3 rounded-2xl flex items-center justify-between gap-3 border border-white/5">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-black text-white truncate">{subMaster?.name || 'Item'}</p>
                                                            <div className="flex gap-4 mt-1">
                                                                <span className="text-[8px] font-black text-slate-500 uppercase">Cost: {formatCurrency(sub.buyPrice)}</span>
                                                                <span className="text-[8px] font-black text-emerald-500 uppercase">Qty: {sub.qty}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <input type="number" className="w-12 bg-white/10 rounded-lg p-1 text-[10px] text-white text-center outline-none" value={sub.qty} onChange={e => {
                                                                const ni = [...tx.items];
                                                                ni[idx].subItems[sIdx].qty = e.target.value;
                                                                setTx({...tx, items: ni});
                                                            }} />
                                                            <button onClick={() => removeSubItem(idx, sIdx)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"><Trash2 size={12}/></button>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            <div className="grid grid-cols-[1.5fr,1fr] gap-2 pt-2">
                                                <SearchableSelect 
                                                    options={data.items.map(i => ({ id: i.id, name: i.name, subText: `₹${i.buyPrice}` }))}
                                                    placeholder="+ Add Internal Part..."
                                                    onChange={v => {
                                                        const item = data.items.find(i => i.id === v);
                                                        if (item) addSubItem(idx, { itemId: item.id, buyPrice: item.buyPrice });
                                                    }}
                                                    className="transaction-sub-select"
                                                />
                                                <button onClick={() => addLinkedItem(idx, 0)} className="bg-blue-600/20 text-blue-400 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600/30 transition-all">+ Add Suggested</button>
                                            </div>
                                        </div>

                                        <input className="w-full text-xs p-3 bg-slate-50 border border-slate-50 rounded-xl font-bold" placeholder="Line notes / description..." value={line.description || ''} onChange={e => updateLine(idx, 'description', e.target.value)} />
                                    </div>
                                );
                            })}
                        </div>

                        <button onClick={() => setTx({...tx, items: [...tx.items, { itemId: '', qty: 1, price: 0, buyPrice: 0 }]})} className="w-full py-5 border-2 border-dashed border-slate-200 text-slate-400 rounded-[32px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all flex items-center justify-center gap-2 mt-4"><Plus size={16}/> New Line Item</button>
                    </div>
                )}

                {/* Footer Adjustments */}
                <div className="pt-8 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apply Discount</label>
                                <div className="flex bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-sm h-[54px] md:h-auto ring-4 ring-slate-50">
                                    <div className="bg-slate-100 px-3 flex items-center text-slate-500 font-black text-xs">{tx.discountType}</div>
                                    <input type="number" className="flex-1 p-4 text-sm font-black outline-none bg-transparent" placeholder="0.00" value={tx.discountValue || ''} onChange={e=>setTx({...tx, discountValue: e.target.value})} />
                                    <div className="flex bg-slate-50 p-1.5 gap-1.5 border-l">
                                        <button onClick={()=>setTx({...tx, discountType: '%'})} className={`px-5 rounded-2xl text-[11px] font-black transition-all ${tx.discountType === '%' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>%</button>
                                        <button onClick={()=>setTx({...tx, discountType: '₹'})} className={`px-5 rounded-2xl text-[11px] font-black transition-all ${tx.discountType === '₹' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>₹</button>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">Round Off <Calculator size={10} className="text-blue-500" onClick={applyRoundOff}/></label>
                                <input type="number" step="0.01" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-black outline-none" value={tx.roundOff} onChange={e=>setTx({...tx, roundOff: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Voucher Remarks</label>
                            <textarea className="w-full p-5 bg-white border border-slate-200 rounded-[32px] text-sm font-bold shadow-sm min-h-[100px] outline-none" placeholder="Add memorandum..." value={tx.notes} onChange={e=>setTx({...tx, notes: e.target.value})} />
                        </div>
                    </div>

                    <div className="p-10 bg-slate-900 rounded-[48px] shadow-2xl space-y-8 relative overflow-hidden ring-[12px] ring-slate-950/5">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="flex justify-between items-baseline border-b border-white/5 pb-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Final Settlement</p>
                                <h2 className="text-5xl font-black text-blue-400 tracking-tighter">{formatCurrency(type === 'payment' ? (parseFloat(tx.amount||0)) : totals.final)}</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Items: {tx.items.length}</p>
                                <p className="text-xs font-bold text-slate-400">Gross: {formatCurrency(totals.gross)}</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {type === 'payment' && (
                                <div className="space-y-4 animate-in slide-in-from-top-4">
                                     <div className="bg-white/5 p-4 rounded-2xl flex gap-2">
                                        <button onClick={() => setTx({...tx, subType: 'in'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tx.subType === 'in' ? 'bg-emerald-500 text-white shadow-xl' : 'bg-transparent text-slate-500'}`}>Payment In</button>
                                        <button onClick={() => setTx({...tx, subType: 'out'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tx.subType === 'out' ? 'bg-rose-500 text-white shadow-xl' : 'bg-transparent text-slate-500'}`}>Payment Out</button>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Payment Amount</span>
                                        <input type="number" className="w-full bg-transparent text-left font-black text-white text-3xl outline-none" value={tx.amount} onChange={e=>setTx({...tx, amount: e.target.value})} />
                                    </div>
                                </div>
                            )}
                            {['sales', 'purchase', 'expense'].includes(type) && (
                                <>
                                <div className="flex justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest pt-1">{type === 'purchase' || type === 'expense' ? 'Amt Paid' : 'Amt Recv'}</span>
                                    <input type="number" className="w-32 bg-transparent text-right font-black text-emerald-400 text-xl outline-none" value={type === 'sales' ? tx.received : tx.paid} onChange={e=>setTx({...tx, [type === 'sales' ? 'received' : 'paid']: e.target.value})} />
                                </div>
                                {(parseFloat(type === 'sales' ? tx.received : tx.paid || 0) > 0) && (
                                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5 animate-in fade-in zoom-in-95">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Payment Mode</span>
                                        <div className="flex gap-1.5">
                                            {['Cash', 'Bank', 'UPI', 'Credit'].map(m => (
                                                <button key={m} onClick={() => setTx({...tx, paymentMode: m})} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${tx.paymentMode === m ? 'bg-white text-slate-900 shadow-lg' : 'bg-transparent text-slate-500 hover:text-white'}`}>
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                </>
                            )}
                            {unpaidBills.length > 0 && (
                                <button onClick={() => setShowLinking(true)} className="w-full flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                                    <span className="flex items-center gap-2"><LinkIcon size={14}/> Link Pending Bills</span>
                                    <ChevronRight size={16}/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                </>
                )}
            </div>

            {/* Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-[120] flex gap-4 max-w-5xl mx-auto rounded-t-[40px] shadow-2xl">
                <button onClick={onClose} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
                <button onClick={handleSave} className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <CheckCircle2 size={20}/>
                    Commit Voucher
                </button>
            </div>

            {/* Link Bills Modal Overlay */}
            {showLinking && (
                <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Clear Outstanding</h3>
                            <button onClick={() => setShowLinking(false)} className="p-2 bg-slate-100 rounded-full"><X size={18}/></button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                            {unpaidBills.map(bill => {
                                const isLinked = tx.linkedBills?.some(l => l.billId === bill.id);
                                const linkedData = tx.linkedBills?.find(l => l.billId === bill.id);
                                const stats = getBillStats(bill, data.transactions);
                                return (
                                    <div key={bill.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isLinked ? 'bg-indigo-50 border-indigo-400' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex-1 cursor-pointer" onClick={() => handleLinkChange(bill.id, isLinked ? 0 : stats.pending)}>
                                            <p className="text-[10px] font-black text-indigo-900 uppercase">#{bill.id} <span className="bg-white px-1.5 py-0.5 rounded ml-1 text-slate-400 border">{bill.type === 'payment' ? (bill.subType === 'in' ? 'Pay In' : 'Pay Out') : bill.type}</span></p>
                                            <p className="font-black text-slate-900 mt-1">{formatCurrency(stats.amount)} <span className="text-[9px] text-slate-400 uppercase font-black ml-1">Total</span> <span className="text-rose-600 ml-2">{formatCurrency(stats.pending)}</span> <span className="text-[9px] text-rose-400 uppercase font-black ml-1">Due</span></p>
                                        </div>
                                        {isLinked && (
                                            <input type="number" className="w-24 p-2 bg-white border border-indigo-200 rounded-xl text-xs font-black text-center text-indigo-600 shadow-inner" value={linkedData.amount} onChange={e => handleLinkChange(bill.id, e.target.value)} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-8 bg-slate-50 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Linked Total</span>
                                <span className="text-xl font-black text-indigo-600">{formatCurrency(tx.linkedBills.reduce((s,l)=>s+parseFloat(l.amount||0),0))}</span>
                            </div>
                            <button onClick={() => setShowLinking(false)} className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-[10px] uppercase tracking-widest shadow-xl">Complete Linking</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Brand Modal */}
            {addBrandModal && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-[40px] w-full max-w-sm shadow-2xl animate-in zoom-in-95 border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Plus size={14}/> Define New Variant</p>
                            <button onClick={() => setAddBrandModal(null)} className="p-2 bg-slate-50 rounded-full"><X size={18}/></button>
                        </div>
                        <p className="text-xs font-black text-slate-800 uppercase mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100 truncate">{addBrandModal.item.name}</p>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Variant Name</label>
                                <input 
                                    value={addBrandModal.name || ''} 
                                    onChange={e => setAddBrandModal({...addBrandModal, name: e.target.value})}
                                    autoFocus 
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-black" 
                                    placeholder="e.g. 10 Meter / Heavy Duty" 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sale Price</label>
                                    <input 
                                        type="number" 
                                        value={addBrandModal.sellPrice || 0} 
                                        onChange={e => setAddBrandModal({...addBrandModal, sellPrice: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buy Price</label>
                                    <input 
                                        type="number" 
                                        value={addBrandModal.buyPrice || 0} 
                                        onChange={e => setAddBrandModal({...addBrandModal, buyPrice: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none" 
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={async () => {
                                    const { name, sellPrice, buyPrice, item, idx } = addBrandModal;
                                    if(!name) return alert("Required");
                                    
                                    const newBrands = [...(item.brands || []), { name, sellPrice: parseFloat(sellPrice||0), buyPrice: parseFloat(buyPrice||0) }];
                                    const updatedItem = { ...item, brands: newBrands, updatedAt: new Date().toISOString() };
                                    
                                    await setDoc(doc(db, "items", item.id), updatedItem, { merge: true });
                                    setData(prev => ({ ...prev, items: prev.items.map(i => i.id === item.id ? updatedItem : i) }));
                                    updateLine(idx, 'brand', name);
                                    setAddBrandModal(null);
                                }}
                                className="w-full py-6 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-200 active:scale-95 transition-all mt-4"
                            >
                                Secure New Variant
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Add Item Modal */}
            {addItemModal && (
                <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-[40px] w-full max-w-lg shadow-2xl animate-in zoom-in-95 border border-slate-100 overflow-y-auto max-h-[90vh] scrollbar-hide">
                        <div className="flex justify-between items-center mb-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Package size={14}/> Create New Master Item</p>
                            <button onClick={() => setAddItemModal(null)} className="p-2 bg-slate-50 rounded-full"><X size={18}/></button>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Name</label>
                                <input 
                                    autoFocus 
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" 
                                    placeholder="Enter item name..."
                                    onBlur={e => setAddItemModal(prev => ({...prev, name: e.target.value}))}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sell Price</label>
                                    <input type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none" placeholder="0.00" onBlur={e => setAddItemModal(prev => ({...prev, sellPrice: e.target.value}))}/>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buy Price</label>
                                    <input type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none" placeholder="0.00" onBlur={e => setAddItemModal(prev => ({...prev, buyPrice: e.target.value}))}/>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                                    <SearchableSelect 
                                        options={(data.categories?.item || []).map(c => ({ id: c, name: c }))}
                                        onChange={v => setAddItemModal(prev => ({...prev, category: v}))}
                                        placeholder="Category..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit</label>
                                    <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black outline-none" onChange={e => setAddItemModal(prev => ({...prev, unit: e.target.value}))}>
                                        <option>pcs</option><option>mtr</option><option>set</option><option>box</option>
                                    </select>
                                </div>
                            </div>

                            <button 
                                onClick={async () => {
                                    if(!addItemModal.name) return alert("Name is required");
                                    const nextId = getNextId(data, 'item').id;
                                    const newItem = {
                                        id: nextId,
                                        name: addItemModal.name,
                                        sellPrice: parseFloat(addItemModal.sellPrice || 0),
                                        buyPrice: parseFloat(addItemModal.buyPrice || 0),
                                        category: addItemModal.category || '',
                                        unit: addItemModal.unit || 'pcs',
                                        type: 'Goods',
                                        brands: [],
                                        linkedItems: [],
                                        createdAt: new Date().toISOString()
                                    };

                                    await setDoc(doc(db, "items", nextId), newItem);
                                    setData(prev => ({ ...prev, items: [...prev.items, newItem] }));
                                    updateLine(addItemModal.idx, 'itemId', nextId);
                                    setAddItemModal(null);
                                }}
                                className="w-full py-6 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-200 active:scale-95 transition-all mt-4"
                            >
                                Create & Add to Bill
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionForm;
