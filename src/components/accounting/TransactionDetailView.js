import React from 'react';
import { ArrowLeft, Share2, MapPin, Package, ChevronRight, Link as LinkIcon, Banknote, Landmark, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';

const TransactionDetailView = ({ tx, data, user, onBack, setViewDetail, setModal, cancelTransaction, restoreTransaction, deleteRecord, checkPermission }) => {
    if (!tx) return null;

    const party = data.parties.find(p => p.id && (p.id.toString() === tx.partyId?.toString()));
    const isPayment = tx.type === 'payment';

    const totals = {
        gross: parseFloat(tx.grossTotal || tx.amount || 0),
        discount: parseFloat(tx.discountValue || 0),
        final: parseFloat(tx.finalTotal || tx.amount || 0),
        received: parseFloat(tx.received || tx.paid || (tx.type === 'payment' ? tx.amount : 0) || 0)
    };

    const shareInvoice = () => {
        const win = window.open('', '_blank');
        
        const html = `
            <html>
            <head>
                <title>INVOICE ${tx.id}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
                    body { font-family: 'Outfit', sans-serif; padding: 50px; color: #0f172a; max-width: 900px; margin: auto; background: #fff; }
                    .header { display: flex; justify-content: space-between; border-bottom: 5px solid #0f172a; padding-bottom: 30px; margin-bottom: 40px; align-items: flex-end; }
                    .brand { font-size: 38px; font-weight: 900; letter-spacing: -2px; text-transform: uppercase; color: #0f172a; }
                    .brand span { color: #2563eb; }
                    .invoice-meta { text-align: right; }
                    .invoice-meta h1 { margin: 0; font-size: 52px; font-weight: 900; color: #f1f5f9; text-transform: uppercase; letter-spacing: -2px; line-height: 0.8; margin-bottom: 15px; }
                    .invoice-meta p { margin: 0; font-weight: 900; font-size: 14px; letter-spacing: 1px; color: #64748b; }
                    .section { margin-bottom: 40px; display: grid; grid-template-cols: 1fr 1fr; gap: 40px; }
                    .info-box { background: #f8fafc; padding: 25px; border-radius: 20px; border: 1px solid #f1f5f9; }
                    .info-box h3 { font-size: 11px; font-weight: 900; color: #2563eb; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 2px; }
                    .info-box p { margin: 4px 0; font-weight: 700; font-size: 16px; color: #1e293b; }
                    .info-box .sub { font-size: 12px; font-weight: 500; color: #64748b; line-height: 1.5; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { text-align: left; padding: 18px; font-size: 11px; font-weight: 900; text-transform: uppercase; background: #0f172a; color: #fff; letter-spacing: 1px; }
                    td { padding: 18px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 600; color: #334155; }
                    .totals-container { margin-top: 40px; display: flex; justify-content: flex-end; }
                    .totals { width: 320px; padding: 25px; background: #f8fafc; border-radius: 24px; }
                    .total-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 15px; font-weight: 700; color: #64748b; }
                    .total-row.grand-total { border-top: 2px dashed #e2e8f0; margin-top: 15px; padding-top: 20px; font-size: 24px; font-weight: 900; color: #0f172a; }
                    .payment-status { margin-top: 20px; text-align: center; padding: 15px; border-radius: 12px; font-weight: 900; text-transform: uppercase; font-size: 12px; letter-spacing: 2px; }
                    .status-paid { background: #dcfce7; color: #166534; }
                    .status-pending { background: #fef9c3; color: #854d0e; }
                    .footer { margin-top: 80px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 30px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; }
                    @media print { body { padding: 0; } .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="brand">SMEES<span>PRO</span></div>
                    <div class="invoice-meta">
                        <h1>${tx.type}</h1>
                        <p>REF NO: ${tx.id} | DATE: ${tx.date}</p>
                    </div>
                </div>

                <div class="section">
                    <div class="info-box">
                        <h3>Voucher Counterparty</h3>
                        <p>${party?.name || tx.category || 'CASH TRANSACTION'}</p>
                        <p>${tx.mobile || party?.mobile || 'N/A'}</p>
                        <div class="sub">${tx.address || party?.address || 'Direct Processing'}</div>
                    </div>
                    <div class="info-box">
                        <h3>Settlement Matrix</h3>
                        <p>${tx.paymentMode || 'Standard'} Processing</p>
                        <p>${tx.status || 'Verified'}</p>
                        <div class="sub">Authenticated via Digital Ledger System</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Description / Operations</th>
                            <th style="text-align:center">Qty</th>
                            <th style="text-align:right">Unit Rate</th>
                            <th style="text-align:right">Line Sum</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(tx.items || [{ itemName: tx.category || 'Service Settlement', qty: 1, price: tx.amount }]).map(i => `
                            <tr>
                                <td>${i.itemName} ${i.brand ? `<br><small style="color:#64748b; font-size:10px">${i.brand}</small>` : ''}</td>
                                <td style="text-align:center">${i.qty}</td>
                                <td style="text-align:right">${(parseFloat(i.price || 0)).toLocaleString('en-IN')}</td>
                                <td style="text-align:right">${(parseFloat(i.qty || 1) * parseFloat(i.price || 0)).toLocaleString('en-IN')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="totals-container">
                    <div class="totals">
                        <div class="total-row"><span>Gross Sum</span> <span>${(parseFloat(tx.grossTotal || tx.amount || 0)).toLocaleString('en-IN')}</span></div>
                        ${tx.discountValue > 0 ? `<div class="total-row"><span>Commercial Disc.</span> <span style="color:#e11d48">-${(parseFloat(tx.discountValue)).toLocaleString('en-IN')}</span></div>` : ''}
                        ${tx.roundOff != 0 ? `<div class="total-row"><span>Internal Rounding</span> <span style="color:#64748b">${tx.roundOff}</span></div>` : ''}
                        <div class="total-row grand-total"><span>Total</span> <span>₹${(parseFloat(tx.finalTotal || tx.amount || 0)).toLocaleString('en-IN')}</span></div>
                        
                        <div class="payment-status ${totals.received >= totals.final ? 'status-paid' : 'status-pending'}">
                            ${totals.received >= totals.final ? `Total Settlement Received` : `Pending Balance: ${(totals.final - totals.received).toLocaleString('en-IN')}`}
                        </div>
                    </div>
                </div>

                <div class="footer">
                    SMEES ENGINE - COMPUTER GENERATED COMMERCIAL VOUCHER - DO NOT SIGN
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `;

        win.document.write(html);
        win.document.close();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* STICKY ACTION BAR */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 flex items-center justify-between shadow-sm z-[110]">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 active:scale-95 transition-all"><ArrowLeft size={20}/></button>
                    <div>
                        <h2 className="font-black text-slate-900 tracking-tight leading-none text-sm uppercase">Voucher Intelligence</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Ref ID: {tx.id}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {tx.status !== 'Cancelled' && (
                        <button onClick={shareInvoice} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                            <Share2 size={16}/> Share Premium PDF
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
                                <button onClick={() => setModal({ type: tx.type, data: tx })} className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all"><LinkIcon size={20}/></button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className={`p-6 max-w-2xl mx-auto space-y-6 pb-32 ${tx.status === 'Cancelled' ? 'opacity-60 grayscale' : ''}`}>
                {/* Header Card */}
                <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm text-center relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-full h-2 ${['sales','payment'].includes(tx.type) ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    <div className="flex justify-center mb-6">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                            tx.status === 'Cancelled' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-50 shadow-lg'
                        }`}>
                            {tx.status || 'Active Asset'}
                        </span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Voucher Valuation</p>
                    <h1 className="text-6xl font-black text-slate-900 tracking-tighter mb-4">{formatCurrency(totals.final)}</h1>
                    <div className="flex justify-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <span className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">{formatDate(tx.date)}</span>
                        <span className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">{tx.paymentMode || 'Standard'}</span>
                    </div>
                </div>

                {/* Settlement Card */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 space-y-1 text-center">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Digital Settlement</p>
                        <p className="text-xl font-black text-emerald-900">{formatCurrency(totals.received)}</p>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-[32px] space-y-1 text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Voucher Balance</p>
                        <p className={`text-xl font-black ${totals.final - totals.received > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {formatCurrency(Math.max(0, totals.final - totals.received))}
                        </p>
                    </div>
                </div>

                {/* Party Details */}
                <div onClick={() => { if(user.role === 'admin' && tx.partyId) setViewDetail({ type: 'party', id: tx.partyId }); }} className={`p-8 bg-white rounded-[40px] border border-slate-100 shadow-sm transition-all relative overflow-hidden ${user.role === 'admin' ? 'cursor-pointer hover:shadow-xl active:scale-[0.98]' : ''}`}>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{isPayment ? 'Linked Account Vector' : 'Counterparty Intel'}</p>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{party?.name || tx.category || 'Direct Cash Client'}</h3>
                        </div>
                        {user.role === 'admin' && <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm"><ChevronRight size={24}/></div>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl">
                            <Banknote className="text-slate-400" size={18}/>
                            <p className="text-sm font-black text-slate-700">{tx.mobile || party?.mobile || 'No Contact Defined'}</p>
                        </div>
                        {tx.address && (
                            <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl">
                                <MapPin className="text-slate-400 mt-0.5" size={18}/>
                                <p className="text-[10px] font-bold text-slate-500 leading-relaxed truncate">{tx.address}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Breakdown Items */}
                {tx.items && tx.items.length > 0 && (
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8 space-y-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 font-black leading-none"><Package size={14}/> Operational Breakdown</h4>
                        <div className="space-y-4">
                            {tx.items.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-5 bg-slate-50 rounded-[28px] border border-slate-50 hover:bg-white hover:border-slate-100 transition-all">
                                    <div className="flex-1 pr-4">
                                        <p className="text-sm font-black text-slate-800 tracking-tight mb-1">{item.itemName}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            {item.qty} Qty × {formatCurrency(item.price)}
                                            {item.brand && <span className="text-blue-500 ml-2 border-l border-slate-200 pl-2">VARIANT: {item.brand}</span>}
                                        </p>
                                    </div>
                                    <p className="text-sm font-black text-slate-900">{formatCurrency(item.qty * item.price)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Memo */}
                {tx.notes && (
                    <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-100">
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2">Operational Memorandum</p>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed italic">"{tx.notes}"</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransactionDetailView;
