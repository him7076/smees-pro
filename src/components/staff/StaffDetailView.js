import React, { useState } from 'react';
import { ArrowLeft, Edit2, Trash2, Phone, UserCheck, Coffee, Briefcase, Calendar, Clock, ChevronRight, X } from 'lucide-react';
import { formatCurrency, formatDate, getAttendanceDurations } from '../../utils/helpers';

const StaffDetailView = ({ staff, data, user, onBack, setViewDetail, setModal, deleteRecord, handleAttendance, attToday, getFilteredAttendance, allAttendance, attStats, workLogs, formatDurationHrs }) => {
    const [sTab, setSTab] = useState('attendance');
    const [attFilter, setAttFilter] = useState('This Month');
    const [attCustom, setAttCustom] = useState({ start: '', end: '' });
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [showManual, setShowManual] = useState(false);

    const formatTime = (isoString) => {
        if (!isoString) return '';
        try {
            return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return '-'; }
    };

    const filteredAtt = getFilteredAttendance(staff, attFilter, attCustom, allAttendance);

    // Dynamic Attendance Stats Calculation based on Filtered List
    const dynamicStats = React.useMemo(() => {
        let totalMins = 0;
        filteredAtt.forEach(att => {
            const durs = getAttendanceDurations(att);
            // durs.activeMins is expected to be returned by the helper
            // If activeMins is not available, we fall back to manual calculation if checkIn/checkOut exist
            if (durs.activeMins !== undefined) {
                totalMins += durs.activeMins || 0;
            }
        });
        return {
            count: filteredAtt.length,
            mins: totalMins
        };
    }, [filteredAtt]);

    const localFormatHrs = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    if (!staff) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in slide-in-from-right duration-300 pb-24">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                    <h2 className="font-black text-slate-800 tracking-tight text-xs uppercase">Staff Profile</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setModal({ type: 'staff', data: staff })} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors">
                        <Edit2 size={18}/>
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
                            <Trash2 size={18}/>
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-6">
                <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                    <div className="relative z-10 text-center">
                        <h1 className="text-2xl font-black tracking-tighter mb-2">{staff.name}</h1>
                        <p className="inline-block px-3 py-1 bg-white/10 rounded-full text-[8px] font-black uppercase tracking-widest text-slate-400 mb-6">{staff.role}</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 text-center">Contact</p>
                                <p className="text-[10px] font-bold text-center">{staff.mobile || 'N/A'}</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 text-center">Status</p>
                                <p className={`text-[10px] font-black text-center uppercase tracking-widest ${staff.active ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {staff.active ? 'Active' : 'Inactive'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl sticky top-[72px] z-10">
                    <button 
                        onClick={()=>setSTab('attendance')} 
                        className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${sTab === 'attendance' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-400'}`}
                    >
                        Attendance
                    </button>
                    <button 
                        onClick={()=>setSTab('work')} 
                        className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${sTab === 'work' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-400'}`}
                    >
                        Work Logs
                    </button>
                </div>

                <div className="space-y-6">
                    {sTab === 'attendance' && (
                        <div className="space-y-6">
                            <div className="bg-indigo-50 border border-indigo-100 rounded-[32px] p-6 space-y-6 text-center">
                                <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center justify-center gap-2"><UserCheck size={14}/> Session Control</p>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <button 
                                        onClick={() => handleAttendance('checkIn')} 
                                        disabled={!!attToday.checkIn} 
                                        className="p-5 bg-white border border-indigo-100 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-slate-800 disabled:opacity-40"
                                    >
                                        <Clock size={20} className="text-emerald-500"/>
                                        <p className="font-black text-[9px] uppercase tracking-widest">Check In</p>
                                        <p className="text-xs font-bold opacity-60">{attToday.checkIn || '--:--'}</p>
                                    </button>
                                    <button 
                                        onClick={() => handleAttendance('checkOut')} 
                                        disabled={!attToday.checkIn || !!attToday.checkOut} 
                                        className="p-5 bg-white border border-indigo-100 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-slate-800 disabled:opacity-40"
                                    >
                                        <Clock size={20} className="text-rose-500"/>
                                        <p className="font-black text-[9px] uppercase tracking-widest">Check Out</p>
                                        <p className="text-xs font-bold opacity-60">{attToday.checkOut || '--:--'}</p>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => handleAttendance('lunchStart')} 
                                        disabled={!attToday.checkIn || !!attToday.lunchStart || !!attToday.checkOut} 
                                        className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-slate-800 disabled:opacity-40"
                                    >
                                        <Coffee size={18} className="text-amber-500"/>
                                        <p className="font-black text-[8px] uppercase tracking-widest leading-none">Lunch Start</p>
                                        <p className="text-[10px] font-bold opacity-60">{attToday.lunchStart || '--:--'}</p>
                                    </button>
                                    <button 
                                        onClick={() => handleAttendance('lunchEnd')} 
                                        disabled={!attToday.lunchStart || !!attToday.lunchEnd || !!attToday.checkOut} 
                                        className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-slate-800 disabled:opacity-40"
                                    >
                                        <Coffee size={18} className="text-orange-500"/>
                                        <p className="font-black text-[8px] uppercase tracking-widest leading-none">Lunch Stop</p>
                                        <p className="text-[10px] font-bold opacity-60">{attToday.lunchEnd || '--:--'}</p>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl shadow-slate-200">
                                <div className="flex justify-between items-center mb-6">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Performance Intelligence</p>
                                    <select 
                                        value={attFilter} 
                                        onChange={e=>setAttFilter(e.target.value)} 
                                        className="bg-white/10 text-[9px] border-none rounded-xl px-3 py-1.5 font-black text-white outline-none cursor-pointer"
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
                                        <input type="date" className="flex-1 text-[9px] p-2 rounded-xl bg-white/5 border-none text-white font-black" value={attCustom.start} onChange={e=>setAttCustom({...attCustom, start:e.target.value})} />
                                        <input type="date" className="flex-1 text-[9px] p-2 rounded-xl bg-white/5 border-none text-white font-black" value={attCustom.end} onChange={e=>setAttCustom({...attCustom, end:e.target.value})} />
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="relative text-center border-r border-white/5 last:border-none">
                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Days Present</p>
                                        <p className="text-2xl font-black text-blue-400 tracking-tighter">{dynamicStats.count}</p>
                                    </div>
                                    <div className="relative text-center">
                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Hours</p>
                                        <p className="text-2xl font-black text-emerald-400 tracking-tighter">{localFormatHrs(dynamicStats.mins)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mx-1">
                                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">Session Logs</p>
                                {user?.role === 'admin' && (
                                    <button 
                                        onClick={() => setShowManual(true)} 
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-blue-200"
                                    >
                                        Admin Manual Entry
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                {filteredAtt.length === 0 && (
                                    <div className="p-12 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                                        <p className="text-slate-400 font-bold text-sm">No attendance logs for this period.</p>
                                    </div>
                                )}
                                {filteredAtt.map(item => {
                                    const durs = getAttendanceDurations(item);
                                    
                                    return (
                                        <div key={item.id} className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm relative group overflow-hidden transition-all hover:shadow-xl hover:border-blue-100">
                                            <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-50">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={14} className="text-blue-500"/>
                                                        <p className="font-black text-slate-900 text-sm tracking-tight">{formatDate(item.date)}</p>
                                                    </div>
                                                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-5">ID: {item.id}</span>
                                                </div>
                                                {user?.role === 'admin' && (
                                                    <div className="flex gap-2">
                                                        <button className="p-2 text-blue-500 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Edit2 size={12}/></button>
                                                        <button 
                                                            onClick={async () => {
                                                                if(window.confirm('Delete this entry?')) {
                                                                    await deleteRecord('attendance', item.id);
                                                                }
                                                            }}
                                                            className="p-2 text-rose-500 bg-rose-50 rounded-xl hover:bg-rose-600 hover:text-white transition-all"
                                                        ><Trash2 size={12}/></button>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="grid grid-cols-4 gap-2 mb-6">
                                                <div className="flex flex-col items-center bg-slate-50 p-2 rounded-2xl">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">In</p>
                                                    <p className="font-black text-slate-800 text-[10px]">{item.checkIn || '-'}</p>
                                                </div>
                                                <div className="flex flex-col items-center bg-slate-50 p-2 rounded-2xl">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Out</p>
                                                    <p className="font-black text-slate-800 text-[10px]">{item.checkOut || '-'}</p>
                                                </div>
                                                <div className="flex flex-col items-center bg-orange-50/50 p-2 rounded-2xl">
                                                    <p className="text-[8px] font-black text-orange-400 uppercase mb-1">L.Start</p>
                                                    <p className="font-black text-orange-600 text-[10px]">{item.lunchStart || '-'}</p>
                                                </div>
                                                <div className="flex flex-col items-center bg-orange-50/50 p-2 rounded-2xl">
                                                    <p className="text-[8px] font-black text-orange-400 uppercase mb-1">L.End</p>
                                                    <p className="font-black text-orange-600 text-[10px]">{item.lunchEnd || '-'}</p>
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                <div className="flex-1 bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                                                    <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Gross Time</span>
                                                    <span className="font-black text-xs text-blue-700">{durs.gross}</span>
                                                </div>
                                                <div className="flex-1 bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
                                                    <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Lunch Break</span>
                                                    <span className="font-black text-xs text-amber-700">{durs.lunch}</span>
                                                </div>
                                            </div>

                                            {item.notes && (
                                                <div className="mt-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-50">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 shadow-sm">Notes / Description</p>
                                                    <p className="text-xs font-bold text-slate-700">{item.notes}</p>
                                                </div>
                                            )}

                                            <div className="mt-3 flex justify-between items-center bg-slate-900 p-5 rounded-[24px] text-white shadow-lg shadow-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center"><Clock size={16}/></div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Actual Work Hours</span>
                                                </div>
                                                <span className="font-black text-lg tracking-tighter text-blue-400">{durs.active}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Manual Enrollment Modal Backdrop (Simplified implementation in-file) */}
                            {showManual && (
                                <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm p-6 flex items-center justify-center">
                                    <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                                        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800 tracking-tight">Manual Attendance</h3>
                                                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-1">Admin Override Access</p>
                                            </div>
                                            <button onClick={()=>setShowManual(false)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-colors"><X size={20}/></button>
                                        </div>
                                        <div className="p-8 space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Period</label>
                                                <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={manualDate} onChange={e=>setManualDate(e.target.value)} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">In Time</label>
                                                    <input type="time" id="mIn" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"/>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Out Time</label>
                                                    <input type="time" id="mOut" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"/>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1">Lunch Start</label>
                                                    <input type="time" id="mLIn" className="w-full p-4 bg-orange-50/30 border border-orange-100 rounded-2xl font-bold outline-none"/>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1">Lunch End</label>
                                                    <input type="time" id="mLOut" className="w-full p-4 bg-orange-50/30 border border-orange-100 rounded-2xl font-bold outline-none"/>
                                                </div>
                                                <div className="col-span-2 space-y-2 pt-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes / Description</label>
                                                    <input type="text" id="mNotes" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" placeholder="Add any remarks or descriptions..." />
                                                </div>
                                            </div>
                                            <button 
                                                onClick={async () => {
                                                    const inT = document.getElementById('mIn').value;
                                                    const outT = document.getElementById('mOut').value;
                                                    const lIn = document.getElementById('mLIn').value;
                                                    const lOut = document.getElementById('mLOut').value;
                                                    const notes = document.getElementById('mNotes').value;
                                                    if(!inT) return alert("At least In-time required");
                                                    await handleAttendance('manual', { date: manualDate, checkIn: inT, checkOut: outT, lunchStart: lIn, lunchEnd: lOut, notes });
                                                    setShowManual(false);
                                                }}
                                                className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-200 active:scale-95 transition-all"
                                            >
                                                Post Record
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
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
