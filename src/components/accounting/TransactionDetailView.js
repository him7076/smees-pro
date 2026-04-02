import React from 'react';
import { ArrowLeft, Share2, MapPin, Package, ChevronRight, Link as LinkIcon, Banknote, Landmark, Trash2, Edit2, Layout } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';

const TransactionDetailView = ({ tx, data, user, onBack, setViewDetail, setModal, cancelTransaction, restoreTransaction, deleteRecord, checkPermission }) => {
    const party = React.useMemo(() => tx ? data.parties.find(p => p.id && (p.id.toString() === tx.partyId?.toString())) : null, [tx, data.parties]);
    const isPayment = tx?.type === 'payment';

    const linkedPaid = React.useMemo(() => {
        if (!tx || isPayment) return 0;
        return data.transactions
            .filter(t => t.status !== 'Cancelled' && t.type === 'payment' && t.linkedBills)
            .reduce((sum, t) => {
                const link = t.linkedBills.find(l => l.billId?.toString() === tx.id?.toString());
                return sum + (link ? parseFloat(link.amount || 0) : 0);
            }, 0);
    }, [tx, data.transactions, isPayment]);

    const totals = {
        gross: parseFloat(tx?.grossTotal || tx?.amount || 0),
        discount: parseFloat(tx?.discountValue || 0),
        final: parseFloat(tx?.finalTotal || tx?.amount || 0),
        received: parseFloat(tx?.received || tx?.paid || (tx?.type === 'payment' ? tx?.amount : 0) || 0) + linkedPaid
    };

    // Enhanced Profit Calculation Logic for Breakdown
    const profitData = React.useMemo(() => {
        if (!tx) return { itemBreakdown: [], totalMaterialProfit:0, totalServiceProfit:0, grossProfit:0 };
        let totalMaterialProfit = 0;
        let totalServiceProfit = 0;
        
        const itemBreakdown = (tx.items || []).map(item => {
            const master = (data.items || []).find(mi => mi.id === item.itemId);
            const itemName = item.itemName || master?.name || 'Unknown Item';
            const type = master?.type || 'Goods';
            const buy = parseFloat(item.buyPrice || item.purchasePrice || master?.buyPrice || 0);
            const sell = parseFloat(item.price || 0);
            const qty = parseFloat(item.qty || 1);
            const profitValue = (sell - buy) * qty;

            const isService = type === 'Service' || itemName.toLowerCase().includes('service');
            
            if (isService) totalServiceProfit += profitValue;
            else totalMaterialProfit += profitValue;

            return {
                ...item,
                itemName,
                materialProfit: isService ? 0 : profitValue,
                serviceProfit: isService ? profitValue : 0,
                type: isService ? 'Service' : 'Material'
            };
        });

        // Adjusted Gross Profit (Accounting for Invoice Discount)
        const grossProfit = totalMaterialProfit + totalServiceProfit - totals.discount;

        return { itemBreakdown, totalMaterialProfit, totalServiceProfit, grossProfit };
    }, [tx?.items, data.items, totals.discount]);

    const shareInvoice = () => {
        const win = window.open('', '_blank');
        const company = data.company || {};
        
        const html = `
            <html>
            <head>
                <title>INVOICE ${tx.id}</title>
                <style>
                    body { font-family: sans-serif; padding: 30px; color: #333; max-width: 800px; margin: auto; line-height: 1.4; }
                    .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; }
                    .company-info h2 { margin: 0; font-size: 24px; text-transform: uppercase; }
                    .company-info p { margin: 2px 0; font-size: 12px; color: #666; }
                    .invoice-meta { text-align: right; }
                    .invoice-meta h1 { margin: 0; font-size: 28px; color: #000; text-transform: uppercase; }
                    .invoice-meta p { margin: 2px 0; font-size: 12px; font-weight: bold; }
                    .details { display: flex; justify-content: space-between; margin-bottom: 30px; }
                    .address-box { flex: 1; }
                    .address-box h3 { font-size: 10px; color: #999; text-transform: uppercase; margin-bottom: 5px; }
                    .address-box p { margin: 0; font-weight: bold; font-size: 14px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { text-align: left; padding: 12px; font-size: 11px; background: #f4f4f4; border-bottom: 2px solid #ddd; text-transform: uppercase; }
                    td { padding: 12px; border-bottom: 1px solid #eee; font-size: 13px; }
                    .totals-area { margin-top: 30px; display: flex; justify-content: flex-end; }
                    .totals-table { width: 250px; }
                    .totals-table div { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
                    .grand { border-top: 1px solid #333; margin-top: 5px; padding-top: 10px !important; font-weight: bold; font-size: 18px !important; }
                    .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-info">
                        <h2>${company.name || 'SMEES ENTERPRISE'}</h2>
                        <p>${company.address || ''}</p>
                        <p>Mobile: ${company.mobile || ''}</p>
                    </div>
                    <div class="invoice-meta">
                        <h1>${tx.type.toUpperCase()}</h1>
                        <p>No: ${tx.id}</p>
                        <p>Date: ${tx.date}</p>
                    </div>
                </div>

                <div class="details">
                    <div class="address-box">
                        <h3>Customer</h3>
                        <p>${party?.name || tx.category || 'Cash Client'}</p>
                        <p>${tx.mobile || party?.mobile || ''}</p>
                        <p style="font-weight: normal; font-size: 12px; color: #666;">${tx.address || party?.address || ''}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Item / Description</th>
                            <th style="text-align:center">Qty</th>
                            <th style="text-align:right">Price</th>
                            <th style="text-align:right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(profitData.itemBreakdown.length > 0 ? profitData.itemBreakdown : [{ itemName: tx.category || 'Direct Service', qty: 1, price: tx.amount }]).map(i => `
                            <tr>
                                <td>${i.itemName} ${i.brand ? `<br><small style="color:#888">${i.brand}</small>` : ''}</td>
                                <td style="text-align:center">${i.qty}</td>
                                <td style="text-align:right">${(parseFloat(i.price || 0)).toLocaleString('en-IN')}</td>
                                <td style="text-align:right">${(parseFloat(i.qty || 1) * parseFloat(i.price || 0)).toLocaleString('en-IN')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="totals-area">
                    <div class="totals-table">
                        <div><span>Subtotal</span> <span>${(parseFloat(tx.grossTotal || tx.amount || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                        ${tx.discountValue > 0 ? `<div><span>Discount</span> <span>- ${(parseFloat(tx.discountValue)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>` : ''}
                        <div class="grand"><span>Grand Total</span> <span>₹${(parseFloat(tx.finalTotal || tx.amount || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                    </div>
                </div>

                <div class="footer">
                    Generated by SMEES ERP Ledger System
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `;

        win.document.write(html);
        win.document.close();
    };

    if (!tx) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* STICKY ACTION BAR - COMPACT */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-sm z-[110]">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 active:scale-95 transition-all"><ArrowLeft size={16}/></button>
                    <div>
                        <h2 className="font-black text-slate-900 tracking-tight leading-none text-[8px] uppercase opacity-40">Intelligence Hub</h2>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0.5">#{tx.id}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {tx.status !== 'Cancelled' && (
                        <button onClick={shareInvoice} className="p-2 bg-blue-600 text-white rounded-xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                            <Share2 size={16}/> 
                        </button>
                    )}
                    {checkPermission(user, 'canEditTasks') && (
                        <div className="flex gap-2">
                            {tx.status !== 'Cancelled' ? (
                                <button onClick={() => cancelTransaction(tx.id)} className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 active:scale-95 transition-all"><Trash2 size={20}/></button>
                            ) : (
                                <button onClick={() => restoreTransaction(tx.id)} className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">Restore Record</button>
                            )}
                            {tx.status !== 'Cancelled' && (
                                <button onClick={() => setModal({ type: tx.type, data: tx })} className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all"><Edit2 size={20}/></button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className={`p-4 max-w-2xl mx-auto space-y-6 pb-32 ${tx.status === 'Cancelled' ? 'opacity-60 grayscale' : ''}`}>
                {/* Header Card (COMPACT VERSION) */}
                <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm text-center relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-full h-1.5 ${['sales','payment'].includes(tx.type) ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    <div className="flex justify-center mb-2">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all ${
                            tx.status === 'Cancelled' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                            {tx.status || 'Active'}
                        </span>
                    </div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Total Amount</p>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">{formatCurrency(totals.final)}</h1>
                    <div className="flex justify-center gap-2 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                        <span className="bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">{formatDate(tx.date)}</span>
                        <span className="bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">{tx.paymentMode || 'Standard'}</span>
                    </div>
                </div>

                {/* Settlement Card */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 p-4 rounded-[24px] border border-emerald-100 space-y-0.5 text-center">
                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Settled</p>
                        <p className="text-sm font-black text-emerald-900">{formatCurrency(totals.received)}</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-[24px] space-y-0.5 text-center shadow-lg">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Balance</p>
                        <p className={`text-sm font-black ${totals.final - totals.received > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {formatCurrency(Math.max(0, totals.final - totals.received))}
                        </p>
                    </div>
                </div>

                {tx.convertedFromTask && (
                    <div onClick={() => setViewDetail({ type: 'task', id: tx.convertedFromTask })} className="p-6 bg-indigo-900 text-white rounded-[32px] cursor-pointer active:scale-95 shadow-xl shadow-indigo-100 flex justify-between items-center group transition-all">
                        <div>
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Generated From Command Task</p>
                            <p className="font-black text-lg tracking-tight group-hover:text-blue-400 transition-colors">Task #{tx.convertedFromTask}</p>
                        </div>
                        <Layout className="text-indigo-400 group-hover:rotate-12 transition-transform"/>
                    </div>
                )}

                {/* Party Details (Compact) */}
                <div onClick={() => { if(user.role === 'admin' && tx.partyId) setViewDetail({ type: 'party', id: tx.partyId }); }} className={`p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm transition-all relative overflow-hidden ${user.role === 'admin' ? 'cursor-pointer hover:shadow-lg active:scale-[0.98]' : ''}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{isPayment ? 'Linked Account' : 'Party Name'}</p>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">{party?.name || tx.category || 'Direct Cash Client'}</h3>
                        </div>
                        {user.role === 'admin' && <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-sm"><ChevronRight size={18}/></div>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl">
                            <Banknote className="text-slate-400" size={14}/>
                            <p className="text-xs font-bold text-slate-700">{tx.mobile || party?.mobile || 'No Contact'}</p>
                        </div>
                        {tx.address && (
                            <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl">
                                <MapPin className="text-slate-400 mt-0.5" size={14}/>
                                <p className="text-[9px] font-bold text-slate-500 leading-tight line-clamp-2">{tx.address}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Breakdown Items (Detailed Operational Breakdown) */}
                {profitData.itemBreakdown.length > 0 && (
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 leading-none"><Package size={14}/> Operational Breakdown</h4>
                        <div className="space-y-3">
                            {profitData.itemBreakdown.map((item, i) => (
                                <div key={i} className="p-4 bg-slate-50 rounded-[24px] border border-slate-50 hover:bg-white hover:border-slate-100 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 pr-4">
                                            <p className="text-xs font-black text-slate-800 tracking-tight leading-tight">{item.itemName}</p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                {item.qty} Qty × {formatCurrency(item.price)}
                                                {item.brand && <span className="text-blue-500 ml-2 border-l border-slate-200 pl-2">VARIANT: {item.brand}</span>}
                                            </p>
                                        </div>
                                        <p className="text-xs font-black text-slate-900">{formatCurrency(item.qty * item.price)}</p>
                                    </div>
                                    
                                    {/* Profit Indicator */}
                                    {user.role === 'admin' && tx.type === 'sales' && (
                                        <div className="flex gap-2 mt-2 pt-2 border-t border-slate-200/50">
                                            <div className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${item.type === 'Service' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {item.type} {item.type === 'Service' ? formatCurrency(item.serviceProfit) : formatCurrency(item.materialProfit)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Breakdown Summary Footer (Admin Only) */}
                        {user.role === 'admin' && tx.type === 'sales' && (
                            <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                                <div className="grid grid-cols-2 gap-3 pb-4">
                                    <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50">
                                        <p className="text-[8px] font-black text-emerald-600/60 uppercase tracking-widest mb-1 text-center">Material Profit</p>
                                        <p className="text-xs font-black text-emerald-700 text-center">{formatCurrency(profitData.totalMaterialProfit)}</p>
                                    </div>
                                    <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
                                        <p className="text-[8px] font-black text-blue-600/60 uppercase tracking-widest mb-1 text-center">Service Profit</p>
                                        <p className="text-xs font-black text-blue-700 text-center">{formatCurrency(profitData.totalServiceProfit)}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl shadow-xl shadow-slate-200">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gross Yield</span>
                                        {totals.discount > 0 && <span className="text-[7px] font-black text-rose-400 uppercase tracking-widest">Incl. {formatCurrency(totals.discount)} Disc.</span>}
                                    </div>
                                    <span className="text-xl font-black text-emerald-400 tracking-tighter">{formatCurrency(profitData.grossProfit)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Linked Records Section */}
                {(() => {
                    const linkedRecords = isPayment 
                        ? (tx.linkedBills || []).map(link => ({
                            id: link.billId,
                            amount: link.amount,
                            data: data.transactions.find(t => t.id === link.billId)
                        }))
                        : data.transactions
                            .filter(t => t.status !== 'Cancelled' && t.type === 'payment')
                            .map(p => {
                                const link = p.linkedBills?.find(l => l.billId === tx.id);
                                return link ? { id: p.id, amount: link.amount, data: p } : null;
                            })
                            .filter(Boolean);

                    if (linkedRecords.length === 0) return null;

                    return (
                        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 space-y-4">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 leading-none"><LinkIcon size={14}/> Associated Ledger Records</h4>
                            <div className="space-y-2">
                                {linkedRecords.map((rec, i) => (
                                    <div key={i} onClick={() => setViewDetail({ type: 'transaction', id: rec.id })} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                                                {rec.data?.type === 'payment' ? <Banknote size={14}/> : <Package size={14}/>}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                                                    {rec.data?.type || 'Record'} #{rec.id}
                                                </p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{rec.data?.date}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-slate-900">{formatCurrency(rec.amount)}</p>
                                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Linked Value</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* Memo */}
                {tx.notes && (
                    <div className="bg-amber-50 p-4 rounded-[24px] border border-amber-100">
                        <p className="text-[8px] font-black text-amber-700 uppercase tracking-widest mb-1 flex items-center gap-2">Memorandum</p>
                        <p className="text-xs font-medium text-slate-700 leading-relaxed italic">"{tx.notes}"</p>
                    </div>
                )}
            </div>
        </div>
    );
};


export default TransactionDetailView;
