import React, { useState } from 'react';
import { Download, Upload, FileText, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { db, personalDb } from '../../services/firebase';
import { doc, setDoc, writeBatch } from 'firebase/firestore';

const BackupRestore = ({ data, setData, onClose }) => {
    const [restoring, setRestoring] = useState(false);
    const [progress, setProgress] = useState('');

    const handleExportJSON = () => {
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `SMEES_PRO_BACKUP_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleExportCSV = () => {
        const txs = data.transactions || [];
        if (txs.length === 0) return alert("No transactions to export");

        const headers = ["ID", "Date", "Type", "Party", "Amount", "Status", "Notes"];
        const rows = txs.map(t => [
            t.id, 
            t.date, 
            t.type, 
            t.partyName || 'Cash', 
            t.finalTotal || t.amount || 0, 
            t.status, 
            (t.notes || "").replace(/,/g, " ")
        ]);

        let csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `SMEES_PRO_TRANSACTIONS_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper: write documents in batches of 450 (Firestore limit is 500)
    const batchWrite = async (firestore, collectionName, records) => {
        const BATCH_SIZE = 450;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = writeBatch(firestore);
            const chunk = records.slice(i, i + BATCH_SIZE);
            chunk.forEach(record => {
                if (record.id) {
                    batch.set(doc(firestore, collectionName, record.id.toString()), record, { merge: true });
                }
            });
            await batch.commit();
        }
    };

    const handleImportJSON = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Validate the backup file has expected structure
                if (!importedData.transactions && !importedData.parties && !importedData.tasks) {
                    throw new Error("Invalid backup file — missing core data collections");
                }

                if (!window.confirm("CRITICAL: This will overwrite ALL your current data with the backup file. This cannot be undone. Proceed?")) return;

                setRestoring(true);

                // --- 1. RESTORE BUSINESS DATA (to business Firestore) ---
                const bizCollections = {
                    parties: importedData.parties || [],
                    items: importedData.items || [],
                    staff: importedData.staff || [],
                    tasks: importedData.tasks || [],
                    transactions: importedData.transactions || [],
                    attendance: importedData.attendance || []
                };

                for (const [colName, records] of Object.entries(bizCollections)) {
                    if (records.length > 0) {
                        setProgress(`Restoring ${colName} (${records.length} records)...`);
                        await batchWrite(db, colName, records);
                    }
                }

                // --- 2. RESTORE PERSONAL DATA (to personal Firestore) ---
                const personalCollections = {
                    transactions: importedData.personalTransactions || [],
                    tasks: importedData.personalTasks || [],
                    accounts: importedData.personalAccounts || []
                };

                for (const [colName, records] of Object.entries(personalCollections)) {
                    if (records.length > 0) {
                        setProgress(`Restoring personal ${colName} (${records.length} records)...`);
                        await batchWrite(personalDb, colName, records);
                    }
                }

                // --- 3. RESTORE SETTINGS ---
                setProgress('Restoring settings...');
                
                if (importedData.counters) {
                    await setDoc(doc(db, "settings", "counters"), importedData.counters, { merge: true });
                    await setDoc(doc(personalDb, "settings", "counters"), importedData.counters, { merge: true });
                }
                if (importedData.categories) {
                    await setDoc(doc(db, "settings", "categories"), importedData.categories, { merge: true });
                }
                if (importedData.company) {
                    await setDoc(doc(db, "settings", "company"), importedData.company, { merge: true });
                }
                if (importedData.personalCategories) {
                    await setDoc(doc(personalDb, "settings", "categories"), importedData.personalCategories, { merge: true });
                }

                // --- 4. UPDATE LOCAL STATE ---
                setData(importedData);
                localStorage.setItem('smees_data', JSON.stringify(importedData));

                setProgress('Complete!');
                setTimeout(() => {
                    alert("Data Restored Successfully! The page will now refresh.");
                    window.location.reload();
                }, 500);

            } catch (err) {
                console.error("Restore Error:", err);
                alert("Restore Failed: " + err.message);
                setRestoring(false);
                setProgress('');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="p-8 space-y-10 animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 bg-blue-600 rounded-[28px] flex items-center justify-center text-white shadow-2xl shadow-blue-200 mb-2">
                    <ShieldCheck size={32}/>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Vault Recovery System</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Full Metadata Protection • A-Z Redundancy</p>
            </div>

            {restoring && (
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-[32px] flex items-center gap-4 animate-in fade-in">
                    <Loader2 size={24} className="text-blue-600 animate-spin"/>
                    <div>
                        <p className="text-xs font-black text-blue-800 uppercase tracking-tight">Restoring Data...</p>
                        <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mt-1">{progress}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-8 bg-slate-900 rounded-[40px] text-white space-y-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div>
                        <h4 className="text-sm font-black uppercase tracking-widest leading-none mb-2">Generate Backup</h4>
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Download all app states into JSON format for safe keeping</p>
                    </div>
                    <div className="flex flex-col gap-3 pt-4">
                        <button onClick={handleExportJSON} disabled={restoring} className="w-full py-4 bg-blue-600 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-600/20 disabled:opacity-50">
                            <Download size={18}/> JSON Backup (Full)
                        </button>
                        <button onClick={handleExportCSV} disabled={restoring} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50">
                            <FileText size={18}/> Excel/CSV (Partial)
                        </button>
                    </div>
                </div>

                <div className="p-8 bg-white border-2 border-dashed border-slate-200 rounded-[40px] space-y-6 relative hover:border-blue-400 transition-all group">
                    <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none mb-2">System Restore</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Restore 100% of data from a previously created JSON file</p>
                    </div>
                    
                    <label className={`flex flex-col items-center justify-center w-full py-10 border-2 border-dashed border-slate-100 rounded-3xl cursor-pointer hover:bg-slate-50 transition-all active:scale-95 ${restoring ? 'pointer-events-none opacity-50' : ''}`}>
                        <Upload size={32} className="text-slate-300 group-hover:text-blue-500 transition-colors mb-2"/>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Click to Upload Backup</span>
                        <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} disabled={restoring} />
                    </label>

                    <div className="bg-rose-50 p-4 rounded-2xl flex items-start gap-4">
                        <AlertCircle className="text-rose-500 shrink-0" size={18}/>
                        <p className="text-[8px] font-bold text-rose-600 uppercase tracking-wider leading-relaxed">Warning: Restoring will overwrite everything currently in your database. Ensure you have a current backup before proceeding.</p>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-[32px] space-y-4">
                 <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">A-Z Coverage List</h5>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['Parties', 'Transactions', 'Assets', 'Tasks', 'Timelogs', 'Attendance', 'Staffs', 'Vault Data', 'Categories', 'Evidence & Photos', 'Counters'].map(item => (
                        <div key={item} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-100">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                             <span className="text-[8px] font-black text-slate-600 uppercase tracking-tight">{item}</span>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    );
};

export default BackupRestore;
