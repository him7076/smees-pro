import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, doc, query, orderBy, limit, where, getDocs } from "firebase/firestore";
import { db, personalDb } from '../services/firebase';
import { INITIAL_DATA } from '../utils/constants';
import { localDB } from '../utils/localDB';

export const useFirebaseSync = () => {
    // 1. Initial State from localStorage (Instant startup)
    const [data, setData] = useState(() => {
        try {
            const cached = localStorage.getItem('smees_data');
            return cached ? JSON.parse(cached) : INITIAL_DATA;
        } catch(e) { return INITIAL_DATA; }
    });

    const [syncing, setSyncing] = useState(false);
    const [loading, setLoading] = useState(true);
    
    const saveTimerRef = useRef(null);
    const dataRef = useRef(data);
    const unsubscribersRef = useRef([]);
    dataRef.current = data;

    // 2. High Capacity Local Persistence (IndexedDB + localStorage fallback)
    const debouncedSave = useCallback((newData) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            // Save to IndexedDB (Primary)
            localDB.set('smees_data', newData).catch(err => console.error("IDB Save Error:", err));
            
            // Save to localStorage (Secondary/Fallback) - try-catch for quota errors
            try {
                localStorage.setItem('smees_data', JSON.stringify(newData));
            } catch (e) {
                // If localStorage is full, we don't worry because IndexedDB has it
            }
        }, 1000); 
    }, []);

    // 3. Initial Load from IndexedDB (Override localStorage if found)
    useEffect(() => {
        const loadIDB = async () => {
            try {
                const idbData = await localDB.get('smees_data');
                if (idbData) {
                    setData(idbData);
                }
            } catch (e) { console.error("IDB Load Error:", e); }
        };
        loadIDB();
    }, []);

    // 4. MANUAL CLOUD FETCH (Saves Reads - only run when user asks)
    const fetchUpdates = useCallback(async () => {
        setSyncing(true);
        try {
            const bizCollections = ['parties', 'items', 'staff', 'tasks', 'transactions', 'attendance', 'assets', 'workLogs'];
            const personalCols = [
                { key: 'personalTasks', col: 'tasks' },
                { key: 'personalTransactions', col: 'transactions' },
                { key: 'personalAccounts', col: 'accounts' }
            ];
            const settingsDocs = ['counters', 'categories', 'company', 'counters_26_27'];
            
            const updates = {};

            // One-time fetch for business data
            for (const col of bizCollections) {
                let q = collection(db, col);
                if (col === 'transactions') q = query(q, orderBy('date', 'desc'), limit(500));
                const snap = await getDocs(q);
                updates[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }

            // One-time fetch for personal data
            for (const { key, col } of personalCols) {
                let q = collection(personalDb, col);
                if (key === 'personalTransactions') q = query(q, orderBy('date', 'desc'), limit(500));
                const snap = await getDocs(q);
                updates[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }

            // One-time fetch for settings
            for (const sDoc of settingsDocs) {
                const snap = await getDocs(query(collection(db, "settings"), limit(1))); // or getDoc
                // (Using loop for brevity, but single getDoc is better)
            }
            // Better to just get individual docs for settings
            const sPromises = settingsDocs.map(id => getDocs(query(collection(db, "settings"), where('__name__', '==', id))));
            const sSnaps = await Promise.all(sPromises);
            sSnaps.forEach((snap, i) => {
                if (!snap.empty) updates[settingsDocs[i]] = snap.docs[0].data();
            });

            // One-time fetch for personal settings
            const pCatSnap = await getDocs(query(collection(personalDb, "settings"), where('__name__', '==', 'categories')));
            if (!pCatSnap.empty) updates.personalCategories = pCatSnap.docs[0].data();

            setData(prev => {
                const newData = { ...prev, ...updates };
                debouncedSave(newData);
                return newData;
            });
            
            setSyncing(false);
            return true;
        } catch (e) {
            console.error("Cloud Fetch Error:", e);
            setSyncing(false);
            return false;
        }
    }, [debouncedSave]);

    useEffect(() => {
        // App is ready instantly from local data. No listeners = 0 reads.
        setLoading(false); 
    }, []);

    return { data, setData, syncing, loading, fetchUpdates };
};
