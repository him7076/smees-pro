import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('SMEES ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
                    <div className="flex flex-col items-center gap-6 max-w-md text-center p-8">
                        <div className="w-20 h-20 bg-rose-50 rounded-[28px] flex items-center justify-center shadow-lg">
                            <AlertTriangle className="text-rose-500" size={36}/>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">System Recovery</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">An unexpected error occurred. Your data is safe.</p>
                            <p className="text-xs text-slate-500 bg-slate-100 p-3 rounded-xl font-mono break-all">
                                {this.state.error?.message || 'Unknown error'}
                            </p>
                        </div>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
                        >
                            <RefreshCw size={16}/> Restart Engine
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
