import React, { useState } from 'react';
import { auth, db } from '../../services/firebase';
import { signInAnonymously } from "firebase/auth";
import { query, collection, where, getDocs } from "firebase/firestore";

const LoginScreen = ({ setUser }) => {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const handleLogin = async () => {
      setErr('');
      
      // Master User Bypass Logic
      if(id === 'him23' && pass === 'Himanshu#3499sp') {
        const adminUser = { 
            name: 'Admin', 
            role: 'admin', 
            loginId: 'him23', 
            permissions: { canViewAccounts: true, canViewMasters: true, canViewTasks: true, canEditTasks: true, canViewDashboard: true } 
        };

        try {
            // Try background auth, but don't block
            await signInAnonymously(auth); 
            console.log("Cloud Auth Success");
        } catch (e) {
            console.warn("Cloud Auth Failed - Continuing in Local Mode", e);
        }

        // Re-enable sync for normal operation (it will only work if auth succeeded eventually)
        const cfg = JSON.parse(localStorage.getItem('smees_ui_config') || '{}');
        localStorage.setItem('smees_ui_config', JSON.stringify({ ...cfg, syncEnabled: true }));
        
        setUser(adminUser);
        localStorage.setItem('smees_user', JSON.stringify(adminUser));
        return;
    } 

    // Standard Staff Login (Requires Cloud)
    try {
          await signInAnonymously(auth);
          const q = query(collection(db, 'staff'), where('loginId', '==', id), where('password', '==', pass));
          const snap = await getDocs(q);
          if(!snap.empty) {
              const userData = snap.docs[0].data();
              const staffUser = { 
                  ...userData, 
                  role: userData.role ? userData.role.toLowerCase() : 'staff',
                  permissions: { canViewAccounts: false, canViewMasters: false, canViewTasks: true, canEditTasks: false, canViewDashboard: true, ...userData.permissions } 
              };
              
              const cfg = JSON.parse(localStorage.getItem('smees_ui_config') || '{}');
              localStorage.setItem('smees_ui_config', JSON.stringify({ ...cfg, syncEnabled: true }));

              setUser(staffUser);
              localStorage.setItem('smees_user', JSON.stringify(staffUser));
          } else {
              setErr("Invalid ID or Password");
          }
      } catch (e) {
          console.error(e);
          setErr("Cloud connection error. Tip: Enable 'Anonymous Auth' in Firebase Console.");
      }
  };

  return (
      <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-6 font-sans">
          <div className="w-full max-w-sm">
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center text-white text-4xl font-black italic shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">S</div>
              </div>
              <h1 className="text-3xl font-extrabold text-center mb-2 text-gray-900">SMEES Pro</h1>
              <p className="text-center text-gray-500 mb-8 font-medium">Empowering your enterprise</p>
              
              <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase ml-1 mb-1">Login ID</label>
                    <input 
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" 
                        placeholder="Enter your ID" 
                        value={id} 
                        onChange={e=>setId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase ml-1 mb-1">Password</label>
                    <input 
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" 
                        type="password" 
                        placeholder="••••••••" 
                        value={pass} 
                        onChange={e=>setPass(e.target.value)}
                    />
                  </div>
              </div>

              {err && <p className="text-red-500 text-sm mt-4 text-center font-bold animate-pulse">{err}</p>}
              
              <button 
                onClick={handleLogin} 
                className="w-full mt-8 p-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
              >
                Sign In
              </button>
              
              <p className="mt-8 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                Cloud Service: <span className="text-emerald-500 font-black">● Connected</span>
              </p>
          </div>
      </div>
  );
};

export default LoginScreen;
