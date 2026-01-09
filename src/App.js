import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, getDoc, setDoc, doc, query, where, enableIndexedDbPersistence, onSnapshot 
} from "firebase/firestore";
import { 
  LayoutDashboard, ReceiptText, CheckSquare, Users, Package, LogOut, Settings, RefreshCw, AlertTriangle, CheckCircle2, AlertCircle 
} from 'lucide-react';

// --- CUSTOM IMPORTS ---
import { db } from './firebase'; // Step 1 wali file
import { INITIAL_DATA, getNextId, cleanData } from './utils'; // Step 2 wali file

// --- COMPONENTS IMPORTS ---
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import TaskModule from './components/TaskModule';
import { ItemForm, PartyForm, StaffForm, CompanyForm, TransactionForm, TaskForm } from './components/Forms';
import { Modal } from './components/UIComponents';
import { MasterList, StaffDetailView } from './components/MasterModule';
import { 
    ManualAttendanceModal, ConvertTaskModal, StatementModal, 
    CashAdjustmentModal, TimeLogModal, TimeLogDetailsModal 
} from './components/AppModals';

export default function App() {
  // --- 1. STATE MANAGEMENT ---
  const [user, setUser] = useState(null);
  const [data, setData] = useState(INITIAL_DATA);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mastersView, setMastersView] = useState(null);
  const [modal, setModal] = useState({ type: null, data: null });
  const [toast, setToast] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Specific UI States
  const [listFilter, setListFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [partyFilter, setPartyFilter] = useState(null);
  const [listPaymentMode, setListPaymentMode] = useState(null);
  const [showPnlReport, setShowPnlReport] = useState(false);
  
  // Modal States
  const [timerConflict, setTimerConflict] = useState(null);
  const [convertModal, setConvertModal] = useState(null);
  const [editingTimeLog, setEditingTimeLog] = useState(null);
  const [manualAttModal, setManualAttModal] = useState(null); 
  const [adjustCashModal, setAdjustCashModal] = useState(null);
  const [selectedTimeLog, setSelectedTimeLog] = useState(null);
  const [statementModal, setStatementModal] = useState(null);

  // --- 2. INITIALIZATION & SYNC ---
  useEffect(() => {
    const startPersistence = async () => {
        try { await enableIndexedDbPersistence(db); } catch(e) { console.log("Persistence:", e.code); }
    };
    startPersistence();

    const savedUser = localStorage.getItem('smees_user');
    if (savedUser) setUser(JSON.parse(savedUser));
    
    const savedData = localStorage.getItem('smees_data');
    if (savedData) setData(JSON.parse(savedData));
  }, []);

  // --- 3. SMART SYNC FUNCTION ---
  const syncData = async (isBackground = false) => {
    if (!user) return;
    if (!isBackground) setLoading(true);

    try {
      const localStr = localStorage.getItem('smees_data');
      let currentData = localStr ? JSON.parse(localStr) : { ...INITIAL_DATA };
      const lastSyncTime = localStorage.getItem('smees_last_sync');
      
      const isFirstRun = !lastSyncTime || !currentData.transactions || currentData.transactions.length === 0;

      const collectionsToSync = [
         { name: 'staff' }, { name: 'tasks' }, { name: 'attendance' },
         { name: 'parties' }, { name: 'items' }, { name: 'transactions' }
      ];

      if (user.role !== 'admin') collectionsToSync.pop(); 

      for (const col of collectionsToSync) {
          let q;
          if (!isFirstRun && lastSyncTime) {
             q = query(collection(db, col.name), where("updatedAt", ">", lastSyncTime));
          } else {
             q = query(collection(db, col.name));
          }

          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
              const fetchedDocs = snapshot.docs.map(doc => doc.data());
              const existingArray = currentData[col.name] || [];
              const existingMap = new Map(existingArray.map(item => [item.id, item]));
              fetchedDocs.forEach(item => existingMap.set(item.id, item));
              currentData[col.name] = Array.from(existingMap.values());
          }
      }

      const companySnap = await getDocs(collection(db, "settings"));
      companySnap.forEach(doc => {
        if (doc.id === 'company') currentData.company = doc.data();
        if (doc.id === 'counters') currentData.counters = { ...INITIAL_DATA.counters, ...doc.data() };
        if (doc.id === 'categories') currentData.categories = { ...INITIAL_DATA.categories, ...doc.data() };
      });

      const now = new Date().toISOString();
      localStorage.setItem('smees_data', JSON.stringify(currentData));
      localStorage.setItem('smees_last_sync', now);
      setData(currentData);
      
      if (!isBackground) showToast("Data Synced Successfully");

    } catch (error) {
      console.error("Sync Error:", error);
      // Silent fail allowed in background, else show toast
      if (!isBackground) showToast("Sync Failed (Check Internet)", "error");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Auto Sync on Load
  useEffect(() => { if (user) syncData(true); }, [user]);

  // --- 4. CRUD OPERATIONS ---
  const saveRecord = async (collectionName, record, idType) => {
    if (!user) return;
    let newData = { ...data };
    let finalId = record.id;
    let newCounters = null;
    const timestamp = new Date().toISOString();

    if (record.id) {
      // Edit
      record = { ...record, updatedAt: timestamp };
      newData[collectionName] = data[collectionName].map(r => r.id === record.id ? record : r);
      
      // Update Task if converted from it
      if (collectionName === 'transactions' && record.type === 'sales' && record.convertedFromTask) {
         const task = newData.tasks.find(t => t.id === record.convertedFromTask);
         if (task) {
           task.itemsUsed = record.items.map(i => ({ itemId: i.itemId, qty: i.qty, price: i.price, buyPrice: i.buyPrice, description: i.description }));
           const updatedTask = { ...task, updatedAt: timestamp }; 
           newData.tasks = newData.tasks.map(t => t.id === task.id ? updatedTask : t);
           setDoc(doc(db, "tasks", task.id), updatedTask);
         }
      }
    } else {
      // Create
      const { id, nextCounters } = getNextId(data, idType);
      record = { ...record, id, createdAt: timestamp, updatedAt: timestamp };
      newData[collectionName] = [...data[collectionName], record];
      newData.counters = nextCounters;
      newCounters = nextCounters;
      finalId = id;
    }

    const safeRecord = cleanData(record);
    setData(newData);
    setModal({ type: null, data: null });
    showToast("Saved Successfully");

    try {
        await setDoc(doc(db, collectionName, finalId.toString()), safeRecord);
        if (newCounters) await setDoc(doc(db, "settings", "counters"), newCounters);
    } catch (e) { console.error(e); showToast("Save Error (Saved Locally)", "error"); }
    
    return finalId;
  };

  const showToast = (message, type = 'success') => { 
      setToast({ message, type }); 
      setTimeout(() => setToast(null), 3000); 
  };

  const pushHistory = () => window.history.pushState({ modal: true }, '');
  
  const handleCloseUI = () => { 
      // Reset all viewing states
      setViewDetail(null); 
      setModal({type:null}); 
      setConvertModal(null);
      setEditingTimeLog(null);
      setManualAttModal(null);
      setAdjustCashModal(null);
      setSelectedTimeLog(null);
      setStatementModal(null);
      setShowPnlReport(false);
      window.history.back(); 
  };

  // Back Button Handler
  useEffect(() => {
      const handlePopState = () => {
          if (modal.type) setModal({ type: null, data: null });
          else if (statementModal) setStatementModal(null);
          else if (viewDetail) setViewDetail(null);
          else if (mastersView) { setMastersView(null); setPartyFilter(null); }
          else if (convertModal) setConvertModal(null);
          else if (showPnlReport) setShowPnlReport(false);
          else if (timerConflict) setTimerConflict(null);
          else if (editingTimeLog) setEditingTimeLog(null);
          else if (manualAttModal) setManualAttModal(null);
          else if (adjustCashModal) setAdjustCashModal(null);
          else if (selectedTimeLog) setSelectedTimeLog(null);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [modal, viewDetail, mastersView, convertModal, showPnlReport, timerConflict, editingTimeLog, statementModal, manualAttModal, adjustCashModal, selectedTimeLog]);


  // --- 5. RENDER LOGIC ---
  if (!user) return <LoginScreen setUser={setUser} />;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans select-none">
      {/* Toast */}
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>{toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}<span className="text-sm font-bold">{toast.message}</span></div>}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md px-4 py-3 border-b flex justify-between items-center">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic">S</div><span className="font-black text-gray-800 tracking-tight">SMEES Pro</span></div>
        <div className="flex gap-3">
            <button onClick={() => syncData(false)} className={`p-2 hover:bg-gray-100 rounded-full ${loading ? 'animate-spin' : ''}`}><RefreshCw size={20} className="text-blue-600" /></button>
            <button onClick={() => { pushHistory(); setModal({ type: 'company' }); }} className="p-2 hover:bg-gray-100 rounded-full"><Settings size={20} className="text-gray-500" /></button>
        </div>
      </div>

      <main className="max-w-xl mx-auto p-4">
        {loading && <div className="text-center text-xs text-blue-500 py-2">Syncing latest changes...</div>}
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
            <Dashboard 
                data={data} 
                pushHistory={pushHistory} 
                setModal={setModal} 
                setShowPnlReport={setShowPnlReport}
                setAdjustCashModal={setAdjustCashModal}
                setListFilter={setListFilter}
                setListPaymentMode={setListPaymentMode}
                setActiveTab={setActiveTab}
                setMastersView={setMastersView}
                setPartyFilter={setPartyFilter}
            />
        )}
        
        {/* ACCOUNTING TAB */}
        {activeTab === 'accounting' && (
            <TransactionList 
                data={data} 
                listFilter={listFilter} 
                categoryFilter={categoryFilter} 
                listPaymentMode={listPaymentMode} 
                pushHistory={pushHistory} 
                setViewDetail={setViewDetail} 
            />
        )}
        
        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
            <TaskModule 
                data={data} 
                user={user} 
                pushHistory={pushHistory} 
                setModal={setModal} 
                setViewDetail={setViewDetail} 
            />
        )}
        
        {/* STAFF TAB */}
        {activeTab === 'staff' && (
             <div className="space-y-4">
                 <div className="flex justify-between items-center">
                     <h2 className="text-xl font-bold text-gray-800">Staff</h2>
                     <button onClick={() => { localStorage.removeItem('smees_user'); setUser(null); }} className="p-2 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 font-bold text-xs"><LogOut size={18} /> Logout</button>
                 </div>
                 <MasterList title="Team" collection="staff" type="staff" data={data} onRowClick={(s) => { pushHistory(); setViewDetail({type: 'staff', id: s.id}); }} />
             </div>
        )}

        {/* MASTERS TAB */}
        {activeTab === 'masters' && (
             <div className="space-y-6">
                {mastersView === null ? (
                    <div className="grid grid-cols-2 gap-4">
                         <button onClick={() => { pushHistory(); setMastersView('items'); }} className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-100"><Package size={32} className="text-blue-600"/><span className="font-bold text-blue-800">Items</span></button>
                         <button onClick={() => { pushHistory(); setMastersView('parties'); }} className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-emerald-100"><Users size={32} className="text-emerald-600"/><span className="font-bold text-emerald-800">Parties</span></button>
                    </div>
                ) : (
                    <div>
                        <button onClick={() => setMastersView(null)} className="mb-4 font-bold text-gray-500">Back</button>
                        {mastersView === 'items' && <MasterList title="Items" collection="items" type="item" data={data} onRowClick={(i) => { pushHistory(); setViewDetail({type: 'item', id: i.id}); }} />}
                        {mastersView === 'parties' && <MasterList title="Parties" collection="parties" type="party" data={data} onRowClick={(p) => { pushHistory(); setViewDetail({type: 'party', id: p.id}); }} />}
                    </div>
                )}
             </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-2 py-2 flex justify-around items-center z-50 safe-area-bottom shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        {[{ id: 'dashboard', icon: <LayoutDashboard />, label: 'Home' }, { id: 'accounting', icon: <ReceiptText />, label: 'Accounts' }, { id: 'tasks', icon: <CheckSquare />, label: 'Tasks' }, { id: 'masters', icon: <Package />, label: 'Masters' }, { id: 'staff', icon: <Users />, label: 'Staff' }].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMastersView(null); setListFilter('all'); }} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === tab.id ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}>{tab.icon}<span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span></button>
        ))}
      </nav>

      {/* FORMS MODAL */}
      <Modal isOpen={!!modal.type} onClose={() => setModal({type:null})} title={modal.type ? (modal.data ? `Edit ${modal.type}` : `New ${modal.type}`) : ''}>
         {modal.type === 'item' && <ItemForm record={modal.data} saveRecord={saveRecord} />}
         {modal.type === 'party' && <PartyForm record={modal.data} saveRecord={saveRecord} />}
         {modal.type === 'staff' && <StaffForm record={modal.data} saveRecord={saveRecord} />}
         {modal.type === 'company' && <CompanyForm record={modal.data} setData={setData} data={data} setModal={setModal} />}
         {modal.type === 'task' && <TaskForm record={modal.data} saveRecord={saveRecord} data={data} />}
         {['sales', 'estimate', 'purchase', 'expense', 'payment'].includes(modal.type) && <TransactionForm type={modal.type} record={modal.data} saveRecord={saveRecord} data={data} />}
      </Modal>

      {/* ACTION MODALS (Render conditionally to keep DOM light) */}
      {timerConflict && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center"><AlertTriangle className="text-yellow-600 mx-auto mb-4" size={32}/><h3 className="font-bold">Timer Conflict</h3><p className="text-sm my-2">Another task is active.</p><button onClick={() => setTimerConflict(null)} className="p-2 bg-gray-100 rounded font-bold">Dismiss</button></div></div>}
      
      {convertModal && <ConvertTaskModal task={convertModal} onClose={() => setConvertModal(null)} saveRecord={saveRecord} setViewDetail={setViewDetail} handleCloseUI={handleCloseUI} />}
      {editingTimeLog && <TimeLogModal editingTimeLog={editingTimeLog} setEditingTimeLog={setEditingTimeLog} data={data} setData={setData} handleCloseUI={handleCloseUI} showToast={showToast} />}
      {statementModal && <StatementModal isOpen={!!statementModal} onClose={() => setStatementModal(null)} />}
      {manualAttModal && <ManualAttendanceModal manualAttModal={manualAttModal} setManualAttModal={setManualAttModal} data={data} setData={setData} handleCloseUI={handleCloseUI} showToast={showToast} />}
      {adjustCashModal && <CashAdjustmentModal adjustCashModal={adjustCashModal} setAdjustCashModal={setAdjustCashModal} saveRecord={saveRecord} handleCloseUI={handleCloseUI} />}
      {selectedTimeLog && <TimeLogDetailsModal selectedTimeLog={selectedTimeLog} setSelectedTimeLog={setSelectedTimeLog} handleCloseUI={handleCloseUI} saveRecord={saveRecord} setEditingTimeLog={setEditingTimeLog} />}

      {/* DETAIL VIEW */}
      {viewDetail && viewDetail.type === 'staff' && (
          <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
                <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                    <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
                    <h2 className="font-bold text-lg">Staff Details</h2>
                    <div className="w-9"></div>
                </div>
               <StaffDetailView staff={data.staff.find(s=>s.id===viewDetail.id)} data={data} setData={setData} user={user} pushHistory={pushHistory} setManualAttModal={setManualAttModal} showToast={showToast} />
          </div>
      )}
    </div>
  );
}