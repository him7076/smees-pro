import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, personalDb } from "../services/firebase";
import { getNextId } from "../utils/helpers";

// Check if sync is enabled
const isSyncEnabled = () => {
    try {
        const cfg = JSON.parse(localStorage.getItem('smees_ui_config') || '{}');
        return cfg.syncEnabled !== false; // default true
    } catch { return true; }
};

export const useDatabase = (data, setData) => {
    
    const getTarget = (collectionName) => {
        if (!collectionName) return { targetDb: db, targetCol: 'unknown', isPersonal: false };
        if (collectionName.startsWith('personal')) {
            const map = {
                'personalTasks': 'tasks',
                'personalTransactions': 'transactions',
                'personalAccounts': 'accounts'
            };
            return { targetDb: personalDb, targetCol: map[collectionName] || collectionName, isPersonal: true };
        }
        return { targetDb: db, targetCol: collectionName, isPersonal: false };
    };

    const saveRecord = async (collectionName, record, type) => {
        try {
            if (!data) throw new Error("Database not ready.");
            
            const isNew = !record.id;
            let finalRecord = { ...record };
            let nextCounters = data.counters || {};

            const { targetDb, targetCol, isPersonal } = getTarget(collectionName);

            // 1. ID Generation (always local)
            if (isNew) {
                const { id, nextCounters: updatedCounters, isNewFY } = getNextId(data, type, record.date);
                finalRecord.id = id;
                finalRecord.createdAt = new Date().toISOString();
                finalRecord.isNewFY = isNewFY; 
                nextCounters = updatedCounters;
            }
            finalRecord.updatedAt = new Date().toISOString();

            // 2. Update Local State (ALWAYS runs, instant)
            setData(prevData => {
                if (!prevData) return prevData;
                const updatedList = isNew 
                    ? [finalRecord, ...(prevData[collectionName] || [])] 
                    : (prevData[collectionName] || []).map(r => r.id === finalRecord.id ? finalRecord : r);
                
                const counterKey = finalRecord.isNewFY ? 'counters_26_27' : 'counters';
                const newData = { 
                    ...prevData, 
                    [collectionName]: updatedList,
                    ...(isNew ? { [counterKey]: nextCounters } : {})
                };
                
                localStorage.setItem('smees_data', JSON.stringify(newData));
                return newData;
            });

            // 3. Firestore Write (ONLY if sync is ON)
            if (isSyncEnabled()) {
                await setDoc(doc(targetDb, targetCol, finalRecord.id), finalRecord, { merge: true });
                
                if (isNew) {
                    const counterFileName = finalRecord.isNewFY ? "counters_26_27" : "counters";
                    const counterPath = isPersonal ? [personalDb, "settings", "counters"] : [db, "settings", counterFileName];
                    await setDoc(doc(...counterPath), nextCounters, { merge: true });
                }
            }

            return finalRecord.id;
        } catch (error) {
            console.error("Error saving record:", error);
            throw error;
        }
    };

    const deleteRecord = async (collectionName, id) => {
        try {
            if (!window.confirm("Are you sure you want to delete this record?")) return;
            const { targetDb, targetCol } = getTarget(collectionName);

            // Local delete (ALWAYS runs)
            setData(prevData => {
                if (!prevData) return prevData;
                const updatedList = (prevData[collectionName] || []).filter(r => r.id !== id);
                const newData = { ...prevData, [collectionName]: updatedList };
                localStorage.setItem('smees_data', JSON.stringify(newData));
                return newData;
            });

            // Firestore delete (ONLY if sync is ON)
            if (isSyncEnabled()) {
                await deleteDoc(doc(targetDb, targetCol, id));
            }
        } catch (error) {
            console.error("Error deleting record:", error);
            throw error;
        }
    };

    return { saveRecord, deleteRecord };
};
