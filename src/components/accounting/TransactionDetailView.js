import React from 'react';
import { ArrowLeft, Share2, MapPin, Package, ChevronRight, Link as LinkIcon, Banknote, Landmark } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';

const TransactionDetailView = ({ tx, data, user, onBack, setViewDetail, setModal, cancelTransaction, restoreTransaction, checkPermission }) => {
    if (!tx) return null;

    const party = data.parties.find(p => p.id === tx.partyId);
    const isPayment = tx.type === 'payment';

    const totals = {
        gross: tx.grossTotal || tx.amount || 0,
        discount: tx.discountValue || 0,
        final: tx.finalTotal || tx.amount || 0,
        received: tx.received || tx.paid || (tx.type === 'payment' ? tx.amount : 0)
    };

    const relatedDocs = []; // Logic to find related docs would go here if needed

    const shareInvoice = () => {
        // Implementation for printing/PDF generation
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                <button onClick={onBack} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                <div className="flex gap-2">
                    {tx.status !== 'Cancelled' && (
                        <button onClick={shareInvoice} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-200">
                            <Share2 size={16}/> SHARE PDF
                        </button>
                    )}
                    {checkPermission(user, 'canEditTasks') && (
                        <div className="flex gap-2">
                            {tx.status !== 'Cancelled' ? (
                                <button onClick={() => cancelTransaction(tx.id)} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 font-bold text-xs hover:bg-rose-100">Cancel</button>
                            ) : (
                                <button onClick={() => restoreTransaction(tx.id)} className="px-4 py-2 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-100">Restore</button>
                            )}
                            {tx.status !== 'Cancelled' && (
                                <button onClick={() => setModal({ type: tx.type, data: tx })} className="px-6 py-2 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl">Edit</button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className={`p-6 max-w-2xl mx-auto space-y-6 ${tx.status === 'Cancelled' ? 'opacity-60 grayscale' : ''}`}>
                <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 text-center relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-full h-1.5 ${['sales','payment'].includes(tx.type) ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{tx.type} VOUCHER</p>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(totals.final)}</h1>
                    <div className="flex justify-center gap-3 mt-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <span className="bg-white px-3 py-1.5 rounded-full border border-slate-200">#{tx.id}</span>
                        <span className="bg-white px-3 py-1.5 rounded-full border border-slate-200">{formatDate(tx.date)}</span>
                    </div>
                </div>

                {tx.description && (
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-center">
                        <p className="text-[10px] text-amber-700 font-black uppercase tracking-widest mb-1">Memo</p>
                        <p className="text-sm font-medium text-slate-700">{tx.description}</p>
                    </div>
                )}

                <div className="flex justify-center items-center gap-3 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">{tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in') ? 'Received' : 'Paid'}:</span>
                    <span className="text-xl font-black text-emerald-800">{formatCurrency(totals.received)}</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-black bg-white px-3 py-1.5 rounded-full text-slate-600 border border-emerald-100 shadow-sm uppercase tracking-widest">
                        {tx.paymentMode === 'Bank' ? <Landmark size={12}/> : <Banknote size={12}/>} {tx.paymentMode || 'Cash'}
                    </span>
                </div>

                <div onClick={() => { if(user.role === 'admin' && tx.partyId) setViewDetail({ type: 'party', id: tx.partyId }); }} className={`p-6 rounded-[24px] border border-slate-100 shadow-sm transition-all ${user.role === 'admin' ? 'cursor-pointer hover:bg-slate-50 hover:shadow-md active:scale-[0.98]' : 'bg-white'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isPayment ? 'Linked Account' : 'Counterparty'}</p>
                        {user.role === 'admin' && <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">View Profile ↗</span>}
                    </div>
                    <p className="text-lg font-black text-slate-800 tracking-tight">{party?.name || tx.category || 'Unknown'}</p>
                    <p className="text-sm font-bold text-slate-500">{tx.mobile || party?.mobile || 'No contact info'}</p>
                    {tx.address && (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-3">
                            <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5"/>
                            <p className="text-xs font-bold text-slate-600 leading-relaxed">{tx.address}</p>
                        </div>
                    )}
                </div>

                {tx.items && tx.items.length > 0 && (
                    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Line Items</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {tx.items.map((item, i) => (
                                <div key={i} className="p-4 flex justify-between items-center">
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{item.itemName}</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">{item.qty} {item.unit} × {formatCurrency(item.price)}</p>
                                    </div>
                                    <p className="font-black text-slate-800">{formatCurrency(item.qty * item.price)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tx.convertedFromTask && (
                    <div className="p-6 bg-purple-50 rounded-[24px] border border-purple-100 flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Source Activity</p>
                            <p className="text-sm font-black text-purple-900 tracking-tight">Task #{tx.convertedFromTask}</p>
                        </div>
                        <button onClick={() => setViewDetail({ type: 'task', id: tx.convertedFromTask })} className="p-3 bg-purple-600 text-white rounded-xl shadow-lg shadow-purple-200 hover:scale-105 active:scale-95 transition-all">
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransactionDetailView;
