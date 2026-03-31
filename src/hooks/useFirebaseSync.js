import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, doc } from "firebase/firestore";
import { db, personalDb } from '../services/firebase';
import { INITIAL_DATA } from '../utils/constants';

export const useFirebaseSync = () => {
    const [data, setData] = useState(() => {
        const cached = localStorage.getItem('smees_data');
        return cached ? JSON.parse(cached) : INITIAL_DATA;
    });

    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        setSyncing(true);
        const unsubscribers = [];

        // --- 1. BUSINESS REPOSITORY REAL-TIME SYNC ---
        const bizCollections = ['parties', 'items', 'staff', 'tasks', 'transactions', 'attendance'];
        
        bizCollections.forEach(colName => {
            const unsub = onSnapshot(collection(db, colName), (snapshot) => {
                const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setData(prev => {
                    const newData = { ...prev, [colName]: list };
                    localStorage.setItem('smees_data', JSON.stringify(newData));
                    return newData;
                });
            }, (error) => console.error(`Sync Error [${colName}]:`, error));
            unsubscribers.push(unsub);
        });

        // --- 2. PERSONAL VAULT REAL-TIME SYNC (Isolated Database) ---
        // We sync personal context separately from the Personal project
        const personalCollections = [
            { key: 'personalTasks', col: 'tasks' },
            { key: 'personalTransactions', col: 'transactions' },
            { key: 'personalAccounts', col: 'accounts' }
        ];

        personalCollections.forEach(({ key, col }) => {
            const unsub = onSnapshot(collection(personalDb, col), (snapshot) => {
                const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setData(prev => {
                    const newData = { ...prev, [key]: list };
                    localStorage.setItem('smees_data', JSON.stringify(newData));
                    return newData;
                });
            }, (error) => console.error(`Sync Error [Personal ${key}]:`, error));
            unsubscribers.push(unsub);
        });

        // --- 3. SETTINGS & METADATA SYNC ---
        const settingsDocs = ['counters', 'categories', 'company'];
        settingsDocs.forEach(sDoc => {
            const unsub = onSnapshot(doc(db, "settings", sDoc), (snapshot) => {
                if (snapshot.exists()) {
                    setData(prev => {
                        const newData = { ...prev, [sDoc]: snapshot.data() };
                        localStorage.setItem('smees_data', JSON.stringify(newData));
                        return newData;
                    });
                }
            }, (error) => console.error(`Sync Error [Settings ${sDoc}]:`, error));
            unsubscribers.push(unsub);
        });

        // --- 4. COUNTERS & CATEGORIES FOR PERSONAL (From Personal DB) ---
        const unsubPC = onSnapshot(doc(personalDb, "settings", "counters"), (snapshot) => {
            if (snapshot.exists()) {
                setData(prev => {
                    const newData = { ...prev, counters: { ...prev.counters, ...snapshot.data() } };
                    localStorage.setItem('smees_data', JSON.stringify(newData));
                    return newData;
                });
            }
        });
        unsubscribers.push(unsubPC);

        const unsubPCat = onSnapshot(doc(personalDb, "settings", "categories"), (snapshot) => {
            if (snapshot.exists()) {
                setData(prev => {
                    const newData = { ...prev, personalCategories: snapshot.data() };
                    localStorage.setItem('smees_data', JSON.stringify(newData));
                    return newData;
                });
            }
        });
        unsubscribers.push(unsubPCat);

        setSyncing(false);
        return () => unsubscribers.forEach(unsub => unsub());
    }, []);

    // Manual Re-sync (Optional, used as a fallback if needed)
    const syncData = useCallback(() => {
        window.location.reload(); 
    }, []);

    return { data, setData, syncing, syncData };
};
