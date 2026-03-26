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
        const collections = ['parties', 'items', 'staff', 'tasks', 'transactions'];
        const unsubs = [];

        collections.forEach(col => {
            const q = query(collection(db, col), orderBy('updatedAt', 'desc'));
            unsubs.push(onSnapshot(q, (snapshot) => {
                const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setData(prev => {
                    const newData = { ...prev, [col]: docs };
                    localStorage.setItem('smees_data', JSON.stringify(newData));
                    return newData;
                });
            }));
        });

        // Sync Categories/Settings
        unsubs.push(onSnapshot(doc(db, "settings", "categories"), (docSnap) => {
            if (docSnap.exists()) {
                setData(prev => {
                    const newData = { ...prev, categories: docSnap.data() };
                    localStorage.setItem('smees_data', JSON.stringify(newData));
                    return newData;
                });
            }
        }));

        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    return { data, setData, loading };
};
