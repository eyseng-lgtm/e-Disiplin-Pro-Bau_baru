import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-12 left-4 z-[65] flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-lg">
      <WifiOff size={14} className="flex-shrink-0" />
      <span>Mod Luar Talian — Data disimpan dalam peranti</span>
    </div>
  );
};
