import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, personalDb } from "../services/firebase";
import { getNextId } from "../utils/helpers";

export const useDatabase = (data, setData) => {
    
    // Helper to determine which DB and target collection to use
    const getTarget = (collectionName) => {
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
            const isNew = !record.id;
            let finalRecord = { ...record };
            let nextCounters = data.counters;

            const { targetDb, targetCol, isPersonal } = getTarget(collectionName);

            // 1. ID Generation Logic
            if (isNew) {
                const { id, nextCounters: updatedCounters, isNewFY } = getNextId(data, type, record.date);
                finalRecord.id = id;
                finalRecord.createdAt = new Date().toISOString();
                finalRecord.isNewFY = isNewFY; // Tag it for counter path resolution
                nextCounters = updatedCounters;
            }
            finalRecord.updatedAt = new Date().toISOString();

            // 2. Update Local State (Optimistic) using functional state to prevent stale closures
            setData(prevData => {
                const updatedList = isNew 
                    ? [finalRecord, ... (prevData[collectionName] || [])] 
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

            // 3. Update Firestore in correct DB
            await setDoc(doc(targetDb, targetCol, finalRecord.id), finalRecord, { merge: true });
            
            // 4. Update appropriate counters
            if (isNew) {
                const counterFileName = finalRecord.isNewFY ? "counters_26_27" : "counters";
                const counterPath = isPersonal ? [personalDb, "settings", "counters"] : [db, "settings", counterFileName];
                await setDoc(doc(...counterPath), nextCounters, { merge: true });
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

            // 1. Update Local State using functional state
            setData(prevData => {
                const updatedList = (prevData[collectionName] || []).filter(r => r.id !== id);
                const newData = { ...prevData, [collectionName]: updatedList };
                localStorage.setItem('smees_data', JSON.stringify(newData));
                return newData;
            });

            // 2. Update Firestore
            await deleteDoc(doc(targetDb, targetCol, id));

        } catch (error) {
            console.error("Error deleting record:", error);
            throw error;
        }
    };

    return { saveRecord, deleteRecord };
};
