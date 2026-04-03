import React from 'react';
import { RefreshCw, FileText, Settings, X, ChevronRight, ShieldCheck, Database } from 'lucide-react';

const SystemMenu = ({ setModal, onClose }) => {
    const menuItems = [
        { 
            id: 'categories', 
            label: 'Manage Categories', 
            desc: 'Review and refine your business ledger tags',
            icon: <TrendingUp size={20} className="text-emerald-600"/>,
            onClick: () => setModal({ type: 'settings' })
        },
        { 
            id: 'accounts', 
            label: 'Manage Accounts', 
            desc: 'Configure storage vaults and cash/bank anchors',
            icon: <Landmark size={20} className="text-indigo-600"/>,
            onClick: () => setModal({ type: 'accountSettings' })
        },
        { 
            id: 'backup', 
            label: 'Backup & Restore', 
            desc: 'Secure your data to local or cloud storage',
            icon: <Database size={20} className="text-blue-600"/>,
            onClick: () => setModal({ type: 'backup' })
        },
        // More items can be added here later as requested by the user
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">System Intelligence</h4>
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest leading-none">Operations Control Center</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {menuItems.map(item => (
                    <div 
                        key={item.id} 
                        onClick={() => { item.onClick(); }}
                        className="p-5 bg-slate-50 border border-slate-100 rounded-[32px] flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                {item.icon}
                            </div>
                            <div>
                                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{item.label}</h5>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-tight">{item.desc}</p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-200 group-hover:text-blue-600 transition-colors"/>
                    </div>
                ))}
            </div>

            <div className="pt-8 border-t border-slate-50 opacity-20 flex flex-col items-center gap-2">
                <div className="w-10 h-1 bg-slate-200 rounded-full"></div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">Integrated Engine v2.1</p>
            </div>
        </div>
    );
};

export default SystemMenu;
