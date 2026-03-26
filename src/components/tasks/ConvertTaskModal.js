import React, { useState } from 'react';
import { X, ArrowRight, ShoppingCart, FileText, CheckCircle2, Package, User } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';
import { getTransactionTotals } from '../../utils/helpers';

const ConvertTaskModal = ({ task, data, setData, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [type, setType] = useState('sales'); // 'sales' or 'estimate'
    const [isConverting, setIsConverting] = useState(false);

    const party = data.parties.find(p => p.id === task.partyId);

    const handleConvert = async () => {
        setIsConverting(true);
        try {
            // 1. Prepare Transaction Data from Task
            const newTx = {
                date: new Date().toISOString().split('T')[0],
                partyId: task.partyId,
                type: type, // 'sales' or 'estimate'
                items: (task.itemsUsed || []).map(item => ({
                    itemId: item.itemId,
                    name: item.name,
                    qty: item.qty || 1,
                    price: item.price || 0,
                    brand: item.brand || '',
                    buyPrice: item.buyPrice || 0
                })),
                received: 0,
                paid: 0,
                discountValue: 0,
                discountType: '₹',
                roundOff: 0,
                notes: `Converted from Task #${task.id}: ${task.name}`,
                convertedFromTask: task.id,
                linkedAssetStr: task.linkedAssetStr || '',
                paymentMode: 'Cash',
                status: 'Unpaid'
            };

            // Calculate totals
            const totals = getTransactionTotals(newTx);
            newTx.finalTotal = totals.final;
            newTx.grossTotal = totals.gross;

            // 2. Save New Transaction
            const txId = await saveRecord('transactions', newTx, type);

            // 3. Update Task Status
            const updatedTask = { 
                ...task, 
                status: 'Converted', 
                generatedSaleId: txId,
                convertedDate: new Date().toISOString() 
            };
            await saveRecord('tasks', updatedTask, 'task');

            onClose();
            alert(`Task converted to ${type.toUpperCase()} #${txId}`);
        } catch (error) {
            console.error("Conversion failed", error);
            alert("Error converting task. Please try again.");
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
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Convert to Bill</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Finalizing Workflow</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"><X size={20}/></button>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-4">
                        <div className="flex items-center gap-3">
                            <User size={16} className="text-slate-400"/>
                            <span className="text-sm font-black text-slate-700 uppercase tracking-tight">{party?.name || 'Walk-in Client'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Package size={16} className="text-slate-400"/>
                            <span className="text-xs font-bold text-slate-500 italic">"{task.name}"</span>
                        </div>
                        <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Billable Items</span>
                            <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-black">{task.itemsUsed?.length || 0} Entries</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center">Select Voucher Type</p>
                        <div className="flex bg-slate-100 p-1.5 rounded-3xl">
                            <button 
                                onClick={() => setType('sales')} 
                                className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1.5 transition-all ${type === 'sales' ? 'bg-white text-blue-600 shadow-xl scale-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <ShoppingCart size={20}/>
                                <span className="text-[10px] font-black uppercase tracking-widest">Tax Invoice</span>
                            </button>
                            <button 
                                onClick={() => setType('estimate')} 
                                className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1.5 transition-all ${type === 'estimate' ? 'bg-white text-amber-600 shadow-xl scale-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <FileText size={20}/>
                                <span className="text-[10px] font-black uppercase tracking-widest">Estimate / Qtn</span>
                            </button>
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
                                Generate {type.toUpperCase()}
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
