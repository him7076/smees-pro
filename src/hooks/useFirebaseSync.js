import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from '../services/firebase';
import { INITIAL_DATA } from '../utils/constants';

export const useFirebaseSync = () => {
    const [data, setData] = useState(() => {
        const cached = localStorage.getItem('smees_data');
        return cached ? JSON.parse(cached) : INITIAL_DATA;
    });

    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const syncData = useCallback(async () => {
        setSyncing(true);
        try {
            const collections = ['parties', 'items', 'staff', 'tasks', 'transactions', 'attendance'];
            const newData = { ...data };

            // 1. Fetch Collections
            for (const col of collections) {
                const snapshot = await getDocs(collection(db, col));
                newData[col] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            }

            // 2. Fetch Personal Data (My Vault)
            const personalSnap = await getDoc(doc(db, "companies", "smees_pro_data"));
            if (personalSnap.exists()) {
                const p = personalSnap.data();
                newData.personalTasks = p.personalTasks || [];
                newData.personalTransactions = p.personalTransactions || [];
                newData.personalAccounts = p.personalAccounts || [];
                newData.personalCategories = p.personalCategories || newData.personalCategories;
                newData.counters = { ...newData.counters, ...(p.counters || {}) };
            }

            // 3. Fetch Settings
            const settingsDocs = ['counters', 'categories', 'company'];
            for (const sDoc of settingsDocs) {
                const sSnap = await getDoc(doc(db, "settings", sDoc));
                if (sSnap.exists()) newData[sDoc] = sSnap.data();
            }

            setData(newData);
            localStorage.setItem('smees_data', JSON.stringify(newData));
        } catch (error) {
            console.error("Sync Error:", error);
        } finally {
            setSyncing(false);
        }
    }, [data]);

    // Only do a one-time sync if there's no cached data or on request
    useEffect(() => {
        const cached = localStorage.getItem('smees_data');
        if (!cached) {
            syncData();
        }
    }, [syncData]);

    return { data, setData, loading, syncing, syncData };
};
