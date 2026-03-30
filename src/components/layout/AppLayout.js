import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ReceiptText, 
  CheckSquare, 
  Users, 
  Lock,
  LogOut,
  Settings,
  Package,
  RefreshCw,
  Menu,
  ChevronRight
} from 'lucide-react';

import { signOut } from "firebase/auth";
import { auth } from '../../services/firebase';

const AppLayout = ({ children, user, uiConfig = { isCompact: false }, onToggleCompact, mode = 'business', onToggleMode, syncing, onSync }) => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (e) {
            console.error("Logout failed", e);
        }
    };

    const navItems = [
        { to: '/', icon: <LayoutDashboard size={20}/>, label: 'Home' },
        { to: '/accounts', icon: <ReceiptText size={20}/>, label: 'Accounts' },
        { to: '/tasks', icon: <CheckSquare size={20}/>, label: 'Tasks' },
    ];

    if (user?.role === 'admin') {
        navItems.splice(3, 0, { to: '/masters', icon: <Package size={20}/>, label: 'Masters' });
    }

    return (
        <div className={`min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 ${uiConfig.isCompact ? 'ui-compact' : ''}`}>
            {/* Sidebar for Desktop */}
            {mode === 'business' && (
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0 p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Package className="text-white" size={16}/>
                    </div>
                    <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">SMEES<span className="text-blue-600">PRO</span></h1>
                </div>

                <nav className="flex-1 space-y-1">
                    {navItems.map(item => (
                        <NavLink 
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `flex items-center gap-4 px-4 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 scale-[1.02]' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                        >
                            {item.icon}
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="pt-8 mt-8 border-t border-slate-100 space-y-4">
                    <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-rose-500 hover:bg-rose-50 transition-all">
                        <LogOut size={20}/> Logout
                    </button>
                </div>
            </aside>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-h-screen relative">
                {/* Header for Mobile */}
                <header className="bg-white border-b border-slate-100 px-4 py-3 flex justify-between items-center sticky top-0 z-40 backdrop-blur-xl bg-white/80">
                    <div className="flex items-center gap-3">
                         <button className="p-2 bg-slate-50 rounded-xl text-slate-400 active:scale-95 transition-all">
                             <Menu size={18}/>
                         </button>
                         <h1 className="hidden sm:block text-[12px] font-black tracking-tight text-slate-900 leading-none">SMEES<span className="text-blue-600">PRO</span></h1>
                    </div>

                    {/* Mode Toggle Switcher - Top Middle */}
                    <div className="bg-slate-100 p-1 rounded-full flex items-center shadow-inner relative">
                        <div className={`absolute h-7 w-[48%] bg-white rounded-full shadow-md transition-all duration-500 ease-out ${mode === 'personal' ? 'translate-x-[104%]' : 'translate-x-[2%]'}`}></div>
                        <button 
                            onClick={()=>onToggleMode('business')}
                            className={`relative z-10 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${mode === 'business' ? 'text-blue-600' : 'text-slate-400'}`}
                        >
                            Business
                        </button>
                        <button 
                            onClick={()=>onToggleMode('personal')}
                            className={`relative z-10 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${mode === 'personal' ? 'text-blue-600' : 'text-slate-400'}`}
                        >
                            Personal
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={onSync} 
                            disabled={syncing}
                            className={`p-2 rounded-xl active:scale-90 transition-all flex items-center gap-2 ${syncing ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}
                        >
                            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''}/>
                            {syncing && <span className="text-[8px] font-black uppercase tracking-widest hidden md:block">Syncing...</span>}
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="p-2 bg-rose-50 text-rose-600 rounded-xl active:scale-90 transition-all"
                        >
                            <LogOut size={16}/>
                        </button>
                    </div>
                </header>

                <div className="flex-1 p-4 md:p-10 pb-32 md:pb-10 max-w-7xl mx-auto w-full">
                    {children}
                </div>

                {/* Bottom Nav for Mobile */}
                {mode === 'business' && (
                <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[32px] p-2 flex justify-around items-center shadow-2xl z-50">
                    {navItems.map(item => (
                        <NavLink 
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all gap-0.5 ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 scale-105' : 'text-slate-400'}`}
                        >
                            {item.icon}
                            <span className="text-[7px] font-black uppercase tracking-[0.1em]">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
                )}
            </main>
        </div>
    );
};


export default AppLayout;
