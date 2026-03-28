import { useState, useEffect } from 'react';
import { onSnapshot, collection, query, orderBy, doc } from "firebase/firestore";
import { db } from '../services/firebase';
import { INITIAL_DATA } from '../utils/constants';

export const useFirebaseSync = () => {
    const [data, setData] = useState(() => {
        const cached = localStorage.getItem('smees_data');
        return cached ? JSON.parse(cached) : INITIAL_DATA;
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const collections = ['parties', 'items', 'staff', 'tasks', 'transactions', 'attendance'];
        const unsubs = [];

        // 1. Sync Business Collections
        collections.forEach(col => {
            const q = query(collection(db, col), orderBy('updatedAt', 'desc'));
            unsubs.push(onSnapshot(q, (snapshot) => {
                const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setData(prev => {
                    const newData = { ...prev, [col]: docs };
                    localStorage.setItem('smees_data', JSON.stringify(newData));
                    return newData;
                });
            }, (error) => {
                console.error(`Error syncing ${col}:`, error);
            }));
        });

        // 2. Sync Personal Data (My Vault) from a specific document
        // Original app used "companies/smees_pro_data"
        const personalDocRef = doc(db, "companies", "smees_pro_data");
        unsubs.push(onSnapshot(personalDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const personalData = docSnap.data();
                setData(prev => {
                    const newData = { 
                        ...prev, 
                        personalTasks: personalData.personalTasks || [],
                        personalTransactions: personalData.personalTransactions || [],
                        personalAccounts: personalData.personalAccounts || [],
                        personalCategories: personalData.personalCategories || prev.personalCategories,
                        // Update counters if present in this doc
                        counters: { ...prev.counters, ...(personalData.counters || {}) }
                    };
                    localStorage.setItem('smees_data', JSON.stringify(newData));
                    return newData;
                });
            }
        }, (error) => {
            console.error("Error syncing personal data:", error);
        }));

        // 4. Sync Settings (Counters, Categories, Company)
        const settingsDocs = ['counters', 'categories', 'company'];
        settingsDocs.forEach(sDoc => {
            const docRef = doc(db, "settings", sDoc);
            unsubs.push(onSnapshot(docRef, (snap) => {
                if (snap.exists()) {
                    setData(prev => {
                        const newData = { ...prev, [sDoc]: snap.data() };
                        localStorage.setItem('smees_data', JSON.stringify(newData));
                        return newData;
                    });
                }
            }, (error) => {
                console.error(`Error syncing settings/${sDoc}:`, error);
            }));
        });


        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    return { data, setData, loading };
};
