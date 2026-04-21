import { INITIAL_DATA } from './constants';

export const getNextId = (data, type, date) => {
  let prefix = type.charAt(0).toUpperCase();
  let counterKey = type;

  if (type === 'sales') { prefix = 'Sales:'; counterKey = 'sales'; } 
  else if (type === 'purchase') { prefix = 'Purchase:'; counterKey = 'purchase'; } 
  else if (type === 'expense') { prefix = 'Expense:'; counterKey = 'expense'; } 
  else if (type === 'payment') { prefix = 'Payment:'; counterKey = 'payment'; } 
  else if (type === 'estimate') { prefix = 'EST'; counterKey = 'estimate'; } 
  else if (type === 'task') { prefix = 'T'; counterKey = 'task'; } 
  else if (type === 'transaction') { prefix = 'TX'; counterKey = 'transaction'; }
  else if (type === 'party') { prefix = 'P'; counterKey = 'party'; }
  else if (type === 'item') { prefix = 'I'; counterKey = 'item'; }
  else if (type === 'staff') { prefix = 'S'; counterKey = 'staff'; }
  else if (type === 'personalTask') { prefix = 'PT'; counterKey = 'personalTask'; }
  else if (type === 'personalTransaction') { prefix = 'PX'; counterKey = 'personalTransaction'; }

  // 1. Resolve Financial Year context
  const targetDate = date ? new Date(date) : new Date();
  const fyConfig = data.financialYear || {
      transitionDate: '2026-04-01',
      prefix: '2026-2027_',
      counterKey: 'counters_26_27'
  };

  const isTransaction = ['sales', 'purchase', 'expense', 'payment', 'estimate'].includes(type);
  const isNewFY = isTransaction && targetDate >= new Date(fyConfig.transitionDate);
  
  const fyPrefix = isNewFY ? fyConfig.prefix : '';
  const counterObjKey = isNewFY ? fyConfig.counterKey : 'counters';
  
  const counters = (data && data[counterObjKey]) ? data[counterObjKey] : (INITIAL_DATA[counterObjKey] || (!isNewFY ? INITIAL_DATA.counters : {}));
  let num = parseInt(counters[counterKey] || 1); 
  
  // Format ID: Legacy "Sales:-1063", New "Sales:2025-2026/1"
  let newId = isNewFY ? `${prefix}${fyPrefix}${num}` : `${prefix}-${num}`;

  let isDuplicate = true;
  while(isDuplicate) {
      isDuplicate = (data.transactions && data.transactions.some(t => t.id === newId)) || 
                    (data.tasks && data.tasks.some(t => t.id === newId)) ||
                    (data.parties && data.parties.some(t => t.id === newId)) ||
                    (data.items && data.items.some(t => t.id === newId)) ||
                    (data.staff && data.staff.some(t => t.id === newId)) ||
                    (data.personalTransactions && data.personalTransactions.some(t => t.id === newId)) ||
                    (data.personalTasks && data.personalTasks.some(t => t.id === newId)) ||
                    (data.personalAccounts && data.personalAccounts.some(t => t.id === newId));
      if(isDuplicate) {
          num++; 
          newId = isNewFY ? `${prefix}${fyPrefix}${num}` : `${prefix}-${num}`;
      }
  }

  const nextCounters = { ...counters };
  nextCounters[counterKey] = num + 1;
  return { id: newId, nextCounters, isNewFY };
};

export const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
export const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
export const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--';

export const getTransactionTotals = (tx) => {
  if (tx.status === 'Cancelled') return { gross: 0, final: 0, paid: 0, status: 'CANCELLED', amount: 0, roundOff: 0 };
  
  // 1. Calculate Per-Item Discount and Gross
  let gross = 0;
  let lineDiscountTotal = 0;
  
  (tx.items || []).forEach(i => {
    const lineGross = parseFloat(i.qty || 0) * parseFloat(i.price || 0);
    gross += lineGross;
    
    let lineDisc = parseFloat(i.discountValue || 0);
    if (i.discountType === '%') lineDisc = (lineGross * lineDisc) / 100;
    lineDiscountTotal += lineDisc;
  });

  // 2. Global Discount
  let globalDiscVal = parseFloat(tx.discountValue || 0);
  if (tx.discountType === '%') globalDiscVal = (gross * globalDiscVal) / 100;
  
  const totalDiscount = lineDiscountTotal + globalDiscVal;
  const roundOff = parseFloat(tx.roundOff || 0); 
  
  const rawFinal = gross - totalDiscount + roundOff;
  const final = Math.round(rawFinal * 100) / 100; 
  
  const paid = parseFloat(tx.received || tx.paid || 0);
  let status = 'UNPAID';
  if (paid >= final - 0.1 && final > 0) status = 'PAID';
  else if (paid > 0) status = 'PARTIAL';
  
  return { gross, final, paid, status, amount: parseFloat(tx.amount || 0) || final, roundOff, totalDiscount };
};

export const getBillStats = (bill, transactions) => {
    const isPayment = bill.type === 'payment';
    let used = 0;
    
    if (isPayment) {
        // For payments, 'used' is what THIS payment has linked to OTHER bills
        used = (bill.linkedBills || []).reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
    } else {
        // For bills (sales/purchase), 'used' is what OTHER payments have linked to THIS bill
        // IMPROVED: Robust ID comparison for different formats (Legacy vs New)
        const normalize = (id) => (id || '').toString().replace(/[:\-]/g, '').toLowerCase();
        const billIdNorm = normalize(bill.id);

        used = (transactions || [])
            .filter(t => t.status !== 'Cancelled' && t.type === 'payment' && t.linkedBills)
            .reduce((sum, t) => {
                 const link = t.linkedBills?.find(l => normalize(l.billId) === billIdNorm);
                 return sum + (link ? parseFloat(link.amount || 0) : 0);
            }, 0);
    }

    const amount = isPayment ? parseFloat(bill.amount || 0) : getTransactionTotals(bill).final;
    const pending = Math.max(0, amount - used);
    
    const tolerance = 0.5; // Tolerance for floating point precision issues
    let status = 'UNPAID';
    if (isPayment) {
        if (used >= amount - tolerance) status = 'FULLY USED';
        else if (used > 0) status = 'PARTIALLY USED';
        else status = 'UNUSED';
    } else {
        if (used >= amount - tolerance) status = 'PAID';
        else if (used > 0) status = 'PARTIAL';
        else status = 'UNPAID';
    }

    return { amount, used, pending, status };
};

export const getAttendanceDurations = (att) => {
    const getMins = (t) => {
        if(!t) return null;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    const checkIn = getMins(att.checkIn);
    const checkOut = getMins(att.checkOut);
    const lunchStart = getMins(att.lunchStart);
    const lunchEnd = getMins(att.lunchEnd);

    let grossMins = 0;
    if(checkIn !== null && checkOut !== null) grossMins = checkOut - checkIn;

    let lunchMins = 0;
    if(lunchStart !== null && lunchEnd !== null) lunchMins = lunchEnd - lunchStart;

    const activeMins = Math.max(0, grossMins - lunchMins);

    const formatMins = (m) => {
        if(!m || m <= 0) return '-';
        const h = Math.floor(m / 60);
        const mins = m % 60;
        return h > 0 ? `${h}h ${mins}m` : `${mins}m`;
    };

    return {
        gross: formatMins(grossMins),
        lunch: formatMins(lunchMins),
        active: formatMins(activeMins),
        activeMins
    };
};

export const getPartyBalances = (data) => {
    const balances = {};
    data.parties.forEach(p => balances[p.id] = (p.type === 'DR' || p.openingBalType === 'DR') ? parseFloat(p.openingBal || 0) : -parseFloat(p.openingBal || 0));
    data.transactions.forEach(tx => {
        if (tx.type === 'estimate' || tx.status === 'Cancelled') return;
        const { final, paid } = getTransactionTotals(tx);
        const unpaid = final - paid;

        if (tx.type === 'sales') balances[tx.partyId] = (balances[tx.partyId] || 0) + unpaid;
        if (tx.type === 'purchase' || (tx.type === 'expense' && tx.partyId)) {
            balances[tx.partyId] = (balances[tx.partyId] || 0) - unpaid;
        }

        if (tx.type === 'payment') {
            const payAmt = parseFloat(tx.amount || 0);
            const payDisc = parseFloat(tx.discountValue || 0);
            const totalCredit = payAmt + payDisc;
            if (tx.subType === 'in') balances[tx.partyId] = (balances[tx.partyId] || 0) - totalCredit;
            else balances[tx.partyId] = (balances[tx.partyId] || 0) + totalCredit;
        }
    });
    return balances;
};

export const getItemStock = (data) => {
    const stock = {};
    if (!data.items) return stock;

    // 1. Initialize with Opening Stock
    data.items.forEach(i => {
        if (i.id) stock[i.id.toString()] = parseFloat(i.openingStock || 0);
    });

    // 2. Process Transactions (Sales / Purchase)
    (data.transactions || []).forEach(tx => {
        if (tx.type === 'estimate' || tx.status === 'Cancelled') return;
        tx.items?.forEach(line => {
            const itemId = (line.itemId || '').toString();
            if (itemId && stock.hasOwnProperty(itemId)) {
                const qty = parseFloat(line.qty || 0);
                if (tx.type === 'sales') stock[itemId] -= qty;
                if (tx.type === 'purchase') stock[itemId] += qty;
            }
            // Add sub-items to stock calculation
            line.subItems?.forEach(sub => {
                const subId = (sub.itemId || '').toString();
                if (subId && stock.hasOwnProperty(subId)) {
                    const subQty = parseFloat(sub.qty || 0) * (parseFloat(line.qty || 1));
                    if (tx.type === 'sales') stock[subId] -= subQty;
                    // Usually we don't purchase-in bundles with sub-items this way, but consistent logic:
                    if (tx.type === 'purchase') stock[subId] += subQty;
                }
            });
        });
    });

    // 3. Process Tasks (Include items used in active/done tasks that aren't sales yet)
    (data.tasks || []).forEach(task => {
        // Skip if already converted (the resulting sale transaction handles stock)
        if (task.status === 'Cancelled' || task.status === 'Converted') return;
        
        task.itemsUsed?.forEach(line => {
            const itemId = (line.itemId || '').toString();
            if (itemId && stock.hasOwnProperty(itemId)) {
                stock[itemId] -= parseFloat(line.qty || 0);
            }
        });
    });

    return stock;
};

export const getFilteredAttendance = (staff, filter, custom = { start: '', end: '' }, allAttendance = []) => {
    const now = new Date();
    return allAttendance.filter(a => {
        if (a.staffId !== staff.id) return false;
        const d = new Date(a.date);
        
        // Use time-agnostic date objects for comparison
        const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (filter === 'This Month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (filter === 'Last Month') {
            const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear();
        }
        if (filter === 'This Week') {
            const start = new Date(nowDate); 
            start.setDate(nowDate.getDate() - nowDate.getDay());
            return dDate >= start;
        }
        if (filter === 'Custom Range' && custom.start && custom.end) {
            const s = new Date(custom.start);
            const e = new Date(custom.end);
            return dDate >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) && 
                   dDate <= new Date(e.getFullYear(), e.getMonth(), e.getDate());
        }
        return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
};

export const sortData = (data, criterion) => {
    if (!criterion) return data;
    const sorted = [...data];
    switch (criterion) {
        case 'A-Z': return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        case 'Z-A': return sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        case 'DateAsc': return sorted.sort((a, b) => new Date(a.date || a.dueDate || 0) - new Date(b.date || b.dueDate || 0));
        case 'DateDesc': return sorted.sort((a, b) => new Date(b.date || b.dueDate || 0) - new Date(a.date || a.dueDate || 0));
        case 'AmtAsc': return sorted.sort((a, b) => (parseFloat(a.amount || a.finalTotal || 0) - parseFloat(b.amount || b.finalTotal || 0)));
        case 'AmtDesc': return sorted.sort((a, b) => (parseFloat(b.amount || b.finalTotal || 0) - parseFloat(a.amount || a.finalTotal || 0)));
        default: return sorted;
    }
};

export const checkPermission = (user, permission) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return !!user.permissions?.[permission];
};

export const cleanData = (obj) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
        if (newObj[key] === undefined) newObj[key] = "";
    });
    return newObj;
};

export const getDaysDiff = (d1, d2) => Math.floor((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24));

export const generateAIReport = (data, startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const now = new Date();

    const periodTasks = data.tasks.filter(t => {
        const d = new Date(t.createdAt); 
        return d >= start && d <= end;
    });
    
    const periodCompletedTasks = data.tasks.filter(t => {
        if (t.status !== 'Done' || !t.completedAt) return false;
        const d = new Date(t.completedAt);
        return d >= start && d <= end;
    });

    const periodTx = data.transactions.filter(t => {
        const d = new Date(t.date);
        return t.status !== 'Cancelled' && d >= start && d <= end;
    });

    const periodSales = periodTx.filter(t => t.type === 'sales');
    const periodExpenses = periodTx.filter(t => t.type === 'expense');

    let taskStats = { 
        created: periodTasks.length, 
        completedOnTime: 0, 
        completedLate: 0, 
        pending: 0, 
        overdue: 0 
    };

    periodCompletedTasks.forEach(t => {
        const due = t.dueDate ? new Date(t.dueDate) : null;
        const done = new Date(t.completedAt);
        if (due && done > new Date(due.getTime() + 86400000)) taskStats.completedLate++;
        else taskStats.completedOnTime++;
    });

    const allActiveTasks = data.tasks.filter(t => t.status !== 'Done' && t.status !== 'Converted');
    taskStats.pending = allActiveTasks.length;
    taskStats.overdue = allActiveTasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length;

    const staffMetrics = {};
    data.staff.forEach(s => staffMetrics[s.id] = { name: s.name, hours: 0, revenue: 0, tasksDone: 0, salary: parseFloat(s.salary || 0) });

    data.tasks.forEach(t => {
        (t.timeLogs || []).forEach(log => {
            const logDate = new Date(log.start);
            if (logDate >= start && logDate <= end && staffMetrics[log.staffId]) {
                staffMetrics[log.staffId].hours += (parseFloat(log.duration || 0) / 60);
            }
        });
    });

    periodSales.forEach(sale => {
        if (sale.convertedFromTask) {
            const task = data.tasks.find(t => t.id === sale.convertedFromTask);
            if (task) {
                const logs = task.timeLogs || [];
                const totalDuration = logs.reduce((sum, l) => sum + parseFloat(l.duration || 0), 0);
                const netSale = parseFloat(sale.finalTotal || 0);

                if (totalDuration > 0) {
                    logs.forEach(log => {
                        if (staffMetrics[log.staffId]) {
                            const share = (parseFloat(log.duration) / totalDuration) * netSale;
                            staffMetrics[log.staffId].revenue += share;
                        }
                    });
                } else {
                    const assigned = task.assignedStaff || [];
                    if (assigned.length > 0) {
                        const share = netSale / assigned.length;
                        assigned.forEach(sid => {
                            if (staffMetrics[sid]) staffMetrics[sid].revenue += share;
                        });
                    }
                }
            }
        }
    });

    let financial = {
        revenue: 0,      
        cogs: 0,         
        grossProfit: 0,  
        operatingExp: 0, 
        netProfit: 0,    
        totalDiscount: 0,
        grossSales: 0    
    };

    periodSales.forEach(s => {
        const net = parseFloat(s.finalTotal || 0);
        financial.revenue += net;
        (s.items || []).forEach(i => {
            const buyPrice = parseFloat(i.buyPrice || 0);
            const qty = parseFloat(i.qty || 0);
            financial.cogs += (buyPrice * qty);
        });
        const disc = parseFloat(s.discountValue || 0);
        financial.totalDiscount += disc;
        financial.grossSales += (s.grossTotal || (net + disc));
    });

    periodExpenses.forEach(e => {
        financial.operatingExp += parseFloat(e.finalTotal || e.amount || 0);
    });

    financial.grossProfit = financial.revenue - financial.cogs;
    financial.netProfit = financial.grossProfit - financial.operatingExp;
    const profitMargin = financial.revenue > 0 ? ((financial.netProfit / financial.revenue) * 100).toFixed(1) : 0;

    let aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0, totalDue: 0 };
    let riskClients = [];

    data.transactions.filter(t => t.type === 'sales' && t.status !== 'Cancelled').forEach(sale => {
        const stats = getTransactionTotals(sale);
        const due = stats.final - stats.paid;
        
        if (due > 1) { 
            aging.totalDue += due;
            const daysOld = getDaysDiff(now, sale.date);
            if (daysOld <= 30) aging['0-30'] += due;
            else if (daysOld <= 60) aging['31-60'] += due;
            else if (daysOld <= 90) aging['61-90'] += due;
            else {
                aging['90+'] += due;
                const pName = data.parties.find(p => p.id === sale.partyId)?.name;
                if(pName && !riskClients.includes(pName)) riskClients.push(pName);
            }
        }
    });

    let amc = { upcoming: 0, potentialRev: 0 };
    const next30Days = new Date();
    next30Days.setDate(now.getDate() + 30);

    data.parties.forEach(p => {
        (p.assets || []).forEach(a => {
            if (a.nextServiceDate) {
                const sDate = new Date(a.nextServiceDate);
                if (sDate >= now && sDate <= next30Days) {
                    amc.upcoming++;
                    amc.potentialRev += parseFloat(a.servicePrice || 500); 
                }
            }
        });
    });

    const expenseMap = {};
    periodExpenses.forEach(e => {
        const cat = e.category || 'Uncategorized';
        expenseMap[cat] = (expenseMap[cat] || 0) + parseFloat(e.finalTotal || 0);
    });
    const topExpenses = Object.entries(expenseMap).sort((a,b) => b[1] - a[1]).slice(0, 3);

    let r = `AI BUSINESS INTELLIGENCE REPORT\n`;
    r += `Period: ${startDate} to ${endDate}\n`;
    r += `Generated: ${now.toLocaleString()}\n\n`;
    r += `================================\n`;
    r += `1. FINANCIAL HEALTH\n`;
    r += `================================\n`;
    r += `• Net Revenue:     ${formatCurrency(financial.revenue)}\n`;
    r += `• COGS (Material): ${formatCurrency(financial.cogs)}\n`;
    r += `• Gross Profit:    ${formatCurrency(financial.grossProfit)} (Margin: ${((financial.grossProfit/financial.revenue)*100 || 0).toFixed(1)}%)\n`;
    r += `• Op. Expenses:    ${formatCurrency(financial.operatingExp)}\n`;
    r += `• NET PROFIT:      ${formatCurrency(financial.netProfit)} (${profitMargin}%)\n\n`;

    r += `================================\n`;
    r += `2. PAYMENTS & RISK (Lifetime)\n`;
    r += `================================\n`;
    r += `• Total Pending:   ${formatCurrency(aging.totalDue)}\n`;
    r += `• 0-30 Days:       ${formatCurrency(aging['0-30'])}\n`;
    r += `• 31-60 Days:      ${formatCurrency(aging['31-60'])}\n`;
    r += `• CRITICAL (90+):  ${formatCurrency(aging['90+'])}\n`;
    if(riskClients.length > 0) r += `⚠️ Risk Clients: ${riskClients.slice(0, 3).join(', ')}\n\n`;
    else r += `\n`;

    r += `================================\n`;
    r += `3. WORKFORCE & PRODUCTIVITY\n`;
    r += `================================\n`;
    r += `• Tasks Created: ${taskStats.created} | Completed: ${taskStats.completedOnTime + taskStats.completedLate}\n`;
    r += `• On-Time Rate:  ${((taskStats.completedOnTime / (taskStats.completedOnTime + taskStats.completedLate || 1))*100).toFixed(0)}%\n`;
    r += `• Current Load:  ${taskStats.pending} Pending (${taskStats.overdue} Overdue)\n`;
    r += `\nStaff Performance (Hours | Revenue):\n`;
    
    Object.values(staffMetrics)
        .filter(s => s.hours > 0 || s.revenue > 0)
        .sort((a,b) => b.revenue - a.revenue)
        .forEach(s => {
            r += `- ${s.name.padEnd(10)}: ${s.hours.toFixed(1)} hrs | Gen: ${formatCurrency(s.revenue)}\n`;
        });
    r += `\n`;

    r += `================================\n`;
    r += `4. ASSETS & FUTURE\n`;
    r += `================================\n`;
    r += `• Upcoming AMC (30 Days): ${amc.upcoming}\n`;
    r += `• Projected Revenue:      ${formatCurrency(amc.potentialRev)}\n`;
    r += `• Top Expense:            ${topExpenses[0] ? `${topExpenses[0][0]} (${formatCurrency(topExpenses[0][1])})` : 'None'}\n\n`;

    r += `================================\n`;
    r += `💡 ACTION INSIGHTS\n`;
    r += `================================\n`;
    
    if (financial.netProfit < 0) r += `! URGENT: Business is running at a LOSS. Review COGS and Expenses.\n`;
    if (aging['90+'] > 10000) r += `! CASHFLOW: Collect ${formatCurrency(aging['90+'])} from old dues immediately.\n`;
    if (taskStats.overdue > 5) r += `! OPERATIONS: ${taskStats.overdue} tasks are overdue. Re-assign staff.\n`;
    if (financial.totalDiscount > (financial.revenue * 0.1)) r += `! PRICING: Discounts are high (${((financial.totalDiscount/financial.revenue)*100).toFixed(1)}% of sales). Control leaks.\n`;
    
    r += `\n[End of Report]`;
    return r;
};
