import React, { useState } from 'react';
import { auth, db } from '../../services/firebase';
import { signInAnonymously } from "firebase/auth";
import { query, collection, where, getDocs } from "firebase/firestore";

const LoginScreen = ({ setUser }) => {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const handleLogin = async (isRescue = false) => {
      if (isRescue) {
          // Disable sync to avoid firebase errors
          const cfg = JSON.parse(localStorage.getItem('smees_ui_config') || '{}');
          localStorage.setItem('smees_ui_config', JSON.stringify({ ...cfg, syncEnabled: false }));
          
          const adminUser = { name: 'Rescue Admin', role: 'admin', loginId: 'rescue', permissions: { canViewAccounts: true, canViewMasters: true, canViewTasks: true, canEditTasks: true, canViewDashboard: true }, isOffline: true };
          setUser(adminUser);
          localStorage.setItem('smees_user', JSON.stringify(adminUser));
          return;
      }

      if(id === 'him23' && pass === 'Himanshu#3499sp') {
        try {
            await signInAnonymously(auth); 
            const adminUser = { name: 'Admin', role: 'admin', loginId: 'him23', permissions: { canViewAccounts: true, canViewMasters: true, canViewTasks: true, canEditTasks: true, canViewDashboard: true } };
            setUser(adminUser);
            localStorage.setItem('smees_user', JSON.stringify(adminUser));
        } catch (e) {
            console.error(e);
            setErr("Login Failed: Project Suspended. Please use 'Rescue Offline Mode'.");
        }
    } else {
          try {
              await signInAnonymously(auth);
              const q = query(collection(db, 'staff'), where('loginId', '==', id), where('password', '==', pass));
              const snap = await getDocs(q);
              if(!snap.empty) {
                  const userData = snap.docs[0].data();
                  const defaults = { canViewAccounts: false, canViewMasters: false, canViewTasks: true, canEditTasks: false, canViewDashboard: true };
                  const staffUser = { 
                      ...userData, 
                      role: userData.role ? userData.role.toLowerCase() : 'staff',
                      permissions: { ...defaults, ...userData.permissions } 
                  };
                  setUser(staffUser);
                  localStorage.setItem('smees_user', JSON.stringify(staffUser));
              } else {
                  setErr("Invalid ID or Password");
              }
          } catch (e) {
              console.error(e);
              setErr("Project Suspended or Network Error. Use 'Rescue Offline Mode'.");
          }
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
                onClick={() => handleLogin(true)} 
                className="w-full mt-4 p-4 bg-orange-100 text-orange-700 rounded-2xl font-black text-sm uppercase tracking-widest border-2 border-orange-200 hover:bg-orange-200 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                🚨 Rescue Offline Mode
              </button>
              
              <p className="mt-8 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                Cloud Service: <span className="text-red-500">Suspended / Error</span>
              </p>
              
              <p className="mt-4 text-center text-xs text-gray-300 font-medium italic px-4">
                "Rescue Mode uses your last locally saved data. Any changes won't sync to cloud until project is restored."
              </p>
          </div>
      </div>
  );
};

export default LoginScreen;
