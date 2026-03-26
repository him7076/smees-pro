import React, { useState } from 'react';
import { X, Plus, ShieldCheck, Lock, User, Phone, Save, Clock, Banknote } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';

const StaffForm = ({ data, setData, record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [form, setForm] = useState({ 
        name: '', 
        mobile: '', 
        role: 'staff',
        loginId: '',
        password: '',
        salary: '',
        dutyStart: '09:00',
        dutyEnd: '18:00',
        permissions: {
            canViewDashboard: true,
            canViewAccounts: false,
            canViewTasks: true,
            canEditTasks: false,
            canViewMasters: false,
            canViewStaff: false
        },
        ...(record || {}) 
    });

    const handleSave = async () => {
        if (!form.name || !form.mobile) return alert("Name & Mobile Required");
        await saveRecord('staff', form, 'staff');
        onClose();
    };

    const togglePermission = (perm) => {
        setForm(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [perm]: !prev.permissions[perm]
            }
        }));
    };

    return (
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="Staff Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Number</label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
                    </div>
                </div>
            </div>

            <div className="p-6 bg-slate-900 rounded-[32px] border border-slate-800 space-y-4 shadow-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Lock size={14} className="text-blue-500"/> Security & Access Credentials</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold text-white outline-none focus:ring-4 focus:ring-blue-500/20" placeholder="Login ID" value={form.loginId} onChange={e => setForm({...form, loginId: e.target.value})} />
                    <input className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold text-white outline-none focus:ring-4 focus:ring-blue-500/20" type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                </div>
            </div>

            <div className="p-6 bg-blue-50/50 rounded-[32px] border border-blue-100/50 space-y-4">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Clock size={14}/> Duty & Payroll Settings</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase ml-1">Monthly Salary</span>
                        <div className="relative">
                            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                            <input type="number" className="w-full pl-10 pr-4 py-3 bg-white border border-blue-100 rounded-xl text-xs font-bold outline-none" placeholder="0.00" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase ml-1">Start Time</span>
                        <input type="time" className="w-full p-3 bg-white border border-blue-100 rounded-xl text-xs font-bold outline-none" value={form.dutyStart} onChange={e => setForm({...form, dutyStart: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase ml-1">End Time</span>
                        <input type="time" className="w-full p-3 bg-white border border-blue-100 rounded-xl text-xs font-bold outline-none" value={form.dutyEnd} onChange={e => setForm({...form, dutyEnd: e.target.value})} />
                    </div>
                </div>
            </div>

            {/* Granular Permissions */}
            <div className="p-6 bg-white rounded-[32px] border border-slate-100 space-y-4 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-500"/> Granular System Permissions</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                        { id: 'canViewDashboard', label: 'Access Dashboard' },
                        { id: 'canViewAccounts', label: 'View Accounting & Bills' },
                        { id: 'canViewTasks', label: 'View Work Orders' },
                        { id: 'canEditTasks', label: 'Edit/Complete Tasks' },
                        { id: 'canViewMasters', label: 'Manage Items & Parties' },
                        { id: 'canViewStaff', label: 'Manage Other Staff' },
                    ].map(perm => (
                        <button 
                            key={perm.id} 
                            onClick={() => togglePermission(perm.id)} 
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${form.permissions[perm.id] ? 'bg-emerald-50 border-emerald-100 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-tight">{perm.label}</span>
                            <div className={`w-10 h-6 rounded-full relative transition-all ${form.permissions[perm.id] ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.permissions[perm.id] ? 'right-1' : 'left-1'}`}></div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <button onClick={handleSave} className="w-full bg-blue-600 text-white py-5 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-8">
                <Save size={20}/>
                Commit Staff Profile
            </button>
        </div>
    );
};

export default StaffForm;
