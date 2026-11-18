import React, { useState, useEffect, useMemo } from 'react';
import { 
  LogOut, 
  Save, 
  FileText, 
  Mail, 
  Filter, 
  Trash2, 
  PlusCircle,
  GraduationCap,
  Calendar,
  User,
  AlertCircle,
  Search,
  X,
  Printer,
  Database,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

const LEGACY_DRIVE_FOLDER_ID = '1aDb96JL-KqwDQP9rg4XK7Ue8N84L8yAw';
const DEFAULT_DRIVE_FOLDER_ID = '1Qu6_JZXruCxsS7uTPaax3_w0BzUl5YzatKkbxaPF6YU';

const extractDriveFolderId = (rawInput: string): string => {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  return trimmed.split(/[?&#/]/)[0].trim();
};

// Types
interface DisciplineRecord {
  id: string;
  date: string;
  studentName: string;
  className: string;
  violation: string;
  action: string;
  intervention: string;
  createdAt: number;
}

const CLASSES = (() => {
  const years = [1, 2, 3, 4, 5, 6];
  const types = ['M', 'K'];
  const list: string[] = [];
  years.forEach(y => types.forEach(t => list.push(`${y}${t}`)));
  return list;
})();

const VIOLATIONS = [
  'Ponteng Sekolah',
  'Buli',
  'Merokok / Vape',
  'Kurang Sopan / Biadab',
  'Membawa Handphone',
  'Merayau / Keluar Kelas Tanpa Pas',
  'Vandalisme',
  'Kekemasan Diri',
  'Lain-lain'
];

const ACTIONS = [
  'Nasihat & Amaran Lisan',
  'Amaran 1 (Bertulis)',
  'Amaran 2 (Bertulis)',
  'Amaran 3 (Bertulis)',
  'Sesi Kaunseling',
  'Gantung Sekolah',
  'Buang Sekolah'
];

const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr: string): Date => {
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && parts.every(n => !Number.isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(dateStr);
};

const SCHOOL_LOGO_URL = 'https://i.postimg.cc/x8kSSswX/7bau25-removebg-preview-(1).png';

const loadImageAsDataUrl = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load logo image'));
    img.src = url;
  });
};

export default function App() {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [syncUrl, setSyncUrl] = useState(() => localStorage.getItem('eDisiplin_syncUrl') || 'https://script.google.com/macros/s/AKfycbwRV6PeLJvKJnoLV6isA9ASVCfoMHhIBnpxFaE21WDWDPk8hS_1QnaxAjll8bkjeA5fAQ/exec');
  const [driveFolderId, setDriveFolderId] = useState(() => {
    const saved = extractDriveFolderId(localStorage.getItem('eDisiplin_driveFolderId') || '');
    if (!saved || saved === LEGACY_DRIVE_FOLDER_ID) {
      return DEFAULT_DRIVE_FOLDER_ID;
    }
    return saved;
  });
  const [filterTab, setFilterTab] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [showAllRecordsModal, setShowAllRecordsModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    localStorage.setItem('eDisiplin_driveFolderId', driveFolderId);
  }, [driveFolderId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  
  // Form State
  const [formData, setFormData] = useState({
    date: getLocalDateString(),
    studentName: '',
    className: CLASSES[0],
    violation: VIOLATIONS[0],
    action: ACTIONS[0],
    intervention: ''
  });

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('eDisiplin_records');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse records", e);
      }
    }
  }, []);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('eDisiplin_records', JSON.stringify(records));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    return records.filter(record => {
      const recordDate = parseLocalDate(record.date);
      
      if (filterTab === 'today') {
        return recordDate >= startOfToday;
      }
      
      if (filterTab === 'week') {
        return recordDate >= weekAgo;
      }
      
      if (filterTab === 'month') {
        return recordDate >= monthAgo;
      }
      
      return true; // All
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [records, filterTab]);

  // Stats Calculation
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

    return {
      today: records.filter(r => parseLocalDate(r.date) >= today).length,
      week: records.filter(r => parseLocalDate(r.date) >= weekAgo).length,
      total: records.length
    };
  }, [records]);

  const filteredModalRecords = useMemo(() => {
    return records.filter(record => {
      const q = modalSearchQuery.toLowerCase();
      return (
        record.studentName.toLowerCase().includes(q) ||
        record.className.toLowerCase().includes(q) ||
        record.violation.toLowerCase().includes(q) ||
        record.action.toLowerCase().includes(q)
      );
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [records, modalSearchQuery]);

  // Sync settings to LocalStorage
  useEffect(() => {
    localStorage.setItem('eDisiplin_syncUrl', syncUrl);
  }, [syncUrl]);

  const fetchDataFromSheet = async () => {
    if (!syncUrl) {
      showToast('Sila masukkan URL Apps Script di bahagian Konfigurasi.', 'error');
      return;
    }
    setIsFetching(true);
    try {
      const response = await fetch(syncUrl);
      const cloudData = await response.json();
      if (Array.isArray(cloudData)) {
        setRecords(cloudData);
        localStorage.setItem('eDisiplin_records', JSON.stringify(cloudData));
        showToast('Data berjaya disinkronkan dari Google Sheets!', 'success');
      } else {
        showToast('Format data daripada Google Sheets tidak sah.', 'error');
      }
    } catch (error) {
      console.error("Sync Error:", error);
      showToast('Gagal mengambil data. Pastikan URL Apps Script betul.', 'error');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentName.trim() || !formData.className || !formData.violation || !formData.action) {
      showToast('Sila lengkapkan semua medan wajib.', 'error');
      return;
    }

    setIsSaving(true);
    
    const newRecord: DisciplineRecord = {
      ...formData,
      id: crypto.randomUUID(),
      studentName: formData.studentName.trim().toUpperCase(),
      createdAt: Date.now()
    };

    // Save to Cloud if Sync URL exists
    if (syncUrl) {
      try {
        await fetch(syncUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'addRecord', data: newRecord })
        });
      } catch (err) {
        console.warn("Cloud save failed, local only.", err);
      }
    }

    const updatedRecords = [newRecord, ...records];
    setRecords(updatedRecords);
    localStorage.setItem('eDisiplin_records', JSON.stringify(updatedRecords));

    // Auto-generate PDF and upload to Google Drive folder on Save
    const { doc, fileName } = buildReportPdf(newRecord);
    const pdfSaved = await savePdfToCloud(doc, fileName, true);

    setIsSaving(false);
    if (pdfSaved) {
      showToast(`Rekod & PDF "${fileName}" disimpan ke Google Drive.`, 'success');
    } else {
      showToast(`Rekod ${newRecord.studentName} disimpan (PDF gagal dihantar ke Drive).`, 'info');
    }
    
    setFormData(prev => ({ ...prev, studentName: '', intervention: '' }));
  };

  const savePdfToCloud = async (
    doc: jsPDF,
    fileName: string,
    suppressToast = false
  ): Promise<boolean> => {
    if (!syncUrl) {
      if (!suppressToast) {
        showToast('URL Apps Script tiada. PDF dimuat turun ke peranti sahaja.', 'info');
      }
      return false;
    }

    const cleanFolderId = extractDriveFolderId(driveFolderId) || DEFAULT_DRIVE_FOLDER_ID;
    const base64 = doc.output('datauristring').split(',')[1];
    const payload = JSON.stringify({
      action: 'savePDF',
      base64,
      fileName,
      folderId: cleanFolderId,
    });

    try {
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
      });

      if (response.ok) {
        const result = await response.json().catch(() => null);
        if (result && result.status === 'error') {
          if (!suppressToast) {
            showToast(`Gagal simpan ke Drive: ${result.message || 'Ralat skrip'}`, 'error');
          }
          return false;
        }
        if (!suppressToast) {
          showToast(`PDF "${fileName}" dihantar ke Google Drive.`, 'success');
        }
        return true;
      }
    } catch {
      // Fallback to no-cors for Apps Script deployments without CORS response headers
      try {
        await fetch(syncUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload,
        });
        if (!suppressToast) {
          showToast(`PDF "${fileName}" dihantar ke Google Drive.`, 'success');
        }
        return true;
      } catch (e) {
        console.error('PDF upload failed', e);
      }
    }

    if (!suppressToast) {
      showToast('Gagal menghantar PDF ke Google Drive. Semak URL Apps Script.', 'error');
    }
    return false;
  };

  const deleteRecord = (id: string) => {
    setConfirmDialog({
      title: 'Padam Rekod Disiplin',
      message: 'Padam rekod ini daripada peranti? (Nota: Rekod di Google Sheet tidak akan terpadam secara automatik)',
      confirmLabel: 'Padam Rekod',
      onConfirm: () => {
        const updated = records.filter(r => r.id !== id);
        setRecords(updated);
        localStorage.setItem('eDisiplin_records', JSON.stringify(updated));
        setConfirmDialog(null);
        showToast('Rekod berjaya dipadam.', 'info');
      }
    });
  };

  const buildReportPdf = (record: DisciplineRecord) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(15, 38, 88); // gov-blue
    doc.text('LAPORAN DISIPLIN PELAJAR', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text('SJK CHUNG HUA BAU', 105, 30, { align: 'center' });
    
    doc.line(20, 35, 190, 35);
    
    // Content
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    
    const data = [
      ['Tarikh Kejadian', record.date],
      ['Nama Pelajar', record.studentName],
      ['Kelas', record.className],
      ['Jenis Kesalahan', record.violation],
      ['Tindakan Diambil', record.action],
      ['Intervensi/Nota', record.intervention || '-']
    ];

    autoTable(doc, {
      startY: 45,
      head: [['Perkara', 'Butiran']],
      body: data,
      theme: 'grid',
      headStyles: { fillColor: [197, 160, 89] }, // gov-gold
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
    });

    doc.setFontSize(9);
    doc.text('Dicetak secara automatik oleh Sistem e-Disiplin Pro SJK CHB', 20, 280);
    doc.text(`Tarikh Cetakan: ${new Date().toLocaleString()}`, 20, 285);

    const fileName = `Laporan_${record.studentName}_${record.date}.pdf`;
    return { doc, fileName };
  };

  const generateReport = async (record: DisciplineRecord) => {
    const { doc, fileName } = buildReportPdf(record);
    doc.save(fileName);
    await savePdfToCloud(doc, fileName);
  };

  const generateLetter = async (record: DisciplineRecord) => {
    const doc = new jsPDF();
    
    // Add Logo safely (handles CORS / offline gracefully)
    try {
      const logoDataUrl = await loadImageAsDataUrl(SCHOOL_LOGO_URL);
      doc.addImage(logoDataUrl, 'PNG', 20, 10, 18, 18);
    } catch {
      // Proceed without logo if external image cannot be embedded
    }
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont('Helvetica', 'bold');
    doc.text('SJK CHUNG HUA BAU', 42, 18);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('JALAN LEE KHOI CHUN, 94000, BAU, SARAWAK', 42, 23);
    
    doc.line(20, 32, 190, 32);
    
    doc.text(`Tarikh: ${new Date().toLocaleDateString('ms-MY')}`, 150, 42);
    
    doc.text('Kepada Ibu Bapa / Penjaga,', 20, 52);
    doc.text(`${record.studentName} (${record.className})`, 20, 57);
    
    doc.setFont('Helvetica', 'bold');
    doc.text('PEMBERITAHUAN KESALAHAN DISIPLIN MURID', 20, 72);
    doc.setFont('Helvetica', 'normal');
    
    const letterBody = `Dengan segala hormatnya, perkara di atas adalah dirujuk. 
    
Dimaklumkan bahawa anak/jagaan tuan/puan telah melakukan kesalahan disiplin berikut:

Jenis Kesalahan: ${record.violation}
Tarikh Kejadian: ${record.date}

Pihak sekolah telah mengambil tindakan: ${record.action}.

Tujuan surat ini adalah untuk memaklumkan kepada pihak tuan/puan bagi memastikan perkara seumpama ini tidak berulang di masa hadapan. Kerjasama tuan/puan amat dihargai demi kecemerlangan sahsiah murid.

Sekian, terima kasih.

"BERKHIDMAT UNTUK NEGARA"
`;

    const splitText = doc.splitTextToSize(letterBody, 170);
    doc.text(splitText, 20, 82);
    
    doc.text('Guru Besar / PK HEM', 20, 182);
    doc.text('SJK Chung Hua Bau', 20, 187);
    
    doc.setFontSize(8);
    doc.text('* Ini adalah cetakan komputer. Tandatangan tidak diperlukan.', 20, 202);

    const fileName = `Surat_Amaran_${record.studentName}.pdf`;
    doc.save(fileName);
    await savePdfToCloud(doc, fileName);
  };

  const generateSummaryPDF = async (recordsToExport: DisciplineRecord[]) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.setTextColor(15, 38, 88); // gov-blue
    doc.text('RINGKASAN REKOD LAPORAN DISIPLIN MURID', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('SJK CHUNG HUA BAU', 105, 28, { align: 'center' });
    
    doc.line(20, 33, 190, 33);
    
    // Summary info
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Jumlah Rekod: ${recordsToExport.length}`, 20, 40);
    doc.text(`Tarikh Cetakan: ${new Date().toLocaleString()}`, 130, 40);
    
    const tableData = recordsToExport.map((record, index) => [
      index + 1,
      record.date,
      record.studentName,
      record.className,
      record.violation,
      record.action
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Bil', 'Tarikh', 'Nama Pelajar', 'Kelas', 'Kesalahan', 'Tindakan']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 38, 88] }, // gov-blue
      columnStyles: { 
        0: { cellWidth: 10 },
        1: { cellWidth: 25 }, 
        2: { fontStyle: 'bold', cellWidth: 45 },
        3: { cellWidth: 15 },
        4: { cellWidth: 45 },
        5: { cellWidth: 40 }
      }
    });

    const summaryFileName = `Ringkasan_Laporan_Disiplin_${getLocalDateString()}.pdf`;
    doc.save(summaryFileName);
    await savePdfToCloud(doc, summaryFileName);
  };

  // Helper for Violation Badge
  const getViolationBadge = (violation: string) => {
    const dangerTypes = ['Buli', 'Merokok / Vape', 'Vandalisme', 'Ponteng Sekolah'];
    const isDanger = dangerTypes.some(t => violation.includes(t));
    
    if (isDanger) {
      return (
        <span className="px-2 py-1 rounded bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider">
          {violation}
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
        {violation}
      </span>
    );
  };

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-slate-50 lg:overflow-hidden">
      {/* Header - Professional Polish Style */}
      <header className="min-h-[76px] bg-white border-b-4 border-gov-gold flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 shadow-md flex-shrink-0 z-10">
        <div className="flex items-center gap-3 sm:gap-4">
          <img 
            src={SCHOOL_LOGO_URL} 
            alt="Logo SJK CHB"
            className="h-[48px] sm:h-[56px] w-auto object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col">
            <h1 className="text-lg sm:text-xl font-extrabold text-gov-blue uppercase leading-tight tracking-tight">SJK CHUNG HUA BAU</h1>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] sm:tracking-[0.2em]">SISTEM PENGURUSAN DISIPLIN DIGITAL (E-DISIPLIN PRO)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <PWAInstallButton />
          <button 
            className="bg-red-50 text-red-600 border border-red-200 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2 cursor-pointer"
            onClick={() =>
              setConfirmDialog({
                title: 'Log Keluar Sesi',
                message: 'Adakah anda pasti mahu memuat semula sesi aplikasi ini?',
                confirmLabel: 'Log Keluar',
                onConfirm: () => window.location.reload()
              })
            }
          >
            <LogOut size={16} />
            <span>LOG KELUAR</span>
          </button>
        </div>
      </header>

      {/* Main Layout - Professional Polish Grid */}
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 p-4 sm:p-5 lg:overflow-hidden">
        
        {/* Registration Card (Sidebar) */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:overflow-hidden">
          <div className="px-4 py-4 border-b border-slate-100 bg-[#fdfdfd] flex items-center gap-2">
            <PlusCircle size={18} className="text-gov-blue" />
            <h2 className="text-sm font-bold text-gov-blue uppercase tracking-wide">DAFTAR REKOD KESALAHAN</h2>
          </div>
          
          <div className="flex-grow lg:overflow-y-auto p-5 custom-scrollbar">
            <form onSubmit={handleSave} className="flex flex-col gap-5 h-full">
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <Calendar size={12} /> Tarikh Kejadian
                  </label>
                  <input 
                    type="date" 
                    required
                    className="w-full bg-white border-[1.5px] border-slate-200 rounded-md px-3 py-2.5 text-sm focus:border-gov-blue outline-none transition-colors"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <User size={12} /> Nama Pelajar
                  </label>
                  <input 
                    type="text" 
                    placeholder="Contoh: AHMAD BIN ALI"
                    required
                    className="w-full bg-white border-[1.5px] border-slate-200 rounded-md px-3 py-2.5 text-sm focus:border-gov-blue outline-none uppercase transition-colors"
                    value={formData.studentName}
                    onChange={e => setFormData({...formData, studentName: e.target.value})}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <GraduationCap size={12} /> Kelas
                  </label>
                  <select 
                    required
                    className="w-full bg-white border-[1.5px] border-slate-200 rounded-md px-3 py-2 text-sm focus:border-gov-blue outline-none transition-colors h-[42px]"
                    value={formData.className}
                    onChange={e => setFormData({...formData, className: e.target.value})}
                  >
                    <option value="">-- PILIH KELAS --</option>
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <AlertCircle size={12} /> Jenis Kesalahan
                  </label>
                  <select 
                    required
                    className="w-full bg-white border-[1.5px] border-slate-200 rounded-md px-3 py-2 text-sm focus:border-gov-blue outline-none transition-colors h-[42px]"
                    value={formData.violation}
                    onChange={e => setFormData({...formData, violation: e.target.value})}
                  >
                    <option value="">-- PILIH KESALAHAN --</option>
                    {VIOLATIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">Tindakan</label>
                  <select 
                    required
                    className="w-full bg-white border-[1.5px] border-slate-200 rounded-md px-3 py-2 text-sm focus:border-gov-blue outline-none transition-colors h-[42px]"
                    value={formData.action}
                    onChange={e => setFormData({...formData, action: e.target.value})}
                  >
                    <option value="">-- PILIH TINDAKAN --</option>
                    {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">Intervensi / Nota</label>
                  <textarea 
                    rows={2}
                    className="w-full bg-white border-[1.5px] border-slate-200 rounded-md px-3 py-2 text-sm focus:border-gov-blue outline-none resize-none transition-colors"
                    placeholder="Maklumat tambahan..."
                    value={formData.intervention}
                    onChange={e => setFormData({...formData, intervention: e.target.value})}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSaving}
                className={`mt-4 w-full py-3.5 rounded-lg font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                  isSaving ? 'bg-slate-300 transform-none' : 'bg-gov-blue hover:bg-gov-blue/95 text-white active:scale-[0.98]'
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>SEDANG MENYIMPAN...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>SIMPAN REKOD</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Configuration Section */}
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-gov-blue transition-colors"
            >
              <span>Konfigurasi Awan (Cloud Sync)</span>
              <motion.div animate={{ rotate: showConfig ? 180 : 0 }}>
                <PlusCircle size={14} />
              </motion.div>
            </button>
            
            <AnimatePresence>
              {showConfig && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                          <FolderOpen size={11} /> ID Folder Google Drive (PDF)
                        </label>
                        {extractDriveFolderId(driveFolderId) && (
                          <a
                            href={`https://drive.google.com/drive/folders/${extractDriveFolderId(driveFolderId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] font-bold text-gov-blue hover:underline flex items-center gap-0.5"
                          >
                            Buka Drive <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                      <input 
                        type="text" 
                        placeholder={DEFAULT_DRIVE_FOLDER_ID}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[10px] font-mono outline-none focus:border-gov-blue"
                        value={driveFolderId}
                        onChange={e => setDriveFolderId(e.target.value)}
                        onBlur={() => {
                          const clean = extractDriveFolderId(driveFolderId);
                          if (clean) setDriveFolderId(clean);
                        }}
                      />
                      <p className="text-[9px] text-slate-500 font-medium">
                        ID folder ini dihantar bersama PDF ke Apps Script anda untuk disimpan ke Google Drive.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[9px] text-slate-400 font-medium">URL Web App Apps Script (Sinkronisasi Google Sheets):</p>
                      <input 
                        type="text" 
                        placeholder="https://script.google.com/macros/s/..."
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[10px] outline-none focus:border-gov-blue"
                        value={syncUrl}
                        onChange={e => setSyncUrl(e.target.value)}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Log Display Card (Main) */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:overflow-hidden min-h-[420px]">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-[#fdfdfd] flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-gov-blue" />
                <h2 className="text-sm font-bold text-gov-blue uppercase tracking-wide">LOG DISIPLIN TERKINI</h2>
              </div>
              
              <button 
                onClick={fetchDataFromSheet}
                disabled={isFetching || !syncUrl}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                  isFetching 
                    ? 'bg-slate-50 text-slate-400 border-slate-200' 
                    : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
              >
                {isFetching ? (
                  <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                ) : (
                  <PlusCircle size={12} className="rotate-45" /> 
                )}
                <span>SYNC DATA</span>
              </button>

              <button 
                onClick={() => setShowAllRecordsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border bg-gov-blue text-white border-gov-blue hover:bg-gov-blue/90 shadow-sm cursor-pointer"
              >
                <Database size={12} />
                <span>LIHAT SEMUA REKOD LAPORAN</span>
              </button>
            </div>
            
            {/* Stats Bar Component */}
            <div className="flex gap-3 sm:gap-4">
              <div className="bg-slate-100 px-3 sm:px-4 py-1.5 rounded-lg flex flex-col items-center min-w-[72px] sm:min-w-[80px]">
                <span className="text-lg font-black text-gov-blue leading-none">{String(stats.today).padStart(2, '0')}</span>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Hari Ini</span>
              </div>
              <div className="bg-slate-100 px-3 sm:px-4 py-1.5 rounded-lg flex flex-col items-center min-w-[72px] sm:min-w-[80px]">
                <span className="text-lg font-black text-gov-blue leading-none">{String(stats.week).padStart(2, '0')}</span>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Minggu Ini</span>
              </div>
              <div 
                onClick={() => setShowAllRecordsModal(true)}
                className="bg-gov-gold/10 px-3 sm:px-4 py-1.5 rounded-lg flex flex-col items-center min-w-[72px] sm:min-w-[80px] border border-gov-gold/20 hover:bg-gov-gold/20 transition-all cursor-pointer"
                title="Klik untuk lihat semua rekod laporan"
              >
                <span className="text-lg font-black text-gov-gold leading-none">{String(stats.total).padStart(2, '0')}</span>
                <span className="text-[8px] font-bold text-gov-gold uppercase tracking-tighter flex items-center gap-0.5">Jumlah <Database size={8} /></span>
              </div>
            </div>
          </div>

          {/* Table Filters - Professional Polish Pills */}
          <div className="px-4 sm:px-6 py-4 flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-4 sm:px-5 py-2 rounded-full text-[11px] font-bold transition-all whitespace-nowrap uppercase tracking-widest border cursor-pointer ${
                  filterTab === tab 
                    ? 'bg-gov-blue text-white border-gov-blue shadow-sm' 
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {tab === 'today' ? 'Hari Ini' : tab === 'week' ? 'Minggu Ini' : tab === 'month' ? 'Bulan Ini' : 'Semua Rekod'}
              </button>
            ))}
          </div>

          {/* Table Container */}
          <div className="flex-grow overflow-x-auto lg:overflow-y-auto px-4 sm:px-6 pb-6 custom-scrollbar">
            <table className="w-full text-left min-w-[600px]">
              <thead className="sticky top-0 bg-[#f1f5f9] z-20">
                <tr>
                  <th className="px-4 py-3.5 text-[11px] font-black text-gov-blue uppercase tracking-widest border-b-2 border-slate-200">Tarikh</th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-gov-blue uppercase tracking-widest border-b-2 border-slate-200">Pelajar / Kelas</th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-gov-blue uppercase tracking-widest border-b-2 border-slate-200">Kesalahan</th>
                  <th className="px-4 py-3.5 text-[11px] font-black text-gov-blue uppercase tracking-widest border-b-2 border-slate-200">Pilihan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map(record => (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={record.id} 
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-xs font-bold text-slate-800">{parseLocalDate(record.date).toLocaleDateString('ms-MY')}</div>
                          <div className="text-[9px] text-slate-400 font-mono mt-0.5">#{record.id.slice(0, 8)}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-bold text-slate-800 leading-tight group-hover:text-gov-blue transition-colors uppercase">{record.studentName}</div>
                          <div className="text-[10px] text-slate-500 font-bold mt-0.5">KELAS: {record.className}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="mb-1">{getViolationBadge(record.violation)}</div>
                          <div className="text-[11px] font-medium text-slate-400 uppercase leading-none">{record.action}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => generateReport(record)}
                              className="px-3 py-1.5 gap-1.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold hover:bg-blue-100 transition-colors flex items-center"
                            >
                              <FileText size={12} /> LAPORAN
                            </button>
                            <button 
                              onClick={() => generateLetter(record)}
                              className="px-3 py-1.5 gap-1.5 rounded bg-red-50 text-red-700 border border-red-100 text-[10px] font-bold hover:bg-red-100 transition-colors flex items-center"
                            >
                              <Mail size={12} /> SURAT
                            </button>
                            <button 
                              onClick={() => deleteRecord(record.id)}
                              className="p-1.5 text-slate-200 hover:text-red-500 transition-colors"
                              title="Padam Rekod"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 opacity-20">
                          <Filter size={48} className="text-slate-400" />
                          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Tiada rekod ditemui</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Footer / Status - Professional Polish Version */}
      <footer className="h-[40px] bg-white border-t border-slate-200 flex items-center px-6 justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sistem Aktif & Terjamin</span>
        </div>
        <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
          Digitizing Malaysian School Discipline • UNIT HEM SJK CHUNG HUA BAU
        </p>
      </footer>

      {/* Full-Screen All Reports Modal */}
      <AnimatePresence>
        {showAllRecordsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-gov-blue text-white px-6 py-4 flex items-center justify-between border-b border-gov-gold/30">
                <div className="flex items-center gap-3">
                  <Database className="text-gov-gold" size={24} />
                  <div>
                    <h2 className="text-lg font-black tracking-wide uppercase">PANGKALAN DATA REKOD DISIPLIN PENUH</h2>
                    <p className="text-[10px] text-slate-300 font-medium">SJK CHUNG HUA BAU — URUS & LIHAT SEMUA LAPORAN</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => generateSummaryPDF(filteredModalRecords)}
                    className="flex items-center gap-2 bg-gov-gold text-gov-blue font-bold text-xs px-4 py-2 rounded hover:bg-gov-gold/90 transition-all cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>CETAK RINGKASAN REKOD ({filteredModalRecords.length})</span>
                  </button>
                  <button 
                    onClick={() => setShowAllRecordsModal(false)}
                    className="p-1.5 hover:bg-white/10 rounded transition-all text-white/80 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Dashboard Stats and Search */}
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:max-w-md">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search size={16} />
                  </span>
                  <input 
                    type="text"
                    placeholder="Cari nama pelajar, kelas, kesalahan, atau tindakan..."
                    className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-gov-blue transition-colors shadow-inner"
                    value={modalSearchQuery}
                    onChange={e => setModalSearchQuery(e.target.value)}
                  />
                  {modalSearchQuery && (
                    <button 
                      onClick={() => setModalSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Statistics of matching records */}
                <div className="flex items-center gap-4 flex-wrap text-xs font-bold text-slate-500">
                  <span className="bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                    Padanan: <span className="text-gov-blue font-black">{filteredModalRecords.length} rekod</span>
                  </span>
                  <span className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200">
                    Ponteng: <span className="font-black">{filteredModalRecords.filter(r => r.violation.includes('Ponteng')).length}</span>
                  </span>
                  <span className="bg-red-50 text-red-700 px-3 py-1.5 rounded-full border border-red-200">
                    Buli: <span className="font-black">{filteredModalRecords.filter(r => r.violation.includes('Buli')).length}</span>
                  </span>
                  <span className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full border border-purple-200">
                    Rokok/Vape: <span className="font-black">{filteredModalRecords.filter(r => r.violation.includes('Rokok')).length}</span>
                  </span>
                </div>
              </div>

              {/* Table Body */}
              <div className="flex-grow overflow-y-auto p-6 custom-scrollbar bg-white">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-[#f1f5f9] z-20">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-black text-gov-blue uppercase tracking-widest border-b border-slate-200">Bil</th>
                      <th className="px-4 py-3 text-[10px] font-black text-gov-blue uppercase tracking-widest border-b border-slate-200">Tarikh</th>
                      <th className="px-4 py-3 text-[10px] font-black text-gov-blue uppercase tracking-widest border-b border-slate-200">Nama Pelajar / Kelas</th>
                      <th className="px-4 py-3 text-[10px] font-black text-gov-blue uppercase tracking-widest border-b border-slate-200">Jenis Kesalahan</th>
                      <th className="px-4 py-3 text-[10px] font-black text-gov-blue uppercase tracking-widest border-b border-slate-200">Tindakan Diambil</th>
                      <th className="px-4 py-3 text-[10px] font-black text-gov-blue uppercase tracking-widest border-b border-slate-200">Dokumen / Pilihan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredModalRecords.length > 0 ? (
                      filteredModalRecords.map((record, index) => (
                        <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-slate-400">{index + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-xs font-bold text-slate-800">{parseLocalDate(record.date).toLocaleDateString('ms-MY')}</div>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">#{record.id.slice(0, 8)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-extrabold text-slate-800 uppercase leading-none">{record.studentName}</div>
                            <div className="text-[9px] text-slate-500 font-bold mt-1">KELAS: {record.className}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div>{getViolationBadge(record.violation)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-slate-600 font-bold uppercase">{record.action}</div>
                            {record.intervention && (
                              <div className="text-[9px] text-slate-400 mt-1 italic leading-tight truncate max-w-xs" title={record.intervention}>
                                Nota: {record.intervention}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => generateReport(record)}
                                className="px-2.5 py-1.5 gap-1 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-bold hover:bg-blue-100 transition-colors flex items-center cursor-pointer"
                              >
                                <FileText size={10} /> LAPORAN
                              </button>
                              <button 
                                onClick={() => generateLetter(record)}
                                className="px-2.5 py-1.5 gap-1 rounded bg-red-50 text-red-700 border border-red-100 text-[9px] font-bold hover:bg-red-100 transition-colors flex items-center cursor-pointer"
                              >
                                <Mail size={10} /> SURAT
                              </button>
                              <button 
                                onClick={() => deleteRecord(record.id)}
                                className="p-1 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                                title="Padam Rekod"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-3 opacity-20">
                            <Filter size={40} className="text-slate-400" />
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Tiada rekod laporan ditemui</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SJK Chung Hua Bau • e-Disiplin Pro Console</p>
                <button 
                  onClick={() => setShowAllRecordsModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs px-5 py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                >
                  TUTUP KONSOL
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog Modal */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-50 text-red-600 flex-shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-gov-blue uppercase tracking-wide">{confirmDialog.title}</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{confirmDialog.message}</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-12 right-5 z-[70] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : toast.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-white text-gov-blue border-slate-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-gov-blue flex-shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <OfflineIndicator />
    </div>
  );
}

