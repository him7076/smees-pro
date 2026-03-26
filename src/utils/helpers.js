import { INITIAL_DATA } from './constants';

export const getNextId = (data, type) => {
  let prefix = type.charAt(0).toUpperCase();
  let counterKey = type;

  if (type === 'sales') { prefix = 'Sales:'; counterKey = 'sales'; } 
  else if (type === 'purchase') { prefix = 'Purchase:'; counterKey = 'purchase'; } 
  else if (type === 'expense') { prefix = 'Expense:'; counterKey = 'expense'; } 
  else if (type === 'payment') { prefix = 'Payment:'; counterKey = 'payment'; } 
  else if (type === 'estimate') { prefix = 'EST'; counterKey = 'estimate'; } 
  else if (type === 'task') { prefix = 'T'; counterKey = 'task'; } 
  else if (type === 'transaction') { prefix = 'TX'; counterKey = 'transaction'; }

  const counters = (data && data.counters) ? data.counters : INITIAL_DATA.counters;
  let num = counters[counterKey] || 1; 
  
  let newId = `${prefix}-${num}`;
  let isDuplicate = true;
  while(isDuplicate) {
      isDuplicate = (data.transactions && data.transactions.some(t => t.id === newId)) || 
                    (data.tasks && data.tasks.some(t => t.id === newId));
      if(isDuplicate) {
          num++; 
          newId = `${prefix}-${num}`;
      }
  }

  const nextCounters = { ...counters };
  nextCounters[counterKey] = num + 1;
  return { id: newId, nextCounters };
};

export const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
export const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
export const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--';

export const getTransactionTotals = (tx) => {
  if (tx.status === 'Cancelled') return { gross: 0, final: 0, paid: 0, status: 'CANCELLED', amount: 0, roundOff: 0 };
  const gross = tx.items?.reduce((acc, i) => acc + (parseFloat(i.qty || 0) * parseFloat(i.price || 0)), 0) || 0;
  let discVal = parseFloat(tx.discountValue || 0);
  if (tx.discountType === '%') discVal = (gross * discVal) / 100;
  const roundOff = parseFloat(tx.roundOff || 0); 
  const final = gross - discVal + roundOff;
  const paid = parseFloat(tx.received || tx.paid || 0);
  let status = 'UNPAID';
  if (paid >= final - 0.1 && final > 0) status = 'PAID';
  else if (paid > 0) status = 'PARTIAL';
  return { gross, final, paid, status, amount: parseFloat(tx.amount || 0) || final, roundOff };
};

export const getBillStats = (bill, transactions) => {
    if (bill.type === 'estimate') return { ...getTransactionTotals(bill), status: 'ESTIMATE', pending: 0, paid: 0 };
    const basic = getTransactionTotals(bill);
    const totalLinkedToThis = transactions
        .filter(t => t.status !== 'Cancelled' && t.linkedBills && t.id !== bill.id)
        .reduce((sum, t) => {
             const link = t.linkedBills.find(l => l.billId === bill.id);
             return sum + (link ? parseFloat(link.amount || 0) : 0);
        }, 0);
    const totalLinkedByThis = (bill.linkedBills || []).reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

    let status = 'UNPAID';
    if(bill.type === 'payment') {
         const totalUsed = totalLinkedToThis + totalLinkedByThis;
         const totalAvailable = parseFloat(bill.amount || 0) + parseFloat(bill.discountValue || 0);
         if (totalUsed >= totalAvailable - 0.1 && totalAvailable > 0) status = 'FULLY USED';
         else if (totalUsed > 0.1) status = 'PARTIALLY USED';
         else status = 'UNUSED';
         return { ...basic, used: totalUsed, status, totalAvailable, amount: parseFloat(bill.amount || 0) }; 
    }

    const totalPaid = basic.paid + totalLinkedToThis + totalLinkedByThis;
    if (totalPaid >= basic.final - 0.1) status = 'PAID';
    else if (totalPaid > 0.1) status = 'PARTIAL';
    return { ...basic, totalPaid, pending: basic.final - totalPaid, status };
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
