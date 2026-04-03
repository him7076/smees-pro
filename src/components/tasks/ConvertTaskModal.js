import React, { useState } from 'react';
import { X, ArrowRight, ShoppingCart, CheckCircle2, Package, Search } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';
import { getTransactionTotals, formatCurrency } from '../../utils/helpers';

const ConvertTaskModal = ({ task, data, setData, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [received, setReceived] = useState(0);
    const [tempSelected, setTempSelected] = useState([]); 
    const [linkedAssets, setLinkedAssets] = useState([]); 
    const [nsDates, setNsDates] = useState({}); 
    const [showAssetList, setShowAssetList] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    const party = data.parties.find(p => p.id === task.partyId);
    const assets = party?.assets || [];

    const handleConfirmAssets = () => {
        setLinkedAssets(tempSelected);
        const newDates = { ...nsDates };
        tempSelected.forEach(name => {
            if (!newDates[name]) {
                const asset = assets.find(a => a.name === name);
                const interval = parseInt(asset?.serviceInterval || 3);
                const ns = new Date(date);
                ns.setMonth(ns.getMonth() + interval);
                newDates[name] = ns.toISOString().split('T')[0];
            }
        });
        setNsDates(newDates);
        setShowAssetList(false);
    };

    const handleConvert = async () => {
        setIsConverting(true);
        try {
            const newTx = {
                date: date || new Date().toISOString().split('T')[0],
                partyId: task.partyId || '',
                type: 'sales',
                items: (task.itemsUsed || []).map(item => {
                    const master = data.items.find(i => i.id === item.itemId);
                    return {
                        itemId: item.itemId || '',
                        itemName: item.name || master?.name || 'Generic Item',
                        qty: parseFloat(item.qty || 1),
                        price: parseFloat(item.price || 0),
                        buyPrice: parseFloat(item.buyPrice || item.purchasePrice || master?.buyPrice || 0),
                        brand: item.brand || '',
                        description: item.description || ''
                    };
                }),
                received: parseFloat(received || 0),
                paid: 0,
                discountValue: 0,
                discountType: '₹',
                notes: `Converted from Task #${task.id || 'N/A'}: ${task.name || 'N/A'}`,
                convertedFromTask: task.id || '',
                linkedAssets: (linkedAssets || []).map(name => ({ name, nextServiceDate: nsDates[name] || '' })),
                paymentMode: 'Cash',
                status: 'Unpaid'
            };

            const totals = getTransactionTotals(newTx);
            newTx.finalTotal = totals.final;
            newTx.grossTotal = totals.gross;
            newTx.status = totals.status;

            const txId = await saveRecord('transactions', newTx, 'sales');

            const updatedTask = { ...task, status: 'Converted', generatedSaleId: txId, convertedDate: new Date().toISOString() };
            await saveRecord('tasks', updatedTask, 'task');

            if (linkedAssets.length > 0 && party) {
                const updatedAssets = assets.map(a => {
                    if (linkedAssets.includes(a.name)) {
                        return { ...a, lastServiceDate: date, nextServiceDate: nsDates[a.name] || '' };
                    }
                    return a;
                });
                await saveRecord('parties', { ...party, assets: updatedAssets }, 'party');
            }

            onClose();
            alert(`Task converted to SALE #${txId}`);
        } catch (error) {
            console.error("Conversion failed", error);
            alert("Error: " + error.message);
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-sm max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Fixed Header */}
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200"><ShoppingCart size={20}/></div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Convert to Sale</h3>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Commercial finalizing</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"><X size={18}/></button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                    {/* Date & Received Amount */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Invoice Date</label>
                            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/10"/>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Received Amt</label>
                            <input type="number" value={received} onChange={e=>setReceived(e.target.value)} placeholder="0.00" className="w-full p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-[11px] font-black text-emerald-600 outline-none placeholder:text-emerald-200"/>
                        </div>
                    </div>

                    {/* Asset Linking Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-end px-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Linked Assets</label>
                            <button onClick={() => { setTempSelected(linkedAssets); setShowAssetList(true); }} className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-lg active:scale-95 transition-all">+ Link Asset</button>
                        </div>

                        {linkedAssets.length > 0 ? (
                            <div className="space-y-2">
                                {linkedAssets.map(assetName => (
                                    <div key={assetName} className="p-4 bg-slate-50 border border-slate-100 rounded-[24px] space-y-2 animate-in slide-in-from-top-2">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{assetName}</span>
                                            </div>
                                            <button onClick={() => setLinkedAssets(prev => prev.filter(a => a !== assetName))} className="p-1 hover:bg-white rounded-lg text-slate-300 hover:text-rose-500 transition-colors"><X size={14}/></button>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Next Service Projection</p>
                                            <input 
                                                type="date" 
                                                value={nsDates[assetName] || ''} 
                                                onChange={e => setNsDates(prev => ({ ...prev, [assetName]: e.target.value }))}
                                                className="w-full p-3 bg-white border border-slate-100 rounded-xl text-[10px] font-bold outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500/10"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 border-2 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center text-center">
                                <Package size={24} className="text-slate-100 mb-2" />
                                <p className="text-[9px] font-black text-slate-300 uppercase leading-relaxed tracking-widest italic">No assets linked to this sale</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-900 p-6 rounded-[32px] shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-bl-full -z-0"></div>
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Commercial Total</p>
                                <h4 className="text-xl font-black text-white tracking-tighter">{formatCurrency(getTransactionTotals({ items: task.itemsUsed || [] }).final)}</h4>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Net Balance</p>
                                <h4 className="text-xs font-black text-white opacity-60 italic">{formatCurrency(getTransactionTotals({ items: task.itemsUsed || [] }).final - (parseFloat(received || 0)))}</h4>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fixed Footer */}
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 space-y-4">
                    <button 
                        onClick={handleConvert}
                        disabled={isConverting}
                        className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isConverting ? (
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                FINALIZE & PRINT
                                <ArrowRight size={18}/>
                            </>
                        )}
                    </button>
                    <p className="text-[8px] text-slate-400 text-center font-black px-4 leading-relaxed uppercase tracking-tighter">
                        Converted sales are automatically pushed to the ledger and cannot be reverted to maintain audit consistency.
                    </p>
                </div>
            </div>

            {/* Asset Selection Overlay Modal */}
            {showAssetList && (
                <div className="fixed inset-0 z-[210] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 h-[70vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Select Assets</h3>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Multiple selection enabled</p>
                            </div>
                            <button onClick={() => setShowAssetList(false)} className="p-2 bg-slate-100 rounded-lg text-slate-400"><X size={18}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {assets.map((a, i) => {
                                const isSelected = tempSelected.includes(a.name);
                                return (
                                    <button 
                                        key={i} 
                                        onClick={() => setTempSelected(prev => isSelected ? prev.filter(x => x !== a.name) : [...prev, a.name])}
                                        className={`w-full p-4 rounded-2xl border flex justify-between items-center transition-all ${
                                            isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-100 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="text-left">
                                            <p className={`text-xs font-black ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{a.name}</p>
                                            <p className="text-[9px] text-slate-400 font-bold mt-0.5">{a.brand} • {a.model || 'No Model'}</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                            isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'
                                        }`}>
                                            {isSelected && <CheckCircle2 size={12} className="text-white"/>}
                                        </div>
                                    </button>
                                );
                            })}
                            {assets.length === 0 && <p className="text-center py-10 text-slate-300 text-[10px] font-black uppercase italic tracking-widest">No assets defined for this client</p>}
                        </div>
                        <div className="p-6 border-t bg-slate-50">
                            <button 
                                onClick={handleConfirmAssets}
                                className="w-full bg-blue-600 text-white py-4 rounded-[24px] font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                            >
                                OK, SELECT {tempSelected.length} ASSETS
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConvertTaskModal;
