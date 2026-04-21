import React from 'react';
import { ArrowLeft, Share2, MapPin, Package, ChevronRight, Link as LinkIcon, Banknote, Landmark, Trash2, Edit2, Layout, MessageCircle } from 'lucide-react';
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
        const company = data.company || { name: 'SUN ELECTRICALS', address: 'Electrical Solutions & Services', mobile: '+91' };
        const balance = totals.final - totals.received;
        
        const html = `
            <html>
            <head>
                <title>Bill #${tx.id}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                    body { font-family: 'Inter', sans-serif; padding: 15px; color: #1e293b; max-width: 800px; margin: auto; background: #fff; }
                    .bill-container { border: 2px solid #334155; padding: 25px; border-radius: 4px; position: relative; }
                    
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 15px; background: #f8fafc; margin: -25px -25px 15px -25px; padding: 20px 25px; border-radius: 4px 4px 0 0; }
                    .logo-box { display: flex; align-items: center; gap: 15px; }
                    
                    /* ADVANCED CSS BULB LOGO */
                    .bulb-wrapper { position: relative; width: 45px; height: 45px; }
                    .bulb-body { width: 24px; height: 32px; background: #C6E015; border-radius: 50% 50% 40% 40%; position: absolute; left: 10px; top: 8px; box-shadow: 0 0 10px #C6E015; }
                    .bulb-base { width: 14px; height: 8px; background: #334155; position: absolute; left: 15px; bottom: 2px; border-radius: 0 0 4px 4px; }
                    .bulb-rays { position: absolute; width: 100%; height: 100%; top: 0; left: 0; }
                    .ray { position: absolute; width: 2px; height: 6px; background: #FF9D00; border-radius: 2px; left: 21px; transform-origin: center 22px; }
                    .ray:nth-child(1) { transform: rotate(0deg) translateY(-18px); }
                    .ray:nth-child(2) { transform: rotate(45deg) translateY(-18px); }
                    .ray:nth-child(3) { transform: rotate(90deg) translateY(-18px); }
                    .ray:nth-child(4) { transform: rotate(-45deg) translateY(-18px); }
                    .ray:nth-child(5) { transform: rotate(-90deg) translateY(-18px); }
                    
                    .title-area h1 { margin: 0; font-size: 22px; font-weight: 900; color: #334155; letter-spacing: 1px; }
                    .title-area p { margin: 0; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
                    
                    .top-info { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; }
                    .client-info h3 { font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; margin: 0 0 5px; }
                    .client-info p { margin: 0; font-size: 13px; font-weight: 900; color: #1e293b; }
                    .client-info small { color: #64748b; font-size: 11px; display: block; }

                    .bill-meta { text-align: right; }
                    .bill-meta p { margin: 0; font-size: 11px; font-weight: 700; color: #64748b; }
                    .bill-meta b { color: #1e293b; margin-left: 5px; }

                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { text-align: left; padding: 8px 5px; font-size: 9px; font-weight: 900; color: #334155; text-transform: uppercase; border-bottom: 2px solid #334155; background: #f8fafc; }
                    td { padding: 8px 5px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 700; line-height: 1.2; color: #334155; }
                    .item-name { font-weight: 900; color: #000; display: block; font-size: 12px; }
                    .item-desc { font-size: 9px; color: #64748b; font-weight: 500; font-style: italic; }
                    .item-brand { font-size: 9px; color: #FF9D00; font-weight: 900; text-transform: uppercase; margin-right: 5px; }

                    .summary-flex { display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; margin-top: 10px; }
                    .calc-area { flex: 1.2; background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 4px; }
                    .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
                    .row.grand { border-top: 2px solid #334155; margin-top: 5px; padding-top: 10px; font-size: 16px; font-weight: 900; color: #000; border-bottom: none; }
                    .row.due { color: #ef4444; font-weight: 900; border-top: 1px solid #ef4444; margin-top: 2px; padding-top: 5px; }

                    .terms { flex: 2; font-size: 9px; color: #64748b; line-height: 1.5; border-left: 3px solid #C6E015; padding-left: 15px; }
                    .foot { margin-top: 30px; text-align: center; font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; border-top: 1px solid #f1f5f9; padding-top: 15px; }
                    .disclaimer { font-size: 8px; color: #94a3b8; font-weight: 400; text-align: center; margin-top: 10px; font-style: italic; }
                    @media print { body { padding: 0; } .bill-container { border: 1px solid #000; padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="bill-container">
                    <div class="header">
                        <div class="logo-box">
                            <div class="bulb-wrapper">
                                <div class="bulb-rays">
                                    <div class="ray"></div><div class="ray"></div><div class="ray"></div><div class="ray"></div><div class="ray"></div>
                                </div>
                                <div class="bulb-body"></div>
                                <div class="bulb-base"></div>
                            </div>
                            <div>
                                <h1 style="margin:0; font-size:20px; font-weight:900; color:#334155;">SUN ELECTRICALS</h1>
                                <p style="margin:0; font-size:8px; color:#FF9D00; font-weight:900; letter-spacing:1px;">EXPERT SOLUTIONS & SERVICES</p>
                            </div>
                        </div>
                        <div class="title-area">
                            <h1 style="font-size: 18px; color: #ef4444;">INVOICE / BILL</h1>
                            <p style="color: #ef4444; font-weight: 800; font-size: 9px;">* THIS IS NOT A TAX INVOICE *</p>
                            <p style="margin-top: 5px;">BILL NO: #${tx.id}</p>
                        </div>
                    </div>

                    <div class="top-info">
                        <div class="client-info">
                            <h3>Billed To</h3>
                            <p>${party?.name || tx.category || 'Cash Client'}</p>
                            <small>${tx.mobile || party?.mobile || 'N/A'}</small>
                            <small>${tx.address || party?.address || ''}</small>
                        </div>
                        <div class="bill-meta">
                            <p>DATE: <b>${tx.date}</b></p>
                            <p>STATUS: <b style="color:#10b981">${tx.status?.toUpperCase() || 'ACTIVE'}</b></p>
                            <p>MODE: <b>${tx.paymentMode?.toUpperCase() || 'CASH'}</b></p>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width:60%">Item Description</th>
                                <th style="text-align:center">Qty</th>
                                <th style="text-align:right">Rate</th>
                                <th style="text-align:right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(profitData.itemBreakdown.length > 0 ? profitData.itemBreakdown : [{ itemName: tx.category || 'Direct Service', qty: 1, price: tx.amount }]).map(i => `
                                <tr>
                                    <td>
                                        <span class="item-name">
                                            ${i.brand ? `<span class="item-brand">${i.brand}</span>` : ''}
                                            ${i.itemName}
                                        </span>
                                        ${i.description ? `<span class="item-desc">${i.description}</span>` : ''}
                                    </td>
                                    <td style="text-align:center">${i.qty}</td>
                                    <td style="text-align:right">${(parseFloat(i.price || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                    <td style="text-align:right">${(parseFloat(i.qty || 1) * parseFloat(i.price || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="summary-flex">
                        <div class="terms">
                            <p style="color:#C6E015; margin:0 0 5px; font-weight:900; font-size:10px;">TERMS & CONDITIONS</p>
                            1. Items once sold replaced/repaired as per warranty.<br>
                            2. Claims for discrepancy must be made within 24 hours.<br>
                            3. Payments favor Sun Electricals only.
                            <div style="margin-top:25px; font-weight:900; color:#334155; font-size:11px; border-top:1px solid #334155; display:inline-block; padding-top:5px;">Authorized Signatory</div>
                        </div>
                        <div class="calc-area">
                            <div class="row"><span>Subtotal</span> <span>₹${(parseFloat(totals.gross)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                            ${totals.discount > 0 ? `<div class="row" style="color:#FF9D00"><span>Discount</span> <span>- ₹${(parseFloat(totals.discount)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>` : ''}
                            <div class="row grand"><span>Total</span> <span>₹${(parseFloat(totals.final)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                            <div class="row paid" style="color:#10b981"><span>Total Paid</span> <span>₹${(parseFloat(totals.received)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                            <div class="row due"><span>Balance Due</span> <span>₹${(parseFloat(balance)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                        </div>
                    </div>

                    <div class="foot">
                        Generated via SMEES ERP • Professional Ledger Output
                    </div>
                    <div class="disclaimer" style="border-top:1px dashed #e2e8f0; padding-top:10px; margin-top:10px;">
                        This invoice is issued for service and record purposes only. Sun Electricals is not registered under GST, hence GST is not applicable.
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
                        <button onClick={shareInvoice} className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center gap-2">
                            <Share2 size={20}/>
                            <span className="text-[10px] font-black uppercase tracking-widest px-3">Print Bill</span>
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
