import React, { useState } from 'react';
import { X, ArrowRight, ShoppingCart, FileText, CheckCircle2, Package, User } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';
import { getTransactionTotals, formatCurrency } from '../../utils/helpers';

const ConvertTaskModal = ({ task, data, setData, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [type, setType] = useState('sales'); 
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedAssets, setSelectedAssets] = useState([]); 
    const [nsDates, setNsDates] = useState({}); 
    const [isConverting, setIsConverting] = useState(false);

    const party = data.parties.find(p => p.id === task.partyId);
    const assets = party?.assets || [];

    const toggleAsset = (asset) => {
        const isSelected = selectedAssets.includes(asset.name);
        if (isSelected) {
            setSelectedAssets(prev => prev.filter(a => a !== asset.name));
            const newDates = { ...nsDates };
            delete newDates[asset.name];
            setNsDates(newDates);
        } else {
            setSelectedAssets(prev => [...prev, asset.name]);
            if (asset.serviceInterval) {
                const ns = new Date(date);
                ns.setDate(ns.getDate() + parseInt(asset.serviceInterval));
                setNsDates(prev => ({ ...prev, [asset.name]: ns.toISOString().split('T')[0] }));
            }
        }
    };

    const handleConvert = async () => {
        setIsConverting(true);
        try {
            const newTx = {
                date: date,
                partyId: task.partyId,
                type: type,
                items: (task.itemsUsed || []).map(item => ({
                    itemId: item.itemId,
                    itemName: item.name,
                    qty: item.qty || 1,
                    price: item.price || 0,
                    buyPrice: item.buyPrice || 0
                })),
                received: 0,
                paid: 0,
                discountValue: 0,
                discountType: '₹',
                notes: `Converted from Task #${task.id}: ${task.name}`,
                convertedFromTask: task.id,
                linkedAssetStr: selectedAsset,
                paymentMode: 'Cash',
                status: 'Unpaid'
            };

            const totals = getTransactionTotals(newTx);
            newTx.finalTotal = totals.final;
            newTx.grossTotal = totals.gross;

            const txId = await saveRecord('transactions', newTx, type);

            const updatedTask = { ...task, status: 'Converted', generatedSaleId: txId, convertedDate: new Date().toISOString() };
            await saveRecord('tasks', updatedTask, 'task');

            if (selectedAssets.length > 0 && party) {
                const updatedAssets = assets.map(a => {
                    if (selectedAssets.includes(a.name)) {
                        return { ...a, lastServiceDate: date, nextServiceDate: nsDates[a.name] || '' };
                    }
                    return a;
                });
                await saveRecord('parties', { ...party, assets: updatedAssets }, 'party');
            }

            onClose();
            alert(`Task converted to ${type.toUpperCase()} #${txId}`);
        } catch (error) {
            console.error("Conversion failed", error);
            alert("Error: " + error.message);
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="p-8 space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl shadow-sm"><ShoppingCart size={24}/></div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Generate Invoice</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Commercial Conversion</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"><X size={20}/></button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Invoice Date</label>
                                <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"/>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Voucher Type</label>
                                <select value={type} onChange={e=>setType(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none">
                                    <option value="sales">Tax Invoice</option>
                                    <option value="estimate">Estimate</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Link Customer Assets ({selectedAssets.length})</label>
                            <div className="flex flex-wrap gap-2">
                                {assets.map((a, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => toggleAsset(a)}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                                            selectedAssets.includes(a.name) ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                    >
                                        {a.name}
                                    </button>
                                ))}
                                {assets.length === 0 && <p className="text-[10px] font-black text-slate-300 uppercase py-2 italic tracking-widest">No assets registered</p>}
                            </div>
                        </div>

                        {selectedAssets.map(assetName => (
                            <div key={assetName} className="p-4 bg-blue-50/50 border border-blue-100/10 rounded-[28px] space-y-2 animate-in slide-in-from-top-2">
                                <div className="flex justify-between items-center text-[9px] font-black text-blue-600 uppercase tracking-widest">
                                    <span>Next Service: {assetName}</span>
                                    {assets.find(a=>a.name === assetName)?.serviceInterval && <span className="text-blue-400 italic">+{assets.find(a=>a.name === assetName).serviceInterval}d</span>}
                                </div>
                                <input 
                                    type="date" 
                                    value={nsDates[assetName] || ''} 
                                    onChange={e => setNsDates(prev => ({ ...prev, [assetName]: e.target.value }))}
                                    className="w-full p-3.5 bg-white border border-blue-100 rounded-2xl text-xs font-bold outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100">
                        <div className="flex justify-between items-center text-blue-900 font-black tracking-tight">
                            <span className="text-xs uppercase tracking-widest opacity-60">Total Billable</span>
                            <span className="text-xl">{formatCurrency(getTransactionTotals({ items: task.itemsUsed || [] }).final)}</span>
                        </div>
                    </div>

                    <button 
                        onClick={handleConvert}
                        disabled={isConverting}
                        className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                    >
                        {isConverting ? (
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                FINALIZE & PRINT
                                <ArrowRight size={20}/>
                            </>
                        )}
                    </button>
                    
                    <p className="text-[9px] text-slate-400 text-center font-bold px-4 leading-relaxed uppercase tracking-tighter">
                        This action will mark Task <span className="text-slate-900">#{task.id}</span> as converted and lock it from further edits to maintain audit integrity.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ConvertTaskModal;
