import React from 'react';
import { RefreshCw, FileText, Settings, X, ChevronRight, ShieldCheck, Database, TrendingUp, Landmark, Plus, Building2 } from 'lucide-react';
import { companyManager } from '../../utils/companyManager';

const SystemMenu = ({ setModal, onClose, uiConfig = { aiEnabled: true }, setUiConfig }) => {
    const companies = companyManager.getCompanies();
    const activeId = companyManager.getActiveId();
    const menuItems = [
        { 
            id: 'aiToggle', 
            label: uiConfig.aiEnabled !== false ? 'Disable AI Assistant' : 'Enable AI Assistant', 
            desc: uiConfig.aiEnabled !== false ? 'Turn off voice commands (Jarvis)' : 'Turn on voice commands (Jarvis)',
            icon: <RefreshCw size={20} className={uiConfig.aiEnabled !== false ? "text-emerald-600" : "text-slate-400"}/>,
            onClick: () => {
                if(setUiConfig) {
                    setUiConfig(prev => ({ ...prev, aiEnabled: prev.aiEnabled === false ? true : false }));
                }
            }
        },
        { 
            id: 'syncToggle', 
            label: uiConfig.syncEnabled !== false ? 'Disable Cloud Sync' : 'Enable Cloud Sync', 
            desc: uiConfig.syncEnabled !== false ? 'Go offline (save locally only)' : 'Sync local changes to Firebase',
            icon: <Database size={20} className={uiConfig.syncEnabled !== false ? "text-blue-600" : "text-slate-400"}/>,
            onClick: () => {
                if(setUiConfig) {
                    setUiConfig(prev => ({ ...prev, syncEnabled: prev.syncEnabled === false ? true : false }));
                }
            }
        },
        { 
            id: 'backup', 
            label: 'Backup & Restore', 
            desc: 'Secure your data to local or cloud storage',
            icon: <Database size={20} className="text-blue-600"/>,
            onClick: () => setModal({ type: 'backup' })
        },
        { 
            id: 'closeFY', 
            label: 'Close Financial Year', 
            desc: 'Transition to new fiscal period & reset counters',
            icon: <RefreshCw size={20} className="text-amber-600"/>,
            onClick: () => setModal({ type: 'closeFY' })
        },
    ];

    return (
        <div className="p-6 space-y-8">
            {/* --- MULTI-COMPANY SELECTOR --- */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Business Profiles</h4>
                        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest leading-none">Manage Multiple Companies</p>
                    </div>
                    <button 
                        onClick={() => {
                            const name = prompt("Enter New Company Name:");
                            if (name) companyManager.addCompany(name);
                        }}
                        className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 active:scale-90 transition-all"
                    >
                        <Plus size={16}/>
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    {companies.map(c => (
                        <div 
                            key={c.id} 
                            onClick={() => companyManager.setActiveId(c.id)}
                            className={`p-4 rounded-[28px] border-2 transition-all flex items-center justify-between group cursor-pointer ${c.id === activeId ? 'bg-blue-50 border-blue-600' : 'bg-slate-50 border-slate-100 hover:border-blue-200'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.id === activeId ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                    <Building2 size={18}/>
                                </div>
                                <div>
                                    <h5 className={`text-[10px] font-black uppercase tracking-tight ${c.id === activeId ? 'text-blue-900' : 'text-slate-600'}`}>{c.name}</h5>
                                    {c.id === activeId && <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mt-0.5">Active Now</p>}
                                </div>
                            </div>
                            {c.id === activeId && <ShieldCheck size={16} className="text-blue-600"/>}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-slate-50">
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
