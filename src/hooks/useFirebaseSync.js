import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, doc, query, orderBy, limit, where, getDocs } from "firebase/firestore";
import { db, personalDb } from '../services/firebase';
import { INITIAL_DATA } from '../utils/constants';

export const useFirebaseSync = () => {
    const [data, setData] = useState(() => {
        const cached = localStorage.getItem('smees_data');
        return cached ? JSON.parse(cached) : INITIAL_DATA;
    });

    const [syncing, setSyncing] = useState(false);
    const [loading, setLoading] = useState(true);
    
    const saveTimerRef = useRef(null);
    const dataRef = useRef(data);
    const unsubscribersRef = useRef([]);
    dataRef.current = data;

    const debouncedSave = useCallback((newData) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            try {
                localStorage.setItem('smees_data', JSON.stringify(newData));
            } catch (e) {
                console.warn('localStorage save failed:', e);
            }
        }, 1000); // Increased debounce to 1s to reduce serialization overhead
    }, []);

    useEffect(() => {
        // Check if sync is disabled - if so, just use local data
        const uiConfig = JSON.parse(localStorage.getItem('smees_ui_config') || '{}');
        if (uiConfig.syncEnabled === false) {
            setLoading(false);
            return; // Don't set up any listeners - pure offline mode
        }

        setLoading(true);
        const unsubscribers = [];
        let loadedCount = 0;
        const totalListeners = 11; // Reduced: removed attendance from real-time

        const checkLoaded = () => {
            loadedCount++;
            if (loadedCount >= totalListeners) setLoading(false);
        };

        // --- 1. BUSINESS COLLECTIONS (Real-time but with tighter limits) ---
        const bizCollections = ['parties', 'items', 'staff', 'tasks', 'transactions'];
        
        bizCollections.forEach(colName => {
            let q = collection(db, colName);
            
            if (colName === 'transactions') {
                q = query(q, orderBy('date', 'desc'), limit(500)); // Reduced from 2000 to 500
            } else if (colName === 'tasks') {
                q = query(q, orderBy('createdAt', 'desc'), limit(200)); // Reduced from 500 to 200
            }

            const unsub = onSnapshot(q, (snapshot) => {
                const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setData(prev => {
                    // For limited queries, merge with existing local data to keep old records
                    let merged = list;
                    if (colName === 'transactions' || colName === 'tasks') {
                        const existingIds = new Set(list.map(r => r.id));
                        const oldRecords = (prev[colName] || []).filter(r => !existingIds.has(r.id));
                        merged = [...list, ...oldRecords];
                    }
                    const newData = { ...prev, [colName]: merged };
                    debouncedSave(newData);
                    return newData;
                });
                checkLoaded();
            }, (error) => {
                console.error(`Sync Error [${colName}]:`, error);
                // IF project is suspended or network is down, immediately stop loading so user can use local data
                setLoading(false);
                checkLoaded(); 
            });
            unsubscribers.push(unsub);
        });

        // --- 2. ATTENDANCE: ONE-TIME FETCH (not real-time) ---
        const fetchAttendance = async () => {
            try {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const q = query(collection(db, 'attendance'), where('date', '>=', thirtyDaysAgo.toISOString().split('T')[0]));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setData(prev => {
                    const newData = { ...prev, attendance: list };
                    debouncedSave(newData);
                    return newData;
                });
            } catch (e) { 
                console.error('Attendance fetch error:', e); 
                setLoading(false); // Stop loading on error
            }
            checkLoaded();
        };
        fetchAttendance();

        // --- 3. PERSONAL VAULT (Real-time with limits) ---
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
                q = query(q, orderBy('createdAt', 'desc'), limit(200));
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

        // --- 4. SETTINGS DOCS (Real-time, low cost - single docs) ---
        const settingsDocs = ['counters', 'categories', 'company', 'counters_26_27'];
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

        // --- 5. PERSONAL SETTINGS ---
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

        unsubscribersRef.current = unsubscribers;

        return () => {
            unsubscribers.forEach(unsub => unsub());
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [debouncedSave]);

    const syncData = useCallback(async () => {
        setSyncing(true);
        try {
            localStorage.setItem('smees_data', JSON.stringify(dataRef.current));
        } catch (e) { /* ignore */ }
        setTimeout(() => {
            window.location.reload();
        }, 300);
    }, []);

    return { data, setData, syncing, syncData, loading };
};
