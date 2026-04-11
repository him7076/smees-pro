const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, query, where } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAQgIJYRf-QOWADeIKiTyc-lGL8PzOgWvI",
  authDomain: "smeestest.firebaseapp.com",
  projectId: "smeestest",
  storageBucket: "smeestest.firebasestorage.app",
  messagingSenderId: "1086297510582",
  appId: "1:1086297510582:web:7ae94f1d7ce38d1fef8c17"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function scanAndFix() {
    console.log("Starting FY Migration Analysis...");
    const txSnap = await getDocs(collection(db, "transactions"));
    const toFix = [];
    const threshold = '2026-04-01';

    txSnap.forEach(d => {
        const data = d.data();
        const id = d.id;
        // Check if date is in NEW year but ID is OLD format
        if (data.date >= threshold && id.includes('-') && !id.includes('2026-2027')) {
            toFix.push({ oldId: id, data });
        }
    });

    console.log(`Found ${toFix.length} transactions to migrate to FY 2026-2027.`);
    
    if (toFix.length === 0) {
        console.log("No transactions need fixing.");
        return;
    }

    // Sort by type and date to assign numbers sequentially
    toFix.sort((a,b) => a.data.date.localeCompare(b.data.date));

    const counters = { sales: 1, purchase: 1, expense: 1, payment: 1, estimate: 1 };

    for (const item of toFix) {
        const type = item.data.type;
        const num = counters[type]++;
        const prefixMap = { sales: 'Sales:', purchase: 'Purchase:', expense: 'Expense:', payment: 'Payment:', estimate: 'EST' };
        const newId = `${prefixMap[type] || 'TX'}2026-2027_${num}`;
        
        console.log(`Migrating: ${item.oldId} -> ${newId}`);
        
        // 1. Create new doc
        const newRef = doc(db, "transactions", newId);
        await setDoc(newRef, { ...item.data, id: newId, isMigratedFrom: item.oldId });
        
        // 2. Delete old doc
        await deleteDoc(doc(db, "transactions", item.oldId));
    }

    // 3. Update Firestore Counters
    await setDoc(doc(db, "settings", "counters_26_27"), counters, { merge: true });
    
    console.log("Migration Successful!");
}

scanAndFix().catch(console.error);
