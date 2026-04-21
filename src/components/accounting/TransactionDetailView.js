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

    // Enhanced Profit Calculation Logic for Breakdown (Recursive for Bundles)
    const profitData = React.useMemo(() => {
        if (!tx) return { itemBreakdown: [], totalMaterialProfit:0, totalServiceProfit:0, grossProfit:0 };
        let totalMaterialProfit = 0;
        let totalServiceProfit = 0;
        
        const itemBreakdown = (tx.items || []).map(item => {
            const master = (data.items || []).find(mi => mi.id === item.itemId) || (data.bundles || []).find(bi => bi.id === item.itemId);
            let itemName = item.itemName || item.name || master?.name || 'Unknown Item';
            if (itemName === 'Product' && master?.name) itemName = master.name;
            const type = master?.type || 'Goods';
            const sell = parseFloat(item.price || 0);
            const qty = parseFloat(item.qty || 1);

            // Calculate Item-Specific Discount
            let itemLineDiscount = parseFloat(item.discountValue || 0);
            if (item.discountType === '%') itemLineDiscount = (sell * qty * itemLineDiscount) / 100;

            let itemMaterialProfit = 0;
            let itemServiceProfit = 0;

            if (item.isBundle && item.subItems?.length > 0) {
                item.subItems.forEach(sub => {
                    const subMaster = (data.items || []).find(mi => mi.id === sub.itemId);
                    const subBuy = parseFloat(sub.buyPrice || 0);
                    const subSell = parseFloat(sub.price || 0);
                    const subQty = parseFloat(sub.qty || 1) * qty;
                    const subProfit = (subSell - subBuy) * subQty;

                    const isSubService = (subMaster?.category || subMaster?.type || '').toLowerCase().includes('service');
                    if (isSubService) itemServiceProfit += subProfit;
                    else itemMaterialProfit += subProfit;
                });
            } else {
                const buy = parseFloat(item.buyPrice || item.purchasePrice || master?.buyPrice || 0);
                const profitValue = (sell * qty) - (buy * qty);
                const isService = type === 'Service' || itemName.toLowerCase().includes('service');
                if (isService) itemServiceProfit = profitValue;
                else itemMaterialProfit = profitValue;
            }

            // Adjust profit by the line-item discount proportionally or simply subtraction
            // Typically, we subtract it from the total yield of that line
            const totalItemYield = itemMaterialProfit + itemServiceProfit - itemLineDiscount;
            
            // For bifurcation, we can split discount based on profit weight, but usually it's material
            if (itemServiceProfit > itemMaterialProfit) itemServiceProfit -= itemLineDiscount;
            else itemMaterialProfit -= itemLineDiscount;

            totalMaterialProfit += itemMaterialProfit;
            totalServiceProfit += itemServiceProfit;

            return {
                ...item,
                itemName,
                itemLineDiscount,
                materialProfit: itemMaterialProfit,
                serviceProfit: itemServiceProfit,
                type: (itemServiceProfit > itemMaterialProfit) ? 'Service' : 'Material'
            };
        });

        const grossProfit = totalMaterialProfit + totalServiceProfit - totals.discount;
        return { itemBreakdown, totalMaterialProfit, totalServiceProfit, grossProfit };
    }, [tx?.items, data.items, data.bundles, totals.discount]);

    const shareInvoice = () => {
        const win = window.open('', '_blank');
        const company = data.company || { name: 'SUN ELECTRICALS', address: 'Electrical Solutions & Services', mobile: '+91 0000000000' };
        const balance = totals.final - totals.received;
        
        const html = `
            <html>
            <head>
                <title>Invoice - ${tx.id}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
                    body { font-family: 'Outfit', sans-serif; padding: 40px; color: #373D3F; max-width: 850px; margin: auto; background-color: #f8fafc; }
                    .invoice-card { background: white; padding: 50px; border-radius: 40px; shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; position: relative; overflow: hidden; }
                    .top-accent { position: absolute; top: 0; left: 0; width: 100%; h-2; background: linear-gradient(90deg, #C6E015 0%, #FF9D00 100%); height: 8px; }
                    
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px; }
                    .logo-area { display: flex; align-items: center; gap: 15px; }
                    .logo-circle { width: 60px; height: 60px; background: #C6E015; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 30px; color: white; font-weight: 900; }
                    .brand-name { font-weight: 900; font-size: 24px; color: #373D3F; letter-spacing: -0.5px; line-height: 1; }
                    .brand-tag { font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px; }
                    
                    .invoice-meta { text-align: right; }
                    .invoice-meta h1 { margin: 0; font-size: 40px; font-weight: 900; color: #373D3F; letter-spacing: -1px; text-transform: uppercase; line-height: 0.9; }
                    .invoice-badge { display: inline-block; padding: 6px 15px; background: #FF9D00; color: white; border-radius: 12px; font-size: 10px; font-weight: 900; margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; }
                    
                    .client-section { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
                    .info-box h3 { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
                    .info-box p { margin: 2px 0; font-size: 14px; font-weight: 700; color: #334155; }
                    
                    table { width: 100%; border-collapse: separate; border-spacing: 0 10px; margin-top: 20px; }
                    th { text-align: left; padding: 15px; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #f1f5f9; }
                    td { padding: 20px 15px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 700; }
                    td:first-child { border-radius: 15px 0 0 15px; }
                    td:last-child { border-radius: 0 15px 15px 0; text-align: right; }
                    
                    .product-name { font-weight: 900; color: #1e293b; font-size: 15px; }
                    .product-meta { font-size: 10px; color: #94a3b8; margin-top: 4px; display: block; font-style: italic; }
                    
                    .summary-container { margin-top: 40px; display: grid; grid-template-cols: 1.5fr 1fr; gap: 50px; }
                    .summary-table { background: #373D3F; padding: 30px; border-radius: 30px; color: white; }
                    .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 14px; font-weight: 400; }
                    .summary-row:last-child { border: none; }
                    .summary-row span:last-child { font-weight: 900; }
                    
                    .total-highlight { background: #C6E015; color: #1e293b; padding: 20px; border-radius: 20px; margin-top: 15px; display: flex; justify-content: space-between; align-items: center; }
                    .total-highlight span:first-child { font-size: 12px; font-weight: 900; text-transform: uppercase; }
                    .total-highlight span:last-child { font-size: 24px; font-weight: 900; }
                    
                    .balance-box { border: 2px solid #e2e8f0; padding: 25px; border-radius: 25px; text-align: center; }
                    .balance-box p { margin: 0; font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; }
                    .balance-box h2 { margin: 10px 0 0; font-size: 32px; font-weight: 900; color: ${balance > 0 ? '#ef4444' : '#10b981'}; }
                    
                    .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
                    @media print { body { background: white; padding: 0; } .invoice-card { border: none; padding: 0; } }
                </style>
            </head>
            <body>
                <div class="invoice-card">
                    <div class="top-accent"></div>
                    
                    <div class="header">
                        <div class="logo-area">
                            <div class="logo-circle">S</div>
                            <div>
                                <div class="brand-name">Sun Electricals</div>
                                <div class="brand-tag">Professional Solutions</div>
                            </div>
                        </div>
                        <div class="invoice-meta">
                            <h1>INVOICE</h1>
                            <div class="invoice-badge">ID: #${tx.id}</div>
                            <p style="font-size: 12px; margin-top: 10px; font-weight: 900; color: #94a3b8;">${formatDate(tx.date)}</p>
                        </div>
                    </div>

                    <div class="client-section">
                        <div class="info-box">
                            <h3>Billed To</h3>
                            <p>${party?.name || tx.category || 'Cash Client'}</p>
                            <p style="font-weight: 400; color: #64748b;">${tx.mobile || party?.mobile || ''}</p>
                            <p style="font-weight: 400; color: #94a3b8; font-size: 12px; margin-top: 5px;">${tx.address || party?.address || ''}</p>
                        </div>
                        <div class="info-box" style="text-align: right;">
                            <h3>From</h3>
                            <p>${company.name}</p>
                            <p style="font-weight: 400; color: #64748b;">${company.address || ''}</p>
                            <p style="font-weight: 400; color: #94a3b8;">${company.mobile || ''}</p>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th style="text-align:center">Qty</th>
                                <th style="text-align:right">Rate</th>
                                <th style="text-align:right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(profitData.itemBreakdown.length > 0 ? profitData.itemBreakdown : [{ itemName: tx.category || 'Direct Service', qty: 1, price: tx.amount }]).map(i => `
                                <tr>
                                    <td>
                                        <div class="product-name">${i.itemName}</div>
                                        ${i.brand ? `<span class="product-meta">Brand: ${i.brand}</span>` : ''}
                                        ${i.description ? `<span class="product-meta">Note: ${i.description}</span>` : ''}
                                    </td>
                                    <td style="text-align:center">${i.qty}</td>
                                    <td style="text-align:right">${(parseFloat(i.price || 0)).toLocaleString('en-IN')}</td>
                                    <td style="text-align:right">${(parseFloat(i.qty || 1) * parseFloat(i.price || 0)).toLocaleString('en-IN')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="summary-container">
                        <div class="balance-area">
                            <div class="balance-box">
                                <p>Remaining Balance</p>
                                <h2>₹${(parseFloat(balance)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</h2>
                                <p style="margin-top: 15px; font-size: 9px; color: ${tx.paymentMode === 'Credit' ? '#f59e0b' : '#3b82f6'}">PAYMENT MODE: ${tx.paymentMode || 'STANDARD'}</p>
                            </div>
                            <p style="font-size: 10px; color: #94a3b8; margin-top: 20px; line-height: 1.6; font-weight: 700; text-transform: uppercase;">
                                Thank you for choosing Sun Electricals. We provide high-quality electrical work with safety standards.
                            </p>
                        </div>
                        <div class="summary-table">
                            <div class="summary-row">
                                <span>Subtotal</span>
                                <span>₹${(parseFloat(totals.gross)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>
                            ${totals.discount > 0 ? `
                            <div class="summary-row" style="color: #FF9D00;">
                                <span>Discount (${tx.discountType || '₹'})</span>
                                <span>- ₹${(parseFloat(totals.discount)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>` : ''}
                            <div class="summary-row">
                                <span>Net Total</span>
                                <span>₹${(parseFloat(totals.final)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div class="summary-row" style="color: #C6E015;">
                                <span>Amount Received</span>
                                <span>₹${(parseFloat(totals.received)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div class="total-highlight">
                                <span>Final Payable</span>
                                <span>₹${(parseFloat(totals.final)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        Powered by SMEES ERP • Digital Signature Verified
                    </div>
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
                    <div onClick={() => setViewDetail({ type: 'task', id: tx.convertedFromTask })} className="p-6 bg-slate-900 text-white rounded-[32px] cursor-pointer active:scale-95 shadow-xl shadow-slate-100 flex justify-between items-center group transition-all">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Source Operation</p>
                            <p className="font-black text-lg tracking-tight group-hover:text-blue-400 transition-colors">Task Trace: #{tx.convertedFromTask}</p>
                        </div>
                        <Layout className="text-slate-400 group-hover:rotate-12 transition-transform"/>
                    </div>
                )}

                {/* Linked Assets Section */}
                {tx.linkedAssets && tx.linkedAssets.length > 0 && (
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Embedded Assets & Inventory</label>
                        <div className="grid grid-cols-1 gap-3">
                            {tx.linkedAssets.map((asset, idx) => {
                                const assetData = typeof asset === 'string' ? data.assets?.find(a => a.name === asset) : data.assets?.find(a => a.id === asset.id || a.name === asset.name);
                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => {
                                            const aObj = party?.assets?.find(pa => pa.name === (assetData?.name || asset.name || asset));
                                            if (aObj) setViewDetail({ type: 'asset', id: aObj.name, data: { asset: aObj, party } });
                                        }}
                                        className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex justify-between items-center group hover:bg-white transition-all cursor-pointer active:scale-[0.98] shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform"><Package size={18}/></div>
                                            <div>
                                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{assetData?.name || asset.name || asset}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{assetData?.category || 'General Asset'}</p>
                                            </div>
                                        </div>
                                        {(asset.nextServiceDate || assetData?.nextService) && (
                                            <div className="text-right">
                                                <p className="text-[7px] font-black text-blue-500 uppercase tracking-widest opacity-50 mb-0.5">Next Service</p>
                                                <p className="text-[10px] font-black text-slate-900">{formatDate(asset.nextServiceDate || assetData.nextService)}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
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
                                <div key={i} className={`p-4 bg-slate-50 rounded-[28px] border border-slate-100 hover:bg-white transition-all ${item.isBundle ? 'ring-1 ring-blue-500/10 bg-blue-50/5' : ''}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 pr-4">
                                            <p className="text-xs font-black text-slate-800 tracking-tight leading-tight uppercase">{item.itemName}</p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                {item.qty} Qty × {formatCurrency(item.price)}
                                                {item.brand && <span className="text-blue-500 ml-2 border-l border-slate-200 pl-2">VARIANT: {item.brand}</span>}
                                            </p>
                                        </div>
                                        <p className="text-xs font-black text-slate-900">{formatCurrency(item.qty * item.price)}</p>
                                    </div>

                                    {/* Recursive Bundle Component List */}
                                    {item.isBundle && item.subItems?.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-200/50 space-y-2">
                                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Embedded Material & Service Trace</p>
                                            {item.subItems.map((sub, sidx) => {
                                                const sMaster = data.items.find(m => m.id === sub.itemId);
                                                return (
                                                    <div key={sidx} className="flex justify-between items-center text-[9px] font-bold text-slate-600 bg-white/50 p-2 rounded-xl">
                                                        <span className="flex-1 truncate pr-2">{sMaster?.name || 'Part'} {sub.brand ? `[${sub.brand}]` : ''}</span>
                                                        <span className="text-slate-400 whitespace-nowrap">{sub.qty} Unit(s)</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    
                                    {/* Profit Indicator */}
                                    {user.role === 'admin' && tx.type === 'sales' && (
                                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200/50">
                                            {item.materialProfit !== 0 && (
                                                <div className="text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    Material Gain: {formatCurrency(item.materialProfit)}
                                                </div>
                                            )}
                                            {item.serviceProfit !== 0 && (
                                                <div className="text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter bg-blue-50 text-blue-700 border border-blue-100">
                                                    Service Yield: {formatCurrency(item.serviceProfit)}
                                                </div>
                                            )}
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
