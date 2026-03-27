import React, { useState } from 'react';
import { ArrowLeft, Edit2, Trash2, Phone, UserCheck, Coffee, Briefcase, Calendar, Clock, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';

const StaffDetailView = ({ staff, data, user, onBack, setViewDetail, setModal, deleteRecord, handleAttendance, attToday, getFilteredAttendance, allAttendance, attStats, workLogs, formatDurationHrs }) => {
    const [sTab, setSTab] = useState('attendance');
    const [attFilter, setAttFilter] = useState('This Month');
    const [attCustom, setAttCustom] = useState({ start: '', end: '' });

    const getMins = (t) => {
        if(!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    const formatDur = (m) => {
        if(m <= 0) return '-';
        const h = Math.floor(m / 60);
        const mins = m % 60;
        return `${h}h ${mins}m`;
    };

    const formatTime = (isoString) => {
      if(!isoString) return '';
      return new Date(isoString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    };

    const filteredAtt = getFilteredAttendance(staff, attFilter, attCustom, allAttendance);

    if (!staff) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in slide-in-from-right duration-300 pb-24">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                    <h2 className="font-black text-slate-800 tracking-tight">Staff Profile</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setModal({ type: 'staff', data: staff })} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors">
                        <Edit2 size={20}/>
                    </button>
                    {user?.role === 'admin' && (
                        <button 
                            onClick={async () => {
                                if(window.confirm('Permanent delete staff profile?')) {
                                    await deleteRecord('staff', staff.id);
                                    onBack();
                                }
                            }} 
                            className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"
                        >
                            <Trash2 size={20}/>
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6 max-w-2xl mx-auto space-y-6">
                <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                            <div className="flex-1">
                                <h1 className="text-3xl font-black tracking-tighter mb-4">{staff.name}</h1>
                                <div className="space-y-2">
                                    <p className="flex items-center gap-2 text-sm font-bold text-slate-400">
                                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><Briefcase size={14}/></div>
                                        {staff.role}
                                    </p>
                                    {staff.mobile && (
                                        <p className="flex items-center gap-2 text-sm font-bold text-slate-400 cursor-pointer" onClick={() => window.open(`tel:${staff.mobile}`)}>
                                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><Phone size={14}/></div>
                                            {staff.mobile}
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="w-full sm:w-auto flex items-center gap-3">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${staff.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                    {staff.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl sticky top-[72px] z-10">
                    <button 
                        onClick={()=>setSTab('attendance')} 
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sTab === 'attendance' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-400'}`}
                    >
                        Attendance
                    </button>
                    <button 
                        onClick={()=>setSTab('work')} 
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sTab === 'work' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-400'}`}
                    >
                        Work Logs
                    </button>
                </div>

                <div className="space-y-6">
                    {sTab === 'attendance' && (
                        <div className="space-y-6">
                            <div className="bg-indigo-50 border border-indigo-100 rounded-[32px] p-8 space-y-6">
                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2"><UserCheck size={16}/> Daily Sessions</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => handleAttendance('checkIn')} 
                                        disabled={!!attToday.checkIn} 
                                        className="p-6 bg-white border border-indigo-100 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all text-slate-800 disabled:opacity-40 disabled:bg-slate-50"
                                    >
                                        <Clock size={24} className="text-emerald-500"/>
                                        <p className="font-black text-xs uppercase tracking-widest">Check In</p>
                                        <p className="text-sm font-bold opacity-60 tracking-tight">{attToday.checkIn || '--:--'}</p>
                                    </button>
                                    <button 
                                        onClick={() => handleAttendance('checkOut')} 
                                        disabled={!!attToday.checkOut} 
                                        className="p-6 bg-white border border-indigo-100 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all text-slate-800 disabled:opacity-40 disabled:bg-slate-50"
                                    >
                                        <Clock size={24} className="text-rose-500"/>
                                        <p className="font-black text-xs uppercase tracking-widest">Check Out</p>
                                        <p className="text-sm font-bold opacity-60 tracking-tight">{attToday.checkOut || '--:--'}</p>
                                    </button>
                                    <button 
                                        onClick={() => handleAttendance('lunchStart')} 
                                        disabled={!!attToday.lunchStart} 
                                        className="p-4 bg-white border border-indigo-100 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all text-slate-800 disabled:opacity-40"
                                    >
                                        <Coffee size={20} className="text-amber-500"/>
                                        <p className="font-black text-[10px] uppercase tracking-widest">Lunch Break</p>
                                        <p className="text-xs font-bold opacity-40">{attToday.lunchStart || 'Start'}</p>
                                    </button>
                                    <button 
                                        onClick={() => handleAttendance('lunchEnd')} 
                                        disabled={!!attToday.lunchEnd} 
                                        className="p-4 bg-white border border-indigo-100 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all text-slate-800 disabled:opacity-40"
                                    >
                                        <Briefcase size={20} className="text-indigo-500"/>
                                        <p className="font-black text-[10px] uppercase tracking-widest">Back to Work</p>
                                        <p className="text-xs font-bold opacity-40">{attToday.lunchEnd || 'End'}</p>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl shadow-slate-200">
                                <div className="flex justify-between items-center mb-6">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Performance Stats</p>
                                    <select 
                                        value={attFilter} 
                                        onChange={e=>setAttFilter(e.target.value)} 
                                        className="bg-white/10 text-[10px] border-none rounded-xl px-4 py-2 font-black text-white outline-none cursor-pointer"
                                    >
                                        <option className="text-slate-900">This Month</option>
                                        <option className="text-slate-900">Last Month</option>
                                        <option className="text-slate-900">This Week</option>
                                        <option className="text-slate-900">All Time</option>
                                        <option className="text-slate-900">Custom Range</option>
                                    </select>
                                </div>
                                {attFilter === 'Custom Range' && (
                                    <div className="flex gap-2 mb-6 animate-in slide-in-from-top-2">
                                        <input type="date" className="flex-1 text-[10px] p-2 rounded-xl bg-white/5 border-none text-white font-black" value={attCustom.start} onChange={e=>setAttCustom({...attCustom, start:e.target.value})} />
                                        <input type="date" className="flex-1 text-[10px] p-2 rounded-xl bg-white/5 border-none text-white font-black" value={attCustom.end} onChange={e=>setAttCustom({...attCustom, end:e.target.value})} />
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="relative">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Days Present</p>
                                        <p className="text-3xl font-black text-blue-400 tracking-tighter">{attStats.count}</p>
                                        <div className="absolute top-0 right-0 w-12 h-12 bg-blue-500/10 rounded-full blur-xl opacity-50"></div>
                                    </div>
                                    <div className="relative">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Logged Hours</p>
                                        <p className="text-3xl font-black text-emerald-400 tracking-tighter">{formatDurationHrs(attStats.mins)}</p>
                                        <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/10 rounded-full blur-xl opacity-50"></div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Session Logs</p>
                                {filteredAtt.map(item => {
                                    const inM = getMins(item.checkIn);
                                    const outM = getMins(item.checkOut);
                                    const lsM = getMins(item.lunchStart);
                                    const leM = getMins(item.lunchEnd);
                                    
                                    let gross = 0, lunch = 0, net = 0;
                                    if (item.checkIn && item.checkOut) gross = outM - inM;
                                    if (item.lunchStart && item.lunchEnd) lunch = leM - lsM;
                                    net = gross - lunch;
                                    
                                    return (
                                        <div key={item.id} className="p-6 bg-white border border-slate-100 rounded-[28px] shadow-sm relative group overflow-hidden">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={16} className="text-slate-400"/>
                                                    <p className="font-black text-slate-800 text-sm">{formatDate(item.date)}</p>
                                                </div>
                                                {user?.role === 'admin' && (
                                                    <div className="flex gap-2">
                                                        <button className="p-2 text-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><Edit2 size={14}/></button>
                                                        <button className="p-2 text-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={14}/></button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-50">
                                                <div className="flex flex-col gap-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clock In</p>
                                                    <p className="font-bold text-slate-700 text-xs">{item.checkIn || '-'}</p>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clock Out</p>
                                                    <p className="font-bold text-slate-700 text-xs">{item.checkOut || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Net Work Hours</span>
                                                <span className="font-black text-sm text-slate-900 tracking-tight">{formatDur(net)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {sTab === 'work' && (
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Task Worklogs</p>
                            {workLogs.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => setViewDetail({ type: 'task', id: item.taskId })}
                                    className="p-6 bg-white border border-slate-100 rounded-[24px] shadow-sm cursor-pointer hover:bg-slate-50 transition-all flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                                            <Clock size={18}/>
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-sm tracking-tight mb-0.5">{item.taskName}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {formatTime(item.start)} - {item.end ? formatTime(item.end) : 'Active'} 
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <div>
                                            <p className="text-xs font-black text-slate-900 tracking-tighter">{formatDurationHrs(item.duration)}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(item.start).toLocaleDateString()}</p>
                                        </div>
                                        <ChevronRight size={20} className="text-slate-200 group-hover:text-slate-400 transition-colors"/>
                                    </div>
                                </div>
                            ))}
                            {workLogs.length === 0 && (
                                <div className="p-12 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                                    <p className="text-slate-400 font-bold text-sm">No task work logs recorded for this staff member.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StaffDetailView;
