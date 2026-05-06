import React, { useState } from 'react';
import { Download, Upload, FileText, ShieldCheck, AlertCircle, Loader2, RefreshCw, Database, TrendingUp, Plus, Building2 } from 'lucide-react';
import { db, personalDb, auth } from '../../services/firebase';
import { localDB } from '../../utils/localDB';
import { doc, setDoc, writeBatch, collection, getDocs } from 'firebase/firestore';

const BackupRestore = ({ data, setData, onClose }) => {
    const [restoring, setRestoring] = useState(false);
    const [progress, setProgress] = useState('');
    const [syncing, setSyncing] = useState(false);

    const handleExportJSON = () => {
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `SMEES_PRO_BACKUP_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
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

    const handlePushToCloud = async () => {
        if (!window.confirm("This will PUSH all your current local data to Firebase. Proceed?")) return;
        
        try {
            setSyncing(true);
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
                workLogs: data.workLogs || [],
                bundles: data.bundles || [],
                estimates: data.estimates || []
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
                setSyncing(false);
            }, 500);

        } catch (err) {
            console.error("Push Error:", err);
            alert("Push Failed: " + err.message);
            setRestoring(false);
            setSyncing(false);
            setProgress('');
        }
    };

    const handleResetCloud = async () => {
        if (!window.confirm("🚨 CRITICAL: This will PERMANENTLY DELETE all cloud data for this company. Are you sure?")) return;
        if (!window.confirm("FINAL WARNING: This cannot be undone. Wipe Cloud?")) return;

        try {
            setRestoring(true);
            setProgress('Wiping Cloud Collections...');

            const bizCollections = ['parties', 'items', 'staff', 'tasks', 'transactions', 'attendance', 'assets', 'workLogs', 'bundles', 'estimates'];
            
            for (const col of bizCollections) {
                setProgress(`Wiping ${col}...`);
                const q = collection(db, col);
                const snap = await getDocs(q);
                const batch = writeBatch(db);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }

            setProgress('100% — Cloud Reset Complete');
            setTimeout(() => {
                setRestoring(false);
                alert("Cloud Reset Successful.");
                window.location.reload();
            }, 1000);
        } catch (err) {
            alert("Reset Failed: " + err.message);
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
                    profileName = prompt("Enter Profile Name:", "Backup_Data");
                    if (!profileName) return;
                }

                setRestoring(true);
                setProgress('Loading Local Data...');

                if (isNewProfile) {
                    const key = `smees_data_profile_${profileName}`;
                    await localDB.set(key, importedData);
                    alert(`✅ Saved to Profile: ${profileName}`);
                } else {
                    const activeComp = localStorage.getItem('smees_active_comp') || 'default';
                    const storageKey = `smees_data_${activeComp}`;
                    setData(importedData);
                    await localDB.set(storageKey, importedData);
                    localStorage.setItem(storageKey, JSON.stringify(importedData));
                }

                setProgress('100% — Loaded Offline');
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                alert("Restore Failed: " + err.message);
                setRestoring(false);
            }
        };
        reader.readAsText(file);
    };

    const handleMergeData = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                setRestoring(true);
                setProgress('Merging Data...');

                const collections = ['parties', 'items', 'staff', 'tasks', 'transactions', 'attendance', 'assets', 'workLogs', 'bundles', 'estimates'];
                const merged = { ...data };

                collections.forEach(col => {
                    const existingArr = data[col] || [];
                    const importedArr = importedData[col] || [];
                    const map = new Map();
                    existingArr.forEach(item => map.set(item.id, item));
                    importedArr.forEach(item => map.set(item.id, item));
                    merged[col] = Array.from(map.values());
                });

                setData(merged);
                const activeComp = localStorage.getItem('smees_active_comp') || 'default';
                await localDB.set(`smees_data_${activeComp}`, merged);
                localStorage.setItem(`smees_data_${activeComp}`, JSON.stringify(merged));

                setProgress('100% — Merge Complete');
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                alert("Merge Failed: " + err.message);
                setRestoring(false);
            }
        };
        reader.readAsText(file);
    };

    const toggleOfflineMode = () => {
        const isOffline = localStorage.getItem('smees_offline_mode') === 'true';
        localStorage.setItem('smees_offline_mode', !isOffline);
        window.location.reload();
    };

    const [availableProfiles, setAvailableProfiles] = useState([]);
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
        if (!window.confirm(`Switch to "${profileName}"?`)) return;
        const key = profileName === 'Default' ? `smees_data_${localStorage.getItem('smees_active_comp') || 'default'}` : `smees_data_profile_${profileName}`;
        const profileData = await localDB.get(key);
        if (profileData) {
            setData(profileData);
            const activeKey = `smees_data_${localStorage.getItem('smees_active_comp') || 'default'}`;
            await localDB.set(activeKey, profileData);
            localStorage.setItem(activeKey, JSON.stringify(profileData));
            window.location.reload();
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in zoom-in duration-500 max-w-2xl mx-auto pb-20">
            <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-16 h-16 bg-blue-600 rounded-[24px] flex items-center justify-center shadow-2xl shadow-blue-200">
                    <Database className="text-white" size={32}/>
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">System Maintenance</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Maintenance & Data Recovery</p>
            </div>

            {restoring && (
                <div className="fixed inset-0 z-[300] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center animate-in fade-in">
                    <Loader2 className="animate-spin text-blue-600 mb-6" size={64}/>
                    <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-widest">{progress.split('—')[0]}</h3>
                    <div className="w-full max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: progress.includes('%') ? progress.match(/\d+%/)[0] : '10%' }}></div>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">{progress.split('—')[1] || 'Processing request...'}</p>
                </div>
            )}

            {/* --- CLOUD CONTROL --- */}
            <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                    <RefreshCw className="text-blue-600" size={20}/>
                    <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-900">Cloud Sync Control</h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className={`p-6 rounded-[32px] border-2 flex items-center justify-between gap-4 ${localStorage.getItem('smees_offline_mode') === 'true' ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-100'}`}>
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Sync Status</h4>
                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{localStorage.getItem('smees_offline_mode') === 'true' ? 'Offline Only (Safe)' : 'Real-time Cloud Sync'}</p>
                        </div>
                        <button onClick={toggleOfflineMode} className={`px-5 py-2.5 rounded-2xl font-black text-[8px] uppercase tracking-widest ${localStorage.getItem('smees_offline_mode') === 'true' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                            {localStorage.getItem('smees_offline_mode') === 'true' ? 'Go Online' : 'Go Offline'}
                        </button>
                    </div>

                    <button onClick={handlePushToCloud} className="w-full py-5 bg-slate-900 text-white rounded-[32px] flex items-center justify-center gap-4 hover:scale-[1.02] transition-all shadow-xl">
                        <TrendingUp size={20} className="text-blue-400"/>
                        <div className="text-left">
                            <span className="block text-[11px] font-black uppercase tracking-[0.2em]">Force Cloud Sync</span>
                            <span className="block text-[8px] opacity-40 font-bold uppercase tracking-widest mt-0.5">Upload local data to Firebase</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* --- FILE BACKUP --- */}
            <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                    <FileText className="text-amber-600" size={20}/>
                    <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-900">File Backup & Restore</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button onClick={handleExportJSON} className="p-6 bg-slate-50 rounded-[32px] flex flex-col items-center gap-2 border border-slate-100">
                        <Download size={24} className="text-blue-600"/>
                        <span className="text-[10px] font-black uppercase text-slate-900">Backup JSON</span>
                    </button>
                    <label className="p-6 bg-slate-50 rounded-[32px] flex flex-col items-center gap-2 border border-slate-100 cursor-pointer">
                        <Upload size={24} className="text-rose-600"/>
                        <span className="text-[10px] font-black uppercase text-slate-900">Restore JSON</span>
                        <input type="file" accept=".json" className="hidden" onChange={(e) => handleRestoreOffline(e, false)} />
                    </label>
                </div>

                <button onClick={() => document.getElementById('merge-file').click()} className="w-full py-4 bg-emerald-50 text-emerald-600 rounded-[28px] flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest border border-emerald-100">
                    <Plus size={18}/> Smart Merge Backup Files
                    <input id="merge-file" type="file" accept=".json" className="hidden" onChange={handleMergeData} />
                </button>
            </div>

            {/* --- BUSINESS PROFILES --- */}
            <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                    <Building2 className="text-indigo-600" size={20}/>
                    <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-900">Local Business Profiles</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleSwitchProfile('Default')} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-indigo-600 text-white">Default</button>
                    {availableProfiles.map(p => (
                        <button key={p} onClick={() => handleSwitchProfile(p)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-slate-50 text-slate-400">{p}</button>
                    ))}
                    <button onClick={() => document.getElementById('new-p').click()} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-indigo-50 text-indigo-600 border border-indigo-100">
                        + New Profile
                        <input id="new-p" type="file" accept=".json" className="hidden" onChange={(e) => handleRestoreOffline(e, true)} />
                    </button>
                </div>
            </div>

            {/* --- DANGER ZONE --- */}
            <div className="bg-rose-50 rounded-[40px] p-8 border border-rose-100 space-y-6">
                <div className="flex items-center gap-3 border-b border-rose-100 pb-4">
                    <AlertCircle className="text-rose-600" size={20}/>
                    <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-rose-900">Danger Zone</h3>
                </div>
                <button onClick={handleResetCloud} className="w-full py-4 bg-white text-rose-600 border border-rose-200 rounded-[28px] font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all">
                    Reset & Wipe Firebase Cloud
                </button>
                <p className="text-[8px] text-rose-400 text-center font-black uppercase tracking-widest px-6 italic">Clears cloud data for this company. Local data is safe.</p>
            </div>
        </div>
    );
};

export default BackupRestore;
