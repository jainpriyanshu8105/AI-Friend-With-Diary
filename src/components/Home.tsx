import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, ShieldAlert, Sparkles, AlertCircle, ExternalLink } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider, browserPopupRedirectResolver } from 'firebase/auth';
import { auth } from '../firebase';

export function Home({ onSandboxMode }: { onSandboxMode: () => void }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login popup was closed. Please try again.');
      } else if (err.code === 'auth/cancelled-by-user') {
        setError('Login was cancelled.');
      } else if (err.message && err.message.includes('network-request-failed') || err.code === 'auth/network-request-failed') {
        setError('Iframe Sandbox Block: The browser restricted external Google Sign-In popups in this preview iframe. You can open the app in a new tab or use Guest Sandbox mode to try all features locally.');
      } else {
        setError(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-4"
    >
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/20 relative flex flex-col items-center">
        
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-500/20 p-4 rounded-full">
            <User className="w-12 h-12 text-indigo-400" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-center text-white mb-2 font-mono tracking-tight">
          Stress Buster
        </h1>
        <p className="text-indigo-200 text-center mb-8 text-sm">
          A calm space to track your self-care journal, chat with supportive AI friends, play relaxing games, and dissolve daily stress.
        </p>
        
        {error && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-200 text-xs rounded-xl p-4 mb-6 flex flex-col gap-2 w-full animate-pulse">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Authentication Notice</span>
            </div>
            <p className="leading-relaxed leading-normal">{error}</p>
            {error.includes('Iframe') && (
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 font-semibold mt-1 underline"
              >
                Open in new tab <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
        
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3.5 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-semibold text-base transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6 animate-pulse" />
                Sign in with Google
              </>
            )}
          </button>

          <div className="relative flex py-2 items-center w-full">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink mx-4 text-white/30 text-xs uppercase font-mono">Or offline mode</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <button
            onClick={onSandboxMode}
            className="w-full py-3.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-100 border border-indigo-500/30 hover:border-indigo-500/60 rounded-xl font-medium text-base transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Sparkles className="w-5 h-5 text-indigo-300" />
            Continue as Guest (Sandbox)
          </button>
        </div>

        <p className="text-white/30 text-[10px] text-center mt-6 font-mono">
          Safe & fully private locally stored profile is available instantly
        </p>
      </div>
    </motion.div>
  );
}
