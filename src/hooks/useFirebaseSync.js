import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, doc, query, orderBy, limit, where } from "firebase/firestore";
import { db, personalDb } from '../services/firebase';
import { INITIAL_DATA } from '../utils/constants';

export const useFirebaseSync = () => {
    const [data, setData] = useState(() => {
        const cached = localStorage.getItem('smees_data');
        return cached ? JSON.parse(cached) : INITIAL_DATA;
    });

    const [syncing, setSyncing] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Debounce localStorage writes to avoid 9+ rapid serializations on load
    const saveTimerRef = useRef(null);
    const dataRef = useRef(data);
    dataRef.current = data;

    const debouncedSave = useCallback((newData) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            try {
                localStorage.setItem('smees_data', JSON.stringify(newData));
            } catch (e) {
                console.warn('localStorage save failed:', e);
            }
        }, 500); // Wait 500ms after last update before saving to localStorage
    }, []);

    useEffect(() => {
        setLoading(true);
        const unsubscribers = [];
        let loadedCount = 0;
        const totalListeners = 12; // 6 biz + 3 personal + 3 settings docs

        const checkLoaded = () => {
            loadedCount++;
            if (loadedCount >= totalListeners) {
                setLoading(false);
            }
        };

        // --- 1. BUSINESS REPOSITORY REAL-TIME SYNC ---
        const bizCollections = ['parties', 'items', 'staff', 'tasks', 'transactions', 'attendance'];
        
        bizCollections.forEach(colName => {
            let q = collection(db, colName);
            
            // Optimization: Apply limits and filters to high-volume collections
            if (colName === 'transactions') {
                q = query(q, orderBy('date', 'desc'), limit(500));
            } else if (colName === 'tasks') {
                q = query(q, orderBy('createdAt', 'desc'), limit(500));
            } else if (colName === 'attendance') {
                const sixtyDaysAgo = new Date();
                sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
                q = query(q, where('date', '>=', sixtyDaysAgo.toISOString().split('T')[0]));
            }

            const unsub = onSnapshot(q, (snapshot) => {
                const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setData(prev => {
                    const newData = { ...prev, [colName]: list };
                    debouncedSave(newData);
                    return newData;
                });
                checkLoaded();
            }, (error) => {
                console.error(`Sync Error [${colName}]:`, error);
                checkLoaded(); 
            });
            unsubscribers.push(unsub);
        });

        // --- 2. PERSONAL VAULT REAL-TIME SYNC (Isolated Database) ---
        const personalCollections = [
            { key: 'personalTasks', col: 'tasks' },
            { key: 'personalTransactions', col: 'transactions' },
            { key: 'personalAccounts', col: 'accounts' }
        ];

        personalCollections.forEach(({ key, col }) => {
            let q = collection(personalDb, col);
            if (key === 'personalTransactions') {
                q = query(q, orderBy('date', 'desc'), limit(500));
            } else if (key === 'personalTasks') {
                q = query(q, orderBy('createdAt', 'desc'), limit(500));
            }

            const unsub = onSnapshot(q, (snapshot) => {
                const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setData(prev => {
                    const newData = { ...prev, [key]: list };
                    debouncedSave(newData);
                    return newData;
                });
                checkLoaded();
            }, (error) => {
                console.error(`Sync Error [Personal ${key}]:`, error);
                checkLoaded();
            });
            unsubscribers.push(unsub);
        });

        // --- 3. SETTINGS & METADATA SYNC ---
        const settingsDocs = ['counters', 'categories', 'company'];
        settingsDocs.forEach(sDoc => {
            const unsub = onSnapshot(doc(db, "settings", sDoc), (snapshot) => {
                if (snapshot.exists()) {
                    setData(prev => {
                        const newData = { ...prev, [sDoc]: snapshot.data() };
                        debouncedSave(newData);
                        return newData;
                    });
                }
                checkLoaded();
            }, (error) => {
                console.error(`Sync Error [Settings ${sDoc}]:`, error);
                checkLoaded();
            });
            unsubscribers.push(unsub);
        });

        // --- 4. COUNTERS & CATEGORIES FOR PERSONAL (From Personal DB) ---
        const unsubPC = onSnapshot(doc(personalDb, "settings", "counters"), (snapshot) => {
            if (snapshot.exists()) {
                setData(prev => {
                    const newData = { ...prev, counters: { ...prev.counters, ...snapshot.data() } };
                    debouncedSave(newData);
                    return newData;
                });
            }
        });
        unsubscribers.push(unsubPC);

        const unsubPCat = onSnapshot(doc(personalDb, "settings", "categories"), (snapshot) => {
            if (snapshot.exists()) {
                setData(prev => {
                    const newData = { ...prev, personalCategories: snapshot.data() };
                    debouncedSave(newData);
                    return newData;
                });
            }
        });
        unsubscribers.push(unsubPCat);

        return () => {
            unsubscribers.forEach(unsub => unsub());
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [debouncedSave]);

    // Real manual sync — unsubscribes all listeners and re-subscribes 
    // (triggers fresh fetch without full page reload)
    const syncData = useCallback(async () => {
        setSyncing(true);
        // Force a fresh save of current state
        try {
            localStorage.setItem('smees_data', JSON.stringify(dataRef.current));
        } catch (e) { /* ignore */ }
        // Small delay for visual feedback, then reload to re-init listeners
        setTimeout(() => {
            window.location.reload();
        }, 300);
    }, []);

    return { data, setData, syncing, syncData, loading };
};
