import React, { useState } from 'react';
import { Download, Share, PlusSquare, Smartphone, X, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [guideMode, setGuideMode] = useState<'ios' | 'android' | null>(null);

  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop native install prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="bg-gov-blue text-white border border-gov-blue px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-gov-blue/90 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
      >
        <Download size={16} />
        <span>PASANG APLIKASI</span>
      </button>
    );
  }

  // iOS Safari & Android fallback guide when native prompt isn't triggered (e.g. iOS WebKit or in-app browser)
  if (isIOS || isAndroid) {
    return (
      <>
        <button
          type="button"
          onClick={() => setGuideMode(isIOS ? 'ios' : 'android')}
          className="bg-gov-gold/15 text-gov-blue border border-gov-gold/40 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-gov-gold/25 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Smartphone size={16} className="text-gov-gold" />
          <span>PASANG APP</span>
        </button>

        {guideMode && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-gov-blue uppercase tracking-wide">
                    {guideMode === 'ios' ? 'Pasang di iPhone / iPad' : 'Pasang di Telefon Android'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    e-Disiplin Pro Bau • SJK Chung Hua Bau
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideMode(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {guideMode === 'ios' ? (
                <div className="mt-4 space-y-3 text-xs text-slate-700 leading-relaxed">
                  <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <Share size={18} className="text-gov-blue flex-shrink-0 mt-0.5" />
                    <p>
                      1. Buka pautan ini menggunakan pelayar <strong>Safari</strong> dan tekan butang <strong>Share</strong> di bar bawah/atas.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <PlusSquare size={18} className="text-gov-blue flex-shrink-0 mt-0.5" />
                    <p>
                      2. Tatal ke bawah dan pilih <strong>Add to Home Screen</strong> (Tambah ke Skrin Utama), kemudian tekan <strong>Add</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3 text-xs text-slate-700 leading-relaxed">
                  <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <MoreVertical size={18} className="text-gov-blue flex-shrink-0 mt-0.5" />
                    <p>
                      1. Pastikan anda membuka pautan ini dalam pelayar <strong>Google Chrome</strong> (bukan pelayar dalam WhatsApp/Telegram).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <Download size={18} className="text-gov-blue flex-shrink-0 mt-0.5" />
                    <p>
                      2. Tekan ikon menu <strong>⋮</strong> di penjuru kanan atas Chrome dan pilih <strong>Add to Home screen</strong> / <strong>Install app</strong>.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setGuideMode(null)}
                className="mt-5 w-full rounded-lg bg-gov-blue py-2.5 text-xs font-extrabold uppercase tracking-wider text-white hover:bg-gov-blue/95 transition-colors cursor-pointer"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
