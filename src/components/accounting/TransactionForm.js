import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Plus, Trash2, Save, Calculator, Link as LinkIcon, ShoppingBag, 
    Package, Banknote, Calendar, ChevronRight, CheckCircle2, AlertCircle, 
    TrendingUp, TrendingDown, Phone, MapPin, ShieldCheck, Info
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
    const [showLinking, setShowLinking] = useState(false);

    const nextId = useMemo(() => {
        if (record) return record.id;
        return getNextId(data, type).id;
    }, [data, type, record]);

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
            const baseAmt = parseFloat(tx.amount || 0);
            const disc = parseFloat(tx.discountValue || 0);
            maxLimit = baseAmt + disc;
        }
        if (maxLimit <= 0) return alert("Enter amount first");

        let newLinked = [...(tx.linkedBills || [])];
        const existingIdx = newLinked.findIndex(l => l.billId === billId);

        if (existingIdx >= 0) {
            if (amt <= 0) newLinked.splice(existingIdx, 1);
            else newLinked[existingIdx] = { ...newLinked[existingIdx], amount: amt };
        } else if (amt > 0) {
            newLinked.push({ billId, amount: amt });
        }

        const currentTotal = newLinked.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
        if (currentTotal > maxLimit + 0.1) return alert(`Limit exceeded: ${maxLimit}`);

        setTx({ ...tx, linkedBills: newLinked });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-32 scrollbar-hide">
            {/* Header Sticky Bar */}
            <div className="sticky top-0 z-[110] bg-white border-b border-slate-100 p-4 md:p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner w-full md:w-auto overflow-x-auto scrollbar-hide">
                    {['sales', 'purchase', 'estimate', 'payment', 'expense'].map(t => (
                        <button 
                            key={t} 
                            onClick={() => { setType(t); setTx(prev => ({ ...prev, subType: (t === 'sales' || t === 'estimate') ? 'in' : 'out', items: [], amount: 0 })); }} 
                            className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${type === t ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 px-5 py-3 rounded-2xl">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Voucher:</span>
                    <span className="text-sm font-black text-blue-700 leading-none">#{nextId}</span>
                </div>
            </div>

            <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
                {/* Entity & Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><LinkIcon size={14}/> Entity Information</p>
                            {selectedParty && (
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${partyBalances[tx.partyId] < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    Bal: {formatCurrency(Math.abs(partyBalances[tx.partyId] || 0))} {partyBalances[tx.partyId] < 0 ? 'CR' : 'DR'}
                                </span>
                            )}
                        </div>
                        <SearchableSelect 
                            options={data.parties.map(p => ({ id: p.id, name: p.name, subText: p.type === 'DR' ? 'Customer' : 'Vendor' }))}
                            value={tx.partyId}
                            onChange={v => setTx({...tx, partyId: v, locationLabel: '', address: ''})}
                            placeholder="Select Client..."
                        />

                        {/* Mobile & Location Multi-Picker (LEGACY Parity) */}
                        {selectedParty && (selectedParty.locations?.length > 0 || selectedParty.mobileNumbers?.length > 0) && (
                            <div className="relative pt-2">
                                <div className="flex justify-between items-center bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
                                     <div className="text-[10px] text-slate-800 flex-1 min-w-0">
                                         <span className="font-black">Selected: </span> 
                                         <span className="font-black bg-white px-2 py-0.5 rounded-lg border ml-1 text-blue-600">{tx.locationLabel || 'Default'}</span>
                                         <div className="truncate text-slate-500 mt-1 font-bold">{tx.address || selectedParty.address}</div>
                                         <div className="font-black text-emerald-600 flex items-center gap-1 mt-0.5"><Phone size={10}/> {tx.mobile || selectedParty.mobile}</div>
                                     </div>
                                     <button onClick={() => setShowLocPicker(!showLocPicker)} className="text-[9px] font-black bg-white border px-4 py-2.5 rounded-xl shadow-sm text-blue-600 active:scale-95 transition-all">Change Info</button>
                                </div>
                                {showLocPicker && (
                                    <div className="absolute z-[120] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 space-y-2 max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                        <div onClick={() => handleLocationSelect({ label: '', address: selectedParty.address, mobile: selectedParty.mobile })} className="p-3 hover:bg-slate-50 border-b border-slate-50 cursor-pointer bg-slate-50/50 rounded-xl mb-1">
                                            <span className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Main Details</span>
                                            <div className="text-xs font-bold text-slate-900 mt-1">{selectedParty.mobile}</div>
                                        </div>
                                        {selectedParty.mobileNumbers?.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1">Select Contacts</p>
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
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1">Site Addresses</p>
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
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Timeline</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                    <input type="date" className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none font-black" value={tx.date} onChange={e => setTx({...tx, date: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mode</label>
                                <select className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black outline-none shadow-sm" value={tx.paymentMode} onChange={e => setTx({...tx, paymentMode: e.target.value})}>
                                    <option>Cash</option><option>Bank</option><option>UPI</option><option>Cheque</option><option>Credit</option>
                                </select>
                            </div>
                        </div>

                        {/* AMC / Asset Linking (LEGACY Parity) */}
                        {['sales'].includes(type) && selectedParty?.assets?.length > 0 && (
                            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-[28px] space-y-3">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><Package size={14}/> Asset/AMC Linkage</p>
                                    <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{tx.linkedAssets.length} ACTIVE</span>
                                </div>
                                <div className="space-y-2">
                                    {tx.linkedAssets.map((asset, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-xl border border-indigo-100 flex justify-between items-center shadow-sm">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-indigo-900 truncate">{asset.name}</p>
                                                <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-slate-50">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">Service:</span>
                                                    <input type="date" className="p-1 border-none bg-indigo-50/50 rounded text-[10px] font-black text-indigo-600 outline-none" value={asset.nextServiceDate} onChange={(e) => {
                                                        const na = [...tx.linkedAssets];
                                                        na[idx].nextServiceDate = e.target.value;
                                                        setTx({ ...tx, linkedAssets: na });
                                                    }} />
                                                </div>
                                            </div>
                                            <button onClick={() => setTx({...tx, linkedAssets: tx.linkedAssets.filter((_, i) => i !== idx)})} className="p-2 text-rose-300 hover:text-rose-500"><X size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                                <select className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-[10px] font-black text-indigo-600 outline-none shadow-sm" value="" onChange={e => handleAddAsset(e.target.value)}>
                                    <option value="">+ Link Another Asset</option>
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
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShoppingBag size={16}/> Items / Breakdown</h4>
                            <button onClick={() => setTx({...tx, items: [...tx.items, { itemId: '', qty: 1, price: 0, buyPrice: 0 }]})} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all">Add Line</button>
                        </div>
                        <div className="space-y-4">
                            {tx.items.map((line, idx) => {
                                const master = data.items.find(i => i.id === line.itemId);
                                return (
                                    <div key={idx} className={`p-4 bg-white border border-slate-100 rounded-[28px] shadow-sm relative animate-in slide-in-from-bottom-2 ${line.isLinked ? 'ml-6 bg-orange-50/10 border-orange-50' : ''}`}>
                                        <button onClick={() => setTx({...tx, items: tx.items.filter((_, i) => i !== idx)})} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button>
                                        
                                        <div className="flex flex-col gap-3">
                                            {/* Primary Line: Product & Brand */}
                                            <div className="grid grid-cols-1 sm:grid-cols-[2fr,1fr] gap-2">
                                                <SearchableSelect 
                                                    options={data.items.map(i => ({ id: i.id, name: i.name, subText: `Stk: ${itemStock[i.id] || 0}` }))}
                                                    value={line.itemId}
                                                    onChange={v => updateLine(idx, 'itemId', v)}
                                                    placeholder="Product..."
                                                />
                                                {master && (
                                                    <SearchableSelect 
                                                        placeholder="Brand..."
                                                        options={master.brands?.map(b => ({ id: b.name, name: b.name })) || []}
                                                        value={line.brand || ''}
                                                        onChange={v => updateLine(idx, 'brand', v)}
                                                        onAddNew={() => setAddBrandModal({ item: master, idx })}
                                                    />
                                                )}
                                            </div>

                                            {/* Metrics Line: Qty, Buy, Sell, Warranty, Total */}
                                            <div className="grid grid-cols-5 gap-2 items-center">
                                                <div className="col-span-1">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter block mb-0.5">Qty</label>
                                                    <input type="number" className="w-full px-2 py-2.5 bg-slate-50 border border-slate-50 rounded-lg text-xs font-black outline-none" value={line.qty} onChange={e => updateLine(idx, 'qty', e.target.value)} />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-[8px] font-black text-rose-400 uppercase tracking-tighter block mb-0.5">Purch</label>
                                                    <input type="number" className="w-full px-2 py-2.5 bg-rose-50/50 border border-rose-50 rounded-lg text-xs font-black text-rose-700 outline-none" value={line.buyPrice || line.purchasePrice || 0} onChange={e => updateLine(idx, 'buyPrice', e.target.value)} />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter block mb-0.5">Price</label>
                                                    <input type="number" className="w-full px-2 py-2.5 bg-emerald-50/50 border border-emerald-50 rounded-lg text-xs font-black text-emerald-700 outline-none" value={line.price} onChange={e => updateLine(idx, 'price', e.target.value)} />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-[8px] font-black text-blue-400 uppercase tracking-tighter block mb-0.5">Warrnt</label>
                                                    <select className="w-full px-2 py-2.5 bg-blue-50/50 border border-blue-50 rounded-lg text-[9px] font-black text-blue-700 outline-none" onChange={(e) => {
                                                        const months = parseInt(e.target.value);
                                                        if(!months) return;
                                                        const d = new Date(tx.date || new Date()); 
                                                        d.setMonth(d.getMonth() + months);
                                                        updateLine(idx, 'warrantyDate', d.toISOString().split('T')[0]);
                                                    }}>
                                                        <option value="">-</option>
                                                        <option value="6">6M</option><option value="12">1Y</option><option value="24">2Y</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-1 text-right">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter block mb-0.5">Sum</label>
                                                    <p className="text-[11px] font-black text-slate-900 tracking-tighter truncate">{formatCurrency(line.qty * line.price)}</p>
                                                </div>
                                            </div>

                                            {/* Linked Proposals (Small row) */}
                                            {(line.linkedItems || []).length > 0 && (
                                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                                    {(line.linkedItems || []).map((lItem, lIdx) => (
                                                        <button key={lIdx} onClick={() => addLinkedItem(idx, lIdx)} className="flex-none px-3 py-1.5 bg-blue-900 text-white rounded-lg flex items-center gap-1.5 font-black text-[8px] uppercase tracking-widest active:scale-95 transition-all">
                                                            <Plus size={10}/> Link: {lItem.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer Adjustments */}
                <div className="pt-8 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjust (%) Or (₹)</label>
                                <div className="flex bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                    <input type="number" className="flex-1 p-4 text-sm font-black outline-none bg-transparent" value={tx.discountValue} onChange={e=>setTx({...tx, discountValue: e.target.value})} />
                                    <button onClick={()=>setTx({...tx, discountType: tx.discountType==='₹'?'%':'₹'})} className="px-5 bg-slate-900 text-white text-[10px] font-black uppercase">{tx.discountType}</button>
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
                                <h2 className="text-5xl font-black text-blue-400 tracking-tighter">{formatCurrency(totals.final)}</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Items: {tx.items.length}</p>
                                <p className="text-xs font-bold text-slate-400">Gross: {formatCurrency(totals.gross)}</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest pt-1">{type === 'purchase' ? 'Amt Paid' : 'Amt Recv'}</span>
                                <input type="number" className="w-32 bg-transparent text-right font-black text-emerald-400 text-xl outline-none" value={type === 'purchase' ? tx.paid : tx.received} onChange={e=>setTx({...tx, [type === 'purchase' ? 'paid' : 'received']: e.target.value})} />
                            </div>
                            {unpaidBills.length > 0 && (
                                <button onClick={() => setShowLinking(true)} className="w-full flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                                    <span className="flex items-center gap-2"><LinkIcon size={14}/> Link Pending Bills</span>
                                    <ChevronRight size={16}/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
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
                                            <p className="text-[10px] font-black text-indigo-900 uppercase">#{bill.id} <span className="bg-white px-1.5 py-0.5 rounded ml-1 text-slate-400 border">{bill.type}</span></p>
                                            <p className="font-black text-slate-900 mt-1">{formatCurrency(stats.pending)} <span className="text-[9px] text-slate-400 uppercase font-black ml-1">Due</span></p>
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
                                <input id="new_b_name" autoFocus className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="e.g. 10 Meter / Heavy Duty" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sale Price</label>
                                    <input id="new_b_sell" type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none" defaultValue={addBrandModal.item.sellPrice} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buy Price</label>
                                    <input id="new_b_buy" type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none" defaultValue={addBrandModal.item.buyPrice} />
                                </div>
                            </div>
                            <button 
                                onClick={async () => {
                                    const n = document.getElementById('new_b_name').value;
                                    const s = parseFloat(document.getElementById('new_b_sell').value||0);
                                    const b = parseFloat(document.getElementById('new_b_buy').value||0);
                                    if(!n) return alert("Required");
                                    
                                    const item = addBrandModal.item;
                                    const newBrands = [...(item.brands || []), { name: n, sellPrice: s, buyPrice: b }];
                                    const updatedItem = { ...item, brands: newBrands, updatedAt: new Date().toISOString() };
                                    
                                    await setDoc(doc(db, "items", item.id), updatedItem, { merge: true });
                                    setData(prev => ({ ...prev, items: prev.items.map(i => i.id === item.id ? updatedItem : i) }));
                                    updateLine(addBrandModal.idx, 'brand', n);
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
        </div>
    );
};

export default TransactionForm;
