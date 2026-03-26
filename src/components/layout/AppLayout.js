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
  Package
} from 'lucide-react';
import { signOut } from "firebase/auth";
import { auth } from '../../services/firebase';

const AppLayout = ({ children, user }) => {
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
        { to: '/', icon: <LayoutDashboard size={24}/>, label: 'Home' },
        { to: '/accounts', icon: <ReceiptText size={24}/>, label: 'Accounts' },
        { to: '/tasks', icon: <CheckSquare size={24}/>, label: 'Tasks' },
        { to: '/vault', icon: <Lock size={24}/>, label: 'Vault' },
    ];

    if (user?.role === 'admin') {
        navItems.splice(3, 0, { to: '/masters', icon: <Package size={24}/>, label: 'Masters' });
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
            {/* Sidebar for Desktop */}
            <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200 h-screen sticky top-0 p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-12">
                    <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Package className="text-white" size={20}/>
                    </div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900">SMEES<span className="text-blue-600">PRO</span></h1>
                </div>

                <nav className="flex-1 space-y-2">
                    {navItems.map(item => (
                        <NavLink 
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 scale-[1.02]' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                        >
                            {item.icon}
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="pt-8 mt-8 border-t border-slate-100 space-y-2">
                    <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">
                        <Settings size={24}/> Settings
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-rose-500 hover:bg-rose-50 transition-all">
                        <LogOut size={24}/> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-h-screen relative">
                {/* Header for Mobile */}
                <header className="md:hidden bg-white border-b border-slate-100 px-6 py-5 flex justify-between items-center sticky top-0 z-40 backdrop-blur-xl bg-white/80">
                    <div className="flex items-center gap-2">
                         <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Package className="text-white" size={14}/>
                        </div>
                        <h1 className="text-sm font-black tracking-tight text-slate-900">SMEES<span className="text-blue-600">PRO</span></h1>
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
