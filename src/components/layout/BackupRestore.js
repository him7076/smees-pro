import React, { useState } from 'react';
import { Download, Upload, FileText, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { db, personalDb, auth } from '../../services/firebase';
import { localDB } from '../../utils/localDB';
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
    const batchWrite = async (firestore, collectionName, records, onBatchComplete) => {
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
            if (onBatchComplete) onBatchComplete(chunk.length);
        }
    };

    const handleImportJSON = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (!importedData.transactions && !importedData.parties && !importedData.tasks) {
                    throw new Error("Invalid backup file — missing core data collections");
                }

                // 0. Pro-active Auth check/retry for Cloud Restore
                let currentUser = auth.currentUser;
                if (!currentUser) {
                    setProgress('Connecting to Cloud...');
                    try {
                        const { signInAnonymously } = await import('firebase/auth');
                        await signInAnonymously(auth);
                        currentUser = auth.currentUser;
                        console.log("Auto-Auth Success during Restore");
                    } catch (authErr) {
                        console.error("Auto-Auth Failed:", authErr);
                        setProgress('⚠️ Connection Error: Auth failed.');
                        alert("FIREBASE AUTH ERROR: " + authErr.message + "\n\nPlease ensure 'Anonymous Authentication' is enabled in your Firebase Console (smees-pro-new project).");
                        return;
                    }
                }

                if (!window.confirm("CRITICAL: This will overwrite ALL your current data with the backup file. Proceed?")) return;

                setRestoring(true);
                setProgress('Initializing Restore...');

                const bizCollections = {
                    parties: importedData.parties || [],
                    items: importedData.items || [],
                    staff: importedData.staff || [],
                    tasks: importedData.tasks || [],
                    transactions: importedData.transactions || [],
                    attendance: importedData.attendance || [],
                    assets: importedData.assets || [],
                    workLogs: importedData.workLogs || []
                };

                const personalCollections = {
                    personalTasks: importedData.personalTasks || [],
                    personalTransactions: importedData.personalTransactions || [],
                    personalAccounts: importedData.personalAccounts || []
                };

                // Calculate total records for progress bar
                let totalRecords = 0;
                Object.values(bizCollections).forEach(arr => totalRecords += arr.length);
                Object.values(personalCollections).forEach(arr => totalRecords += arr.length);
                
                let processedCount = 0;
                const updateOverallProgress = (count, colName) => {
                    processedCount += count;
                    const pct = Math.round((processedCount / totalRecords) * 100);
                    setProgress(`Syncing: ${pct}% [${processedCount}/${totalRecords}] — ${colName}...`);
                };

                // --- 1. RESTORE BUSINESS DATA ---
                for (const [colName, records] of Object.entries(bizCollections)) {
                    if (records.length > 0) {
                        try {
                            await batchWrite(db, colName, records, (count) => updateOverallProgress(count, colName));
                        } catch (batchErr) {
                            console.error(`Error in ${colName}:`, batchErr);
                            throw new Error(`Failed to write collection ${colName}: ${batchErr.message}`);
                        }
                    }
                }

                // --- 2. RESTORE PERSONAL DATA ---
                for (const [colName, records] of Object.entries(personalCollections)) {
                    const actualCol = colName.startsWith('personal') ? colName.replace('personal', '').toLowerCase() : colName;
                    if (records.length > 0) {
                        try {
                            await batchWrite(personalDb, actualCol, records, (count) => updateOverallProgress(count, colName));
                        } catch (batchErr) {
                            console.error(`Error in ${colName}:`, batchErr);
                            throw new Error(`Failed to write personal collection ${colName}: ${batchErr.message}`);
                        }
                    }
                }

                // --- 3. RESTORE SETTINGS ---
                setProgress('99% — Finalizing Settings...');
                try {
                    if (importedData.counters) {
                        await setDoc(doc(db, "settings", "counters"), importedData.counters, { merge: true });
                        await setDoc(doc(personalDb, "settings", "counters"), importedData.counters, { merge: true });
                    }
                    if (importedData.counters_26_27) {
                        await setDoc(doc(db, "settings", "counters_26_27"), importedData.counters_26_27, { merge: true });
                    }
                    if (importedData.categories) await setDoc(doc(db, "settings", "categories"), importedData.categories, { merge: true });
                    if (importedData.company) await setDoc(doc(db, "settings", "company"), importedData.company, { merge: true });
                    if (importedData.personalCategories) await setDoc(doc(personalDb, "settings", "categories"), importedData.personalCategories, { merge: true });
                } catch (setErr) {
                    throw new Error("Settings sync failed: " + setErr.message);
                }

                setData(importedData);
                localStorage.setItem('smees_data', JSON.stringify(importedData));

                setProgress('100% — Complete!');
                setTimeout(() => {
                    alert("Data Restored Successfully! App will now refresh.");
                    window.location.reload();
                }, 500);

            } catch (err) {
                console.error("Restore Error:", err);
                alert("Restore Failed: " + err.message + "\n\nTip: Check if Anonymous Auth is enabled in Firebase Console.");
                setRestoring(false);
                setProgress('Error: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    const handlePushToCloud = async () => {
        if (!window.confirm("This will PUSH all your current local data to Firebase. Proceed?")) return;
        
        try {
            let currentUser = auth.currentUser;
            if (!currentUser) {
                setRestoring(true);
                setProgress('Connecting to Cloud...');
                const { signInAnonymously } = await import('firebase/auth');
                await signInAnonymously(auth);
            }

            setRestoring(true);
            setProgress('Starting Cloud Push...');

            const bizCollections = {
                parties: data.parties || [],
                items: data.items || [],
                staff: data.staff || [],
                tasks: data.tasks || [],
                transactions: data.transactions || [],
                attendance: data.attendance || [],
                assets: data.assets || [],
                workLogs: data.workLogs || []
            };

            const personalCollections = {
                personalTasks: data.personalTasks || [],
                personalTransactions: data.personalTransactions || [],
                personalAccounts: data.personalAccounts || []
            };

            let totalRecords = 0;
            Object.values(bizCollections).forEach(arr => totalRecords += arr.length);
            Object.values(personalCollections).forEach(arr => totalRecords += arr.length);
            
            if (totalRecords === 0) throw new Error("No local data found to push.");

            let processedCount = 0;
            const updateOverallProgress = (count, colName) => {
                processedCount += count;
                const pct = Math.round((processedCount / totalRecords) * 100);
                setProgress(`Pushing: ${pct}% [${processedCount}/${totalRecords}] — ${colName}...`);
            };

            for (const [colName, records] of Object.entries(bizCollections)) {
                if (records.length > 0) {
                    await batchWrite(db, colName, records, (count) => updateOverallProgress(count, colName));
                }
            }

            for (const [colName, records] of Object.entries(personalCollections)) {
                const actualCol = colName.startsWith('personal') ? colName.replace('personal', '').toLowerCase() : colName;
                if (records.length > 0) {
                    await batchWrite(personalDb, actualCol, records, (count) => updateOverallProgress(count, colName));
                }
            }

            setProgress('99% — Finalizing Settings...');
            if (data.counters) await setDoc(doc(db, "settings", "counters"), data.counters, { merge: true });
            if (data.counters_26_27) await setDoc(doc(db, "settings", "counters_26_27"), data.counters_26_27, { merge: true });
            if (data.categories) await setDoc(doc(db, "settings", "categories"), data.categories, { merge: true });
            if (data.company) await setDoc(doc(db, "settings", "company"), data.company, { merge: true });
            if (data.personalCategories) await setDoc(doc(personalDb, "settings", "categories"), data.personalCategories, { merge: true });

            setProgress('100% — Complete!');
            setTimeout(() => {
                alert("All local data has been pushed to Cloud successfully!");
                setRestoring(false);
                setProgress('');
            }, 500);

        } catch (err) {
            console.error("Push Error:", err);
            alert("Push Failed: " + err.message);
            setRestoring(false);
            setProgress('');
        }
    };

    const toggleOfflineMode = () => {
        const isOffline = localStorage.getItem('smees_offline_mode') === 'true';
        localStorage.setItem('smees_offline_mode', !isOffline);
        window.location.reload();
    };

    const [availableProfiles, setAvailableProfiles] = useState([]);

    // Scan for profiles on load
    React.useEffect(() => {
        const scan = async () => {
            const keys = await localDB.keys();
            const profiles = keys.filter(k => k.startsWith('smees_data_profile_'))
                                 .map(k => k.replace('smees_data_profile_', ''));
            setAvailableProfiles(profiles);
        };
        scan();
    }, []);

    const handleSwitchProfile = async (profileName) => {
        if (!window.confirm(`Switch to profile "${profileName}"? Current unsynced data might be lost.`)) return;
        
        try {
            setRestoring(true);
            setProgress(`Switching to ${profileName}...`);
            
            const key = profileName === 'Default' ? 'smees_data' : `smees_data_profile_${profileName}`;
            const profileData = await localDB.get(key);
            
            if (profileData) {
                setData(profileData);
                await localDB.set('smees_data', profileData); // Set as primary
                localStorage.setItem('smees_data', JSON.stringify(profileData));
                localStorage.setItem('smees_active_profile', profileName);
                
                setProgress('100% — Profile Loaded');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                throw new Error("Profile data not found.");
            }
        } catch (err) {
            alert("Switch Failed: " + err.message);
            setRestoring(false);
        }
    };

    const handleRestoreOffline = (event, isNewProfile = false) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                let profileName = "Default";
                
                if (isNewProfile) {
                    profileName = prompt("Enter Profile Name (e.g. History_2025):", "History_Data");
                    if (!profileName) return;
                }

                setRestoring(true);
                setProgress('Loading Local Data...');

                if (isNewProfile) {
                    const key = `smees_data_profile_${profileName}`;
                    await localDB.set(key, importedData);
                    alert(`✅ Data saved to NEW PROFILE: ${profileName}.`);
                } else {
                    setData(importedData);
                    await localDB.set('smees_data', importedData);
                    localStorage.setItem('smees_data', JSON.stringify(importedData));
                }

                setProgress('100% — Loaded Offline');
                setTimeout(() => {
                    setRestoring(false);
                    alert("Local Restore Complete (OFFLINE). App will refresh.");
                    window.location.reload();
                }, 1000);
            } catch (err) {
                alert("Restore Failed: " + err.message);
                setRestoring(false);
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
                <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[40px] flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in duration-500 shadow-inner">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Upload size={20} className="text-indigo-600 animate-pulse"/>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-xs font-black text-indigo-900 uppercase tracking-widest leading-none mb-2">Synchronizing with Cloud</p>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">{progress}</p>
                    </div>
                </div>
            )}

            {/* --- PROFILE SWITCHER --- */}
            <div className="p-6 bg-indigo-50/50 rounded-[32px] border border-indigo-100 space-y-4">
                <div className="flex items-center gap-3 text-indigo-900">
                    <ShieldCheck size={20} className="text-indigo-600"/>
                    <h3 className="font-black text-sm uppercase tracking-wider">Local Profiles</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => handleSwitchProfile('Default')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${localStorage.getItem('smees_active_profile') === 'Default' || !localStorage.getItem('smees_active_profile') ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-400 border border-indigo-100'}`}
                    >
                        Default
                    </button>
                    {availableProfiles.map(p => (
                        <button 
                            key={p}
                            onClick={() => handleSwitchProfile(p)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${localStorage.getItem('smees_active_profile') === p ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-400 border border-indigo-100'}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- OFFLINE MODE KILL SWITCH --- */}
            <div className={`p-6 rounded-[32px] border-2 transition-all flex items-center justify-between gap-4 ${localStorage.getItem('smees_offline_mode') === 'true' ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-100'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${localStorage.getItem('smees_offline_mode') === 'true' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                        {localStorage.getItem('smees_offline_mode') === 'true' ? <ShieldCheck size={24}/> : <Upload size={24}/>}
                    </div>
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">
                            Cloud Connectivity: {localStorage.getItem('smees_offline_mode') === 'true' ? 'BLOCKED (SAFE)' : 'ACTIVE (SYNC ON)'}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                            {localStorage.getItem('smees_offline_mode') === 'true' ? 'App is running in Offline-Only mode. No cloud sync will happen.' : 'App is syncing with Firebase in real-time.'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={toggleOfflineMode}
                    className={`px-6 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${localStorage.getItem('smees_offline_mode') === 'true' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-rose-600 text-white shadow-lg shadow-rose-200'}`}
                >
                    {localStorage.getItem('smees_offline_mode') === 'true' ? 'Enable Sync' : 'Go Offline'}
                </button>
            </div>

            {!restoring && (
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[40px] p-8 text-white relative overflow-hidden group shadow-2xl shadow-indigo-200">
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
                                    <Upload size={20}/>
                                </div>
                                <h3 className="text-lg font-black tracking-tight">Force Cloud Sync</h3>
                            </div>
                            <p className="text-[10px] text-indigo-100/70 font-bold uppercase tracking-widest leading-relaxed max-w-md">
                                Push your current local database directly to the new Firebase project. Safe & fast migration.
                            </p>
                        </div>
                        <button 
                            onClick={handlePushToCloud}
                            className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/20"
                        >
                            Sync Local → Cloud Now
                        </button>
                    </div>
                    <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
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
                    
                    <div className="flex flex-col gap-3">
                        <label className={`flex flex-col items-center justify-center w-full py-8 border-2 border-dashed border-slate-100 rounded-3xl cursor-pointer hover:bg-slate-50 transition-all active:scale-95 ${restoring ? 'pointer-events-none opacity-50' : ''}`}>
                            <Upload size={32} className="text-slate-300 group-hover:text-rose-500 transition-colors mb-2"/>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Offline Restore (Safe Mode)</span>
                            <input type="file" accept=".json" className="hidden" onChange={(e) => handleRestoreOffline(e, false)} disabled={restoring} />
                        </label>

                        <button 
                            onClick={() => document.getElementById('new-profile-upload').click()}
                            className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-100 transition-all"
                        >
                            <ShieldCheck size={18}/> Restore as New Profile
                            <input id="new-profile-upload" type="file" accept=".json" className="hidden" onChange={(e) => handleRestoreOffline(e, true)} />
                        </button>
                    </div>

                    <div className="bg-rose-50 p-4 rounded-2xl flex items-start gap-4">
                        <AlertCircle className="text-rose-500 shrink-0" size={18}/>
                        <p className="text-[8px] font-bold text-rose-600 uppercase tracking-wider leading-relaxed">Safety Note: Offline restore will NOT sync to cloud. It stays 100% on this device until you manually sync.</p>
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
