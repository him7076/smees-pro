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
  Maximize2,
  Minimize2
} from 'lucide-react';

import { signOut } from "firebase/auth";
import { auth } from '../../services/firebase';

const AppLayout = ({ children, user, uiConfig = { isCompact: false }, onToggleCompact }) => {
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
        { to: '/vault', icon: <Lock size={20}/>, label: 'Vault' },
    ];

    if (user?.role === 'admin') {
        navItems.splice(3, 0, { to: '/masters', icon: <Package size={20}/>, label: 'Masters' });
    }

    return (
        <div className={`min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 ${uiConfig.isCompact ? 'ui-compact' : ''}`}>
            {/* Sidebar for Desktop */}
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
                    <button 
                        onClick={onToggleCompact}
                        className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
                    >
                        {uiConfig.isCompact ? <Maximize2 size={20}/> : <Minimize2 size={20}/>} {uiConfig.isCompact ? 'Standard' : 'Compact UI'}
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-rose-500 hover:bg-rose-50 transition-all">
                        <LogOut size={20}/> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-h-screen relative">
                {/* Header for Mobile */}
                <header className="md:hidden bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-40 backdrop-blur-xl bg-white/80">
                    <div className="flex items-center gap-3">
                         <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Package className="text-white" size={12}/>
                        </div>
                        <h1 className="text-[12px] font-black tracking-tight text-slate-900 leading-none">SMEES<span className="text-blue-600">PRO</span></h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={onToggleCompact} 
                            className="p-2 bg-slate-100 text-slate-400 rounded-lg animate-in fade-in"
                        >
                            {uiConfig.isCompact ? <Maximize2 size={16}/> : <Minimize2 size={16}/>}
                        </button>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="flex items-center gap-1.5 p-2 bg-blue-50 text-blue-600 rounded-lg active:scale-90 transition-all"
                        >
                            <RefreshCw size={12} className="animate-spin-slow"/>
                            <span className="text-[8px] font-black uppercase tracking-widest">Sync</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 p-4 md:p-10 pb-32 md:pb-10 max-w-7xl mx-auto w-full">
                    {children}
                </div>

                {/* Bottom Nav for Mobile */}
                <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[32px] p-2 flex justify-around items-center shadow-2xl z-50">
                    {navItems.map(item => (
                        <NavLink 
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 scale-110' : 'text-slate-400'}`}
                        >
                            {item.icon}
                        </NavLink>
                    ))}
                    <button onClick={handleLogout} className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl text-rose-500">
                        <LogOut size={24}/>
                    </button>
                </nav>
            </main>
        </div>
    );
};

export default AppLayout;
