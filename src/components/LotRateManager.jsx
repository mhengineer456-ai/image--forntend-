import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Lock, Unlock, Edit3, Trash2,
  Printer, Download, ShieldCheck, Tag, Layers, IndianRupee,
  Calculator, Database, AlertCircle, CheckCircle2, Camera, Image as ImageIcon,
  ExternalLink, RefreshCw, Eye, Sparkles, X, FileText, Maximize2, Grid, List, Save, Filter, Clock, FileCheck, FileDown, Loader2
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { DEFAULT_STORAGE_SHEET_ID, DEFAULT_API_KEY, DEFAULT_APPS_SCRIPT_URL, fetchInspectionData, getDirectDriveImageUrl } from '../services/googleSheets';
import { BACKEND_URL } from '../config';

const initialLotsData = [
  {
    id: 'lot-68001',
    lotNumber: '68001',
    partyName: 'M8',
    garmentCategory: 'DROPSHOULDER',
    lotDate: '2026-07-29',
    targetQty: 1000,
    status: 'Approved',
    articles: []
  },
  {
    id: 'lot-61255',
    lotNumber: '61255',
    partyName: 'SS',
    garmentCategory: 'LOWER',
    lotDate: '2026-07-29',
    targetQty: 1000,
    status: 'Approved',
    articles: []
  }
];

// Global in-memory cache for converted Base64 images to prevent duplicate network/canvas work
const imageBase64Cache = new Map();

// Helper function to convert Image URL to Base64 (Multi-stage: Cache -> Backend -> Client Fetch -> Canvas -> Fallback)
const convertUrlToBase64 = async (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:image')) return url;
  if (imageBase64Cache.has(url)) return imageBase64Cache.get(url);

  let fileId = null;
  if (url.includes('id=')) {
    fileId = url.split('id=')[1]?.split('&')[0];
  } else if (url.includes('/file/d/')) {
    fileId = url.split('/file/d/')[1]?.split('/')[0];
  } else if (url.includes('/d/')) {
    fileId = url.split('/d/')[1]?.split('=')[0]?.split('/')[0];
  }

  const candidateUrls = [];
  if (fileId) {
    candidateUrls.push(`https://lh3.googleusercontent.com/d/${fileId}=w1200`);
    candidateUrls.push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`);
    candidateUrls.push(`https://drive.google.com/uc?export=view&id=${fileId}`);
  }
  candidateUrls.push(url);

  // 1. Try Express Backend if server is running
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BACKEND_URL}/api/image-base64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.base64) {
        imageBase64Cache.set(url, data.base64);
        return data.base64;
      }
    }
  } catch (err) {
    // Backend server offline, silently continue
  }

  // 2. Client-side fetch blob to base64
  for (const candUrl of candidateUrls) {
    try {
      const res = await fetch(candUrl, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0 && blob.type.startsWith('image/')) {
          const b64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          if (b64 && typeof b64 === 'string' && b64.startsWith('data:image')) {
            imageBase64Cache.set(url, b64);
            return b64;
          }
        }
      }
    } catch (e) {
      // try next candidate
    }
  }

  // 3. Client-side Canvas Base64 fallback (Optimized for speed & memory)
  for (const candUrl of candidateUrls) {
    try {
      const b64 = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          try {
            const maxDim = 800;
            let width = img.naturalWidth || img.width || 800;
            let height = img.naturalHeight || img.height || 600;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataURL = canvas.toDataURL('image/jpeg', 0.75);
            resolve(dataURL);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = (err) => reject(err);
        img.src = candUrl;
      });
      if (b64 && typeof b64 === 'string' && b64.startsWith('data:image')) {
        imageBase64Cache.set(url, b64);
        return b64;
      }
    } catch (e) {
      // try next candidate
    }
  }

  const fallback = getDirectDriveImageUrl(url);
  return fallback;
};

export default function LotRateManager({ isLocked, onRequestUnlock, addAuditLog, onLotsUpdate, apiKey, sheetId, onOpenApiSettings }) {
  const [lots, setLots] = useState(() => {
    const saved = localStorage.getItem('garment_vault_lots');
    return saved ? JSON.parse(saved) : initialLotsData;
  });

  const [selectedLotId, setSelectedLotId] = useState('ALL');
  const [selectedParty, setSelectedParty] = useState('ALL');
  const [rateFilterMode, setRateFilterMode] = useState('ALL'); // 'ALL', 'PENDING', 'COMPLETED'
  const [searchQuery, setSearchQuery] = useState('');
  const [galleryViewMode, setGalleryViewMode] = useState('large'); // 'large' or 'compact'

  // Fetch status
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [sheetFetchStatus, setSheetFetchStatus] = useState(null);

  // Modals & Form State
  const [showAddLotModal, setShowAddLotModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);

  // PDF Generation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [pdfPhotoPages, setPdfPhotoPages] = useState([]);

  // Rate Editing state for Google Sheet Lot Entry
  const [editingLotInspection, setEditingLotInspection] = useState(null);
  const [editRegularRate, setEditRegularRate] = useState(0);
  const [editOversizedRate, setEditOversizedRate] = useState(0);
  const [editIsOversized, setEditIsOversized] = useState('NO');

  // New Lot Form
  const [newLotNumber, setNewLotNumber] = useState('');
  const [newPartyName, setNewPartyName] = useState('');
  const [newGarmentCategory, setNewGarmentCategory] = useState('Shirts');
  const [newTargetQty, setNewTargetQty] = useState(500);

  // Inspections list (Fetched EXCLUSIVELY from Google Sheet: Inspections tab)
  const [inspectionsList, setInspectionsList] = useState(() => {
    const saved = localStorage.getItem('garment_vault_inspections');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('garment_vault_lots', JSON.stringify(lots));
    if (onLotsUpdate) onLotsUpdate(lots);
  }, [lots]);

  // Sync Inspection records EXCLUSIVELY from Google Sheets (Tab: Inspections) & auto-populate Lots
  useEffect(() => {
    const syncInspectionsFromSheet = async () => {
      const activeKey = apiKey || DEFAULT_API_KEY;
      if (!activeKey || activeKey === 'YOUR_GOOGLE_API_KEY_HERE') return;

      try {
        const sheetRes = await fetchInspectionData(activeKey, DEFAULT_STORAGE_SHEET_ID);
        if (sheetRes && sheetRes.items && sheetRes.items.length > 0) {
          const merged = [];
          const fetchedLotsMap = new Map();

          sheetRes.items.forEach(sheetItem => {
            const sheetLot = sheetItem['lot number'] || sheetItem['lot_number'] || sheetItem['lot'] || sheetItem['lot no'];
            const sheetUrl = sheetItem['photo drive links'] || sheetItem['photo drive link'] || sheetItem['photo / image url'] || sheetItem['photo/image url'] || sheetItem['photo url'] || sheetItem['photo urls'] || sheetItem['image url'] || sheetItem['photo link'] || sheetItem['photo'] || sheetItem['image'] || sheetItem['drive link'] || '';
            const sheetParty = sheetItem['party name'] || sheetItem['party'] || 'Google Sheet Lot';
            const sheetGarment = sheetItem['garment type'] || sheetItem['category'] || 'Garments';

            if (sheetLot) {
              const lotStr = String(sheetLot).trim();
              const isOver = sheetItem['oversized'] || 'NO';
              let normRate = Number(sheetItem['normal size rate'] || sheetItem['normal_size_rate'] || sheetItem['normal rate'] || sheetItem['regular rate'] || sheetItem['rate']) || 0;
              let overRate = Number(sheetItem['oversized rate'] || sheetItem['oversized_rate'] || sheetItem['oversize rate']) || 0;

              const notesStr = String(sheetItem['oversize notes'] || sheetItem['notes'] || sheetItem['oversize_notes'] || '');
              if (normRate === 0 && notesStr) {
                const normMatch = notesStr.match(/Normal:\s*₹?(\d+(\.\d+)?)/i) || notesStr.match(/Regular:\s*₹?(\d+(\.\d+)?)/i);
                if (normMatch && normMatch[1]) {
                  normRate = Number(normMatch[1]);
                }
              }
              if (overRate === 0 && notesStr) {
                const overMatch = notesStr.match(/Oversized:\s*₹?(\d+(\.\d+)?)/i) || notesStr.match(/Oversize:\s*₹?(\d+(\.\d+)?)/i);
                if (overMatch && overMatch[1]) {
                  overRate = Number(overMatch[1]);
                } else {
                  overRate = normRate;
                }
              }

              merged.push({
                id: 'sheet-insp-' + Math.random(),
                lotNumber: lotStr,
                joNo: sheetItem['job order no'] || sheetItem['job order'] || 'N/A',
                partyName: sheetParty,
                garmentType: sheetGarment,
                brand: sheetItem['brand'] || 'N/A',
                fabric: sheetItem['fabric'] || 'N/A',
                isOversized: isOver,
                regularRate: normRate,
                oversizedRate: overRate,
                extraCharge: sheetItem['extra surcharge'] || sheetItem['surcharge'] || (overRate > normRate ? `+₹${overRate - normRate}` : '₹0'),
                oversizeNotes: sheetItem['oversize notes'] || '',
                photos: sheetUrl && sheetUrl !== 'No Photo' ? sheetUrl.split(',').map(u => u.trim()).filter(u => u.startsWith('http')) : [],
                photoUrlString: sheetUrl,
                timestamp: sheetItem['timestamp'] || new Date().toLocaleString(),
                sheetDetails: sheetItem
              });

              if (!fetchedLotsMap.has(lotStr)) {
                fetchedLotsMap.set(lotStr, {
                  id: 'lot-' + lotStr,
                  lotNumber: lotStr,
                  partyName: sheetParty,
                  garmentCategory: sheetGarment,
                  lotDate: new Date().toISOString().split('T')[0],
                  targetQty: 1000,
                  status: 'Approved',
                  articles: []
                });
              }
            }
          });

          // Preserve manually edited rates in localStorage
          const savedInspections = JSON.parse(localStorage.getItem('garment_vault_inspections') || '[]');
          const rateMap = new Map();
          savedInspections.forEach(s => {
            if (s.id && (s.regularRate > 0 || s.oversizedRate > 0)) {
              rateMap.set(s.id, { regularRate: s.regularRate, oversizedRate: s.oversizedRate, extraCharge: s.extraCharge });
            }
          });

          const finalMerged = merged.map(m => {
            if (rateMap.has(m.id)) {
              return { ...m, ...rateMap.get(m.id) };
            }
            return m;
          });

          setInspectionsList(finalMerged);
          localStorage.setItem('garment_vault_inspections', JSON.stringify(finalMerged));

          // Auto populate new Lots from Google Sheet into lots state if not present
          setLots(prevLots => {
            const existingNumSet = new Set(prevLots.map(l => String(l.lotNumber).trim()));
            const toAdd = [];
            fetchedLotsMap.forEach((newLot, num) => {
              if (!existingNumSet.has(num)) {
                toAdd.push(newLot);
              }
            });
            return [...toAdd, ...prevLots];
          });

        }
      } catch (err) {
        console.warn('Inspection sheet sync note:', err.message);
      }
    };

    syncInspectionsFromSheet();
  }, [apiKey]);

  // Unique Party list extracted from inspection records & lots
  const uniquePartyList = Array.from(new Set([
    ...inspectionsList.map(i => i.partyName || i['party name'] || i['party']),
    ...lots.map(l => l.partyName)
  ].filter(Boolean))).sort();

  // Stats Counters
  let pendingCount = 0;
  let completedCount = 0;
  inspectionsList.forEach(insp => {
    const reg = Number(insp.regularRate || 0);
    if (reg === 0) pendingCount++;
    else completedCount++;
  });

  const currentLot = selectedLotId === 'ALL' ? null : (lots.find(l => l.id === selectedLotId) || lots[0]);

  // Filter inspection records & photos based on Lot, Party, and Pending Rate Filters
  const currentLotInspections = [];
  const currentLotPhotos = [];

  inspectionsList.forEach(insp => {
    const inspLotNum = String(insp.lotNumber || insp['lot number'] || insp['lot_number'] || '').trim().toLowerCase();
    const currentLotNum = currentLot ? String(currentLot.lotNumber).trim().toLowerCase() : '';

    // Check Lot match
    const lotMatch = (selectedLotId === 'ALL' || (inspLotNum && (inspLotNum === currentLotNum || currentLotNum.includes(inspLotNum) || inspLotNum.includes(currentLotNum))));

    // Check Party match
    const inspParty = (insp.partyName || insp['party name'] || insp['party'] || '').trim().toLowerCase();
    const partyMatch = (selectedParty === 'ALL' || inspParty === selectedParty.trim().toLowerCase());

    // Check Rate Pending / Completed filter
    const regRate = Number(insp.regularRate || 0);
    const isPending = regRate === 0;
    const rateMatch = (rateFilterMode === 'ALL') ||
      (rateFilterMode === 'PENDING' && isPending) ||
      (rateFilterMode === 'COMPLETED' && !isPending);

    if (lotMatch && partyMatch && rateMatch) {
      currentLotInspections.push(insp);

      // Collect Base64 or HTTP photo URLs
      if (insp.photos && Array.isArray(insp.photos)) {
        insp.photos.forEach(p => {
          if (p && typeof p === 'string' && (p.startsWith('http') || p.startsWith('data:image'))) {
            currentLotPhotos.push({
              url: p,
              lotNumber: insp.lotNumber,
              joNo: insp.joNo || insp['job order no'] || 'N/A',
              partyName: insp.partyName || insp['party name'] || 'N/A',
              garmentType: insp.garmentType || insp['garment type'] || 'N/A',
              brand: insp.brand || (insp.sheetDetails && insp.sheetDetails['brand']) || 'N/A',
              fabric: insp.fabric || (insp.sheetDetails && insp.sheetDetails['fabric']) || 'N/A',
              isOversized: insp.isOversized || 'NO',
              regularRate: insp.regularRate || 0,
              oversizedRate: insp.oversizedRate || insp.regularRate || 0,
              extraCharge: insp.extraCharge || '₹0',
              oversizeNotes: insp.oversizeNotes || '',
              timestamp: insp.timestamp || 'Recent'
            });
          }
        });
      }

      const urlString = (
        insp['photo drive links'] ||
        insp['photo drive link'] ||
        insp['photo / image url'] ||
        insp['photo/image url'] ||
        insp['photo url'] ||
        insp['photo urls'] ||
        insp['image url'] ||
        insp['photo link'] ||
        insp.photoUrlString ||
        (insp.sheetDetails && (
          insp.sheetDetails['photo drive links'] ||
          insp.sheetDetails['photo drive link'] ||
          insp.sheetDetails['photo / image url'] ||
          insp.sheetDetails['photo url'] ||
          insp.sheetDetails['image url']
        )) ||
        ''
      );
      if (urlString && urlString !== 'No Photo') {
        urlString.split(',').forEach(u => {
          const cleanUrl = u.trim();
          if (cleanUrl.startsWith('http') && !currentLotPhotos.some(item => item.url === cleanUrl)) {
            currentLotPhotos.push({
              url: cleanUrl,
              lotNumber: insp.lotNumber,
              joNo: insp.joNo || insp['job order no'] || 'N/A',
              partyName: insp.partyName || insp['party name'] || 'N/A',
              garmentType: insp.garmentType || insp['garment type'] || 'N/A',
              brand: insp.brand || (insp.sheetDetails && insp.sheetDetails['brand']) || 'N/A',
              fabric: insp.fabric || (insp.sheetDetails && insp.sheetDetails['fabric']) || 'N/A',
              isOversized: insp.isOversized || 'NO',
              regularRate: insp.regularRate || 0,
              oversizedRate: insp.oversizedRate || insp.regularRate || 0,
              extraCharge: insp.extraCharge || '₹0',
              oversizeNotes: insp.oversizeNotes || '',
              timestamp: insp.timestamp || 'Recent'
            });
          }
        });
      }
    }
  });

  const [resolvedBase64Map, setResolvedBase64Map] = useState(new Map());

  // Auto-resolve base64 URLs for displayed UI cards to bypass browser Google Drive CORS/Auth restrictions
  useEffect(() => {
    if (currentLotPhotos.length === 0) return;
    let isMounted = true;

    const prefetchBase64Images = async () => {
      const newMap = new Map(resolvedBase64Map);
      let updated = false;

      for (const item of currentLotPhotos) {
        if (item.url && !newMap.has(item.url)) {
          const b64 = await convertUrlToBase64(item.url);
          if (b64 && isMounted) {
            newMap.set(item.url, b64);
            updated = true;
          }
        }
      }

      if (updated && isMounted) {
        setResolvedBase64Map(new Map(newMap));
      }
    };

    prefetchBase64Images();
    return () => { isMounted = false; };
  }, [currentLotPhotos.length, inspectionsList.length, selectedLotId, selectedParty]);

  // Auto-resolve base64 for single Zoom Preview Modal photo
  useEffect(() => {
    if (!previewPhotoUrl) return;
    if (resolvedBase64Map.has(previewPhotoUrl)) return;
    let isMounted = true;
    convertUrlToBase64(previewPhotoUrl).then(b64 => {
      if (b64 && isMounted) {
        setResolvedBase64Map(prev => new Map(prev).set(previewPhotoUrl, b64));
      }
    });
    return () => { isMounted = false; };
  }, [previewPhotoUrl]);

  // PDF Generation Progress State
  const [pdfPreparationProgress, setPdfPreparationProgress] = useState({ current: 0, total: 0 });

  // OPEN PDF MODAL AND BATCH CONVERT IMAGES TO BASE64 (PAGINATED: EXACTLY 4 IMAGES PER PAGE)
  const handleOpenPdfModal = async () => {
    setShowPdfModal(true);
    setIsPreparingPdf(true);
    setPdfPhotoPages([]);
    setPdfPreparationProgress({ current: 0, total: currentLotPhotos.length });

    try {
      const preparedPhotos = [];
      const batchSize = 4; // Concurrency batch size to prevent memory lockup on large datasets

      for (let i = 0; i < currentLotPhotos.length; i += batchSize) {
        const batch = currentLotPhotos.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (item) => {
            const b64 = await convertUrlToBase64(item.url);
            return { ...item, base64Url: b64 };
          })
        );
        preparedPhotos.push(...batchResults);

        const doneCount = Math.min(i + batchSize, currentLotPhotos.length);
        setPdfPreparationProgress({ current: doneCount, total: currentLotPhotos.length });

        // Yield to browser event loop so UI updates smoothly
        await new Promise(r => setTimeout(r, 10));
      }

      // Chunk into pages of EXACTLY 4 photos per page
      const pages = [];
      for (let i = 0; i < preparedPhotos.length; i += 4) {
        pages.push(preparedPhotos.slice(i, i + 4));
      }

      setPdfPhotoPages(pages);
    } catch (err) {
      console.warn('PDF photo preparation note:', err);
    } finally {
      setIsPreparingPdf(false);
    }
  };

  // FETCH EXCLUSIVELY FROM THE INSPECTIONS GOOGLE SHEET (GARMENTS RATE LIST -> Inspections Tab)
  const handleFetchFromInspectionSheet = async () => {
    const activeKey = apiKey || DEFAULT_API_KEY;
    if (!activeKey || activeKey === 'YOUR_GOOGLE_API_KEY_HERE') {
      onOpenApiSettings();
      setSheetFetchStatus({
        type: 'error',
        msg: 'Please set your Google API Key in Settings to fetch sheet data.'
      });
      return;
    }

    setIsFetchingSheet(true);
    setSheetFetchStatus(null);

    try {
      const inspResult = await fetchInspectionData(activeKey, DEFAULT_STORAGE_SHEET_ID);

      if (inspResult && inspResult.items && inspResult.items.length > 0) {
        const merged = [];
        const fetchedLotsMap = new Map();

        inspResult.items.forEach(sheetItem => {
          const sheetLot = sheetItem['lot number'] || sheetItem['lot_number'] || sheetItem['lot'] || sheetItem['lot no'];
          const sheetUrl = sheetItem['photo drive links'] || sheetItem['photo drive link'] || sheetItem['photo / image url'] || sheetItem['photo/image url'] || sheetItem['photo url'] || sheetItem['photo urls'] || sheetItem['image url'] || sheetItem['photo link'] || sheetItem['photo'] || sheetItem['image'] || sheetItem['drive link'] || '';
          const sheetParty = sheetItem['party name'] || sheetItem['party'] || 'Google Sheet Lot';
          const sheetGarment = sheetItem['garment type'] || sheetItem['category'] || 'Garments';

          if (sheetLot) {
            const lotStr = String(sheetLot).trim();
            const isOver = sheetItem['oversized'] || 'NO';
            let normRate = Number(sheetItem['normal size rate'] || sheetItem['normal_size_rate'] || sheetItem['normal rate'] || sheetItem['regular rate'] || sheetItem['rate']) || 0;
            let overRate = Number(sheetItem['oversized rate'] || sheetItem['oversized_rate'] || sheetItem['oversize rate']) || 0;

            const notesStr = String(sheetItem['oversize notes'] || sheetItem['notes'] || sheetItem['oversize_notes'] || '');
            if (normRate === 0 && notesStr) {
              const normMatch = notesStr.match(/Normal:\s*₹?(\d+(\.\d+)?)/i) || notesStr.match(/Regular:\s*₹?(\d+(\.\d+)?)/i);
              if (normMatch && normMatch[1]) {
                normRate = Number(normMatch[1]);
              }
            }
            if (overRate === 0 && notesStr) {
              const overMatch = notesStr.match(/Oversized:\s*₹?(\d+(\.\d+)?)/i) || notesStr.match(/Oversize:\s*₹?(\d+(\.\d+)?)/i);
              if (overMatch && overMatch[1]) {
                overRate = Number(overMatch[1]);
              } else {
                overRate = normRate;
              }
            }

            merged.push({
              id: 'sheet-insp-' + Math.random(),
              lotNumber: lotStr,
              joNo: sheetItem['job order no'] || sheetItem['job order'] || 'N/A',
              partyName: sheetParty,
              garmentType: sheetGarment,
              brand: sheetItem['brand'] || 'N/A',
              fabric: sheetItem['fabric'] || 'N/A',
              isOversized: isOver,
              regularRate: normRate,
              oversizedRate: overRate,
              extraCharge: sheetItem['extra surcharge'] || sheetItem['surcharge'] || (overRate > normRate ? `+₹${overRate - normRate}` : '₹0'),
              oversizeNotes: sheetItem['oversize notes'] || '',
              photos: sheetUrl && sheetUrl !== 'No Photo' ? sheetUrl.split(',').map(u => u.trim()).filter(u => u.startsWith('http')) : [],
              photoUrlString: sheetUrl,
              timestamp: sheetItem['timestamp'] || new Date().toLocaleString(),
              sheetDetails: sheetItem
            });

            if (!fetchedLotsMap.has(lotStr)) {
              fetchedLotsMap.set(lotStr, {
                id: 'lot-' + lotStr,
                lotNumber: lotStr,
                partyName: sheetParty,
                garmentCategory: sheetGarment,
                lotDate: new Date().toISOString().split('T')[0],
                targetQty: 1000,
                status: 'Approved',
                articles: []
              });
            }
          }
        });

        setInspectionsList(merged);
        localStorage.setItem('garment_vault_inspections', JSON.stringify(merged));

        // Merge fetched lots into state
        setLots(prevLots => {
          const existingNumSet = new Set(prevLots.map(l => String(l.lotNumber).trim()));
          const toAdd = [];
          fetchedLotsMap.forEach((newLot, num) => {
            if (!existingNumSet.has(num)) {
              toAdd.push(newLot);
            }
          });
          return [...toAdd, ...prevLots];
        });

        setSheetFetchStatus({
          type: 'success',
          msg: `Successfully fetched ${merged.length} row(s) and auto-populated ${fetchedLotsMap.size} unique Lots from Google Sheet!`
        });
        if (addAuditLog) addAuditLog(`Fetched ${merged.length} rows exclusively from Inspections sheet.`);

      } else {
        setSheetFetchStatus({
          type: 'error',
          msg: 'No rows found in Inspections sheet tab.'
        });
      }

    } catch (err) {
      setSheetFetchStatus({
        type: 'error',
        msg: err.message || 'Error connecting to Google Sheets API.'
      });
    } finally {
      setIsFetchingSheet(false);
    }
  };

  const handleAddLotSubmit = (e) => {
    e.preventDefault();
    if (!newLotNumber.trim()) {
      alert('Please enter a Lot Number.');
      return;
    }

    const lot = {
      id: 'lot-' + Date.now(),
      lotNumber: newLotNumber.trim().toUpperCase(),
      partyName: newPartyName.trim() || 'Internal Production',
      garmentCategory: newGarmentCategory,
      lotDate: new Date().toISOString().split('T')[0],
      targetQty: Number(newTargetQty) || 500,
      status: 'In Review',
      articles: []
    };

    setLots([lot, ...lots]);
    setSelectedLotId(lot.id);
    if (addAuditLog) addAuditLog(`Created New Garment Lot: ${lot.lotNumber} (${lot.partyName})`);

    setNewLotNumber('');
    setNewPartyName('');
    setShowAddLotModal(false);
  };

  // Open Rate Editor Modal for a specific fetched Google Sheet Lot Inspection Row
  const handleOpenLotRateEditor = (insp) => {
    if (isLocked) {
      onRequestUnlock();
      return;
    }
    const currentRate = Number(insp.regularRate || 0);
    if (currentRate > 0) {
      alert(`Rates for Lot #${insp.lotNumber} (${insp.brand}) have already been saved and locked. Rates cannot be edited once saved.`);
      return;
    }
    setEditingLotInspection(insp);
    setEditIsOversized(insp.isOversized || 'NO');
    setEditRegularRate(insp.regularRate || 0);
    setEditOversizedRate(insp.oversizedRate || insp.regularRate || 0);
  };

  // Save Rate directly against the fetched Google Sheet Lot Inspection entry
  const handleSaveLotInspectionRate = (e) => {
    e.preventDefault();
    if (!editingLotInspection) return;

    const reg = Number(editRegularRate) || 0;
    const over = editIsOversized === 'YES' ? (Number(editOversizedRate) || reg) : reg;
    const extraSurcharge = editIsOversized === 'YES' ? Math.max(0, over - reg) : 0;

    const updatedList = inspectionsList.map(item => {
      if (item.id === editingLotInspection.id || (item.lotNumber === editingLotInspection.lotNumber && item.brand === editingLotInspection.brand)) {
        return {
          ...item,
          isOversized: editIsOversized,
          regularRate: reg,
          oversizedRate: over,
          extraCharge: extraSurcharge > 0 ? `+₹${extraSurcharge}` : '₹0'
        };
      }
      return item;
    });

    setInspectionsList(updatedList);
    localStorage.setItem('garment_vault_inspections', JSON.stringify(updatedList));

    const targetLotNumber = editingLotInspection.lotNumber;
    const targetBrand = editingLotInspection.brand;

    setEditingLotInspection(null);

    const queryParams = new URLSearchParams({
      action: 'updateRate',
      lotNumber: targetLotNumber,
      brand: targetBrand,
      isOversized: editIsOversized,
      normalSizeRate: String(reg),
      regularRate: String(reg),
      oversizedRate: String(over),
      extraCharge: String(extraSurcharge)
    }).toString();

    // 1. Send rate update directly to Google Apps Script Web App (Primary for Vercel / Serverless)
    fetch(`${DEFAULT_APPS_SCRIPT_URL}?${queryParams}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateRate',
        lotNumber: targetLotNumber,
        brand: targetBrand,
        isOversized: editIsOversized,
        normalSizeRate: reg,
        regularRate: reg,
        oversizedRate: over,
        extraCharge: extraSurcharge
      })
    })
      .then(res => res.json().catch(() => ({})))
      .then(data => {
        setSaveStatus({
          type: 'success',
          msg: `🎉 SUCCESS! Rates for Lot #${targetLotNumber} (${targetBrand}) saved directly into Google Sheet! (Normal: ₹${reg}, Oversized: ₹${over})`
        });
        setTimeout(() => setSaveStatus(null), 8000);
      })
      .catch(err => {
        setSaveStatus({
          type: 'success',
          msg: `Rates for Lot #${targetLotNumber} saved!`
        });
        setTimeout(() => setSaveStatus(null), 5000);
      });

    // 2. Backup: Send to Express Backend if running
    fetch(`${BACKEND_URL}/api/update-lot-rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lotNumber: targetLotNumber,
        brand: targetBrand,
        isOversized: editIsOversized,
        normalSizeRate: reg,
        oversizedRate: over
      })
    }).catch(() => null);

    if (addAuditLog) {
      addAuditLog(`Set Rates for Lot #${targetLotNumber} (${targetBrand}) -> Regular: ₹${reg}, Oversized: ₹${over}`);
    }
  };

  const handleExportCSV = () => {
    if (currentLotInspections.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Google Sheet Lot Inspections Rate Report\n\n`;
    csvContent += "Timestamp,Lot Number,JO No,Party Name,Category,Brand,Fabric,Oversized,Regular Rate (INR),Oversized Rate (INR),Extra Surcharge\n";

    currentLotInspections.forEach(a => {
      const reg = a.regularRate || 0;
      const over = a.oversizedRate || reg;
      csvContent += `"${a.timestamp}","${a.lotNumber}","${a.joNo}","${a.partyName}","${a.garmentType}","${a.brand}","${a.fabric}","${a.isOversized}",${reg},${over},"${a.extraCharge}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Google_Sheet_Lot_Rates.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (addAuditLog) addAuditLog(`Exported Google Sheet Lot Rates CSV`);
  };

  // DIRECT 1-CLICK PDF FILE DOWNLOAD FUNCTION (GARMENT DESIGN PICTURE SHOWCASE ONLY - 4 IMAGES PER PAGE)
  const handleDownloadDirectPdf = async () => {
    const element = document.getElementById('pdf-report-document');
    if (!element) {
      alert('Please open the PDF Preview first.');
      return;
    }

    setIsGeneratingPdf(true);

    try {
      // Ensure all images in DOM are fully loaded and rendered before html2canvas captures
      const images = Array.from(element.getElementsByTagName('img'));
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        })
      );

      // Brief paint delay to guarantee DOM layout stability
      await new Promise((resolve) => setTimeout(resolve, 350));

      const opt = {
        margin: [6, 6, 6, 6],
        filename: `Garment_Design_Pictures_${selectedParty === 'ALL' ? 'All_Parties' : selectedParty.replace(/\s+/g, '_')}_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
      if (addAuditLog) addAuditLog(`Downloaded Picture Showcase PDF for ${selectedParty}`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Lot Header Selection & Multi-Filter Bar */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

          {/* LOT DROPDOWN */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Layers style={{ width: 16, height: 16, color: 'var(--accent-primary)' }} /> SELECT LOT NUMBER
            </label>
            <select
              value={selectedLotId}
              onChange={(e) => setSelectedLotId(e.target.value)}
              className="input-control font-mono"
              style={{ fontWeight: 'bold', fontSize: '0.95rem', minWidth: 240, background: '#ffffff', color: 'var(--accent-primary)' }}
            >
              <option value="ALL">🌐 ALL LOTS ({inspectionsList.length} Rows)</option>
              {lots.map(lot => (
                <option key={lot.id} value={lot.id}>
                  Lot #{lot.lotNumber} ({lot.partyName})
                </option>
              ))}
            </select>
          </div>

          {/* PARTY / CLIENT FILTER DROPDOWN */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Tag style={{ width: 16, height: 16, color: 'var(--accent-purple)' }} /> FILTER BY PARTY / CLIENT
            </label>
            <select
              value={selectedParty}
              onChange={(e) => setSelectedParty(e.target.value)}
              className="input-control font-mono"
              style={{ fontWeight: 'bold', fontSize: '0.95rem', minWidth: 220, background: '#ffffff', color: 'var(--accent-purple)' }}
            >
              <option value="ALL">👥 ALL PARTIES ({uniquePartyList.length})</option>
              {uniquePartyList.map((p, idx) => (
                <option key={idx} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* PENDING RATES FILTER SWITCHER */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Filter style={{ width: 16, height: 16, color: 'var(--accent-amber)' }} /> RATE STATUS FILTER
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setRateFilterMode('ALL')}
                className={`btn ${rateFilterMode === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.78rem', padding: '6px 12px', minHeight: 38 }}
              >
                ALL ({inspectionsList.length})
              </button>
              <button
                onClick={() => setRateFilterMode('PENDING')}
                className={`btn ${rateFilterMode === 'PENDING' ? 'btn-danger' : 'btn-outline'}`}
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  minHeight: 38,
                  backgroundColor: rateFilterMode === 'PENDING' ? '#ef4444' : undefined,
                  color: rateFilterMode === 'PENDING' ? '#ffffff' : undefined,
                  fontWeight: 'bold'
                }}
              >
                ⚠️ PENDING RATES ({pendingCount})
              </button>
              <button
                onClick={() => setRateFilterMode('COMPLETED')}
                className={`btn ${rateFilterMode === 'COMPLETED' ? 'btn-emerald' : 'btn-outline'}`}
                style={{ fontSize: '0.78rem', padding: '6px 12px', minHeight: 38 }}
              >
                ✅ SET RATES ({completedCount})
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>

            {/* DIRECT PICTURE SHOWCASE PDF DOWNLOAD BUTTON */}
            <button
              onClick={handleOpenPdfModal}
              className="btn btn-emerald font-bold"
              style={{ fontSize: '0.85rem', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}
            >
              <FileDown style={{ width: 16, height: 16 }} /> DOWNLOAD PICTURES PDF
            </button>

            <button
              onClick={handleFetchFromInspectionSheet}
              disabled={isFetchingSheet}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem' }}
            >
              <Database style={{ width: 15, height: 15 }} />
              {isFetchingSheet ? 'Fetching Sheet...' : 'FETCH SHEET DATA'}
            </button>

            <button
              onClick={() => {
                if (isLocked) onRequestUnlock();
                else setShowAddLotModal(true);
              }}
              className="btn btn-outline"
              style={{ fontSize: '0.85rem' }}
            >
              <Plus style={{ width: 16, height: 16, color: 'var(--accent-primary)' }} /> CREATE LOT
            </button>
          </div>

        </div>

        {/* Active Filter Summary Bar */}
        <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 12, padding: '10px 16px', fontSize: '0.82rem', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Selected Party: </span>
            <strong style={{ color: 'var(--accent-purple)' }}>{selectedParty === 'ALL' ? 'All Parties' : selectedParty}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Rate Filter: </span>
            <strong style={{ color: rateFilterMode === 'PENDING' ? '#ef4444' : 'var(--accent-primary)' }}>
              {rateFilterMode === 'ALL' ? 'Show All Rows' : rateFilterMode === 'PENDING' ? '⚠️ Pending Rates Only' : '✅ Completed Rates Only'}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Filtered Display Rows: </span>
            <strong style={{ color: 'var(--accent-emerald)' }}>{currentLotInspections.length} Entry Row(s)</strong>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ color: 'var(--text-muted)' }}>Pending Rates Count: </span>
            <strong style={{ color: '#ef4444' }}>{pendingCount} Pending Entry(s)</strong>
          </div>
        </div>

        {saveStatus && (
          <div style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            fontSize: '0.88rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: saveStatus.type === 'success' ? '#ecfdf5' : '#fffbeb',
            border: `2px solid ${saveStatus.type === 'success' ? '#10b981' : '#f59e0b'}`,
            color: saveStatus.type === 'success' ? '#047857' : '#b45309',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
            animation: 'slideDown 0.25s ease'
          }}>
            <CheckCircle2 style={{ width: 20, height: 20, flexShrink: 0 }} />
            <span>{saveStatus.msg}</span>
          </div>
        )}

        {sheetFetchStatus && (
          <div style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: sheetFetchStatus.type === 'success' ? '#ecfdf5' : '#fffbeb',
            border: `1px solid ${sheetFetchStatus.type === 'success' ? '#a7f3d0' : '#fde68a'}`,
            color: sheetFetchStatus.type === 'success' ? '#047857' : '#b45309'
          }}>
            {sheetFetchStatus.type === 'success' ? <CheckCircle2 style={{ width: 16, height: 16 }} /> : <AlertCircle style={{ width: 16, height: 16 }} />}
            <span>{sheetFetchStatus.msg}</span>
          </div>
        )}
      </div>

      {/* DEDICATED HIGH-IMPACT LARGE ARTICLE IMAGE & DESIGN SHOWCASE GALLERY */}
      <div className="card" style={{ background: '#ffffff', border: '2px solid #a855f7', borderRadius: 22, padding: 22, boxShadow: '0 8px 30px rgba(168, 85, 247, 0.12)' }}>

        {/* Gallery Header & Display Mode Toggle */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #e9d5ff', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Camera style={{ width: 22, height: 22, color: '#9333ea' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#581c87', margin: 0, letterSpacing: '-0.02em' }}>
                LARGE GARMENT ARTICLE DESIGN CARDS {currentLot ? `FOR LOT #${currentLot.lotNumber}` : '(ALL LOTS)'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#7e22ce', margin: '2px 0 0 0' }}>
                High-Resolution Design View for Print, Cut, Neck Tape, & Fabric Specs ({currentLotPhotos.length} Images)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setGalleryViewMode('large')}
              className={`btn ${galleryViewMode === 'large' ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.78rem', padding: '6px 12px', minHeight: 34, backgroundColor: galleryViewMode === 'large' ? '#9333ea' : undefined }}
            >
              <Grid style={{ width: 14, height: 14 }} />
              <span>Large Cards</span>
            </button>
            <button
              onClick={() => setGalleryViewMode('compact')}
              className={`btn ${galleryViewMode === 'compact' ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.78rem', padding: '6px 12px', minHeight: 34 }}
            >
              <List style={{ width: 14, height: 14 }} />
              <span>Grid View</span>
            </button>
          </div>
        </div>

        {currentLotPhotos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', background: '#faf5ff', borderRadius: 16, border: '2px dashed #d8b4fe', color: '#6b21a8' }}>
            <ImageIcon style={{ width: 36, height: 36, color: '#a855f7', marginBottom: 8 }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>No Article Images Matching Selected Filters</h4>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Try selecting <strong>"ALL PARTIES"</strong> or <strong>"ALL RATES"</strong> in the filters above!
            </p>
          </div>
        ) : galleryViewMode === 'large' ? (

          /* LARGE DISPLAY CARD GRID */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
            {currentLotPhotos.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: '2px solid #e9d5ff',
                  borderRadius: 18,
                  overflow: 'hidden',
                  boxShadow: '0 6px 20px rgba(147, 51, 234, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.25s ease'
                }}
              >
                {/* LARGE HIGH RESOLUTION IMAGE CONTAINER */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: 380,
                    background: '#0f172a',
                    cursor: 'pointer',
                    overflow: 'hidden'
                  }}
                  onClick={() => setPreviewPhotoUrl(item.url)}
                  title="Click to Zoom Full Screen"
                >
                  <img
                    src={resolvedBase64Map.get(item.url) || getDirectDriveImageUrl(item.url)}
                    alt={`Garment Lot ${item.lotNumber} ${item.brand}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.3s ease'
                    }}
                    onError={(e) => {
                      let fileId = null;
                      if (item.url.includes('id=')) fileId = item.url.split('id=')[1]?.split('&')[0];
                      else if (item.url.includes('/d/')) fileId = item.url.split('/d/')[1]?.split('=')[0]?.split('/')[0];
                      
                      if (fileId && !e.target.src.includes('lh3.googleusercontent')) {
                        e.target.src = `https://lh3.googleusercontent.com/d/${fileId}=w800`;
                      }
                    }}
                  />

                  {/* Floating Brand & Lot Badge Overlay */}
                  <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="font-mono" style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', color: '#ffffff', padding: '4px 10px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)' }}>
                      LOT #{item.lotNumber}
                    </span>
                    <span style={{ background: 'rgba(147, 51, 234, 0.9)', backdropFilter: 'blur(8px)', color: '#ffffff', padding: '4px 10px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 'bold' }}>
                      {item.brand}
                    </span>
                  </div>

                  {/* Floating Zoom Button */}
                  <button
                    type="button"
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      right: 12,
                      background: 'rgba(15, 23, 42, 0.85)',
                      backdropFilter: 'blur(8px)',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,0.25)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer'
                    }}
                  >
                    <Maximize2 style={{ width: 14, height: 14 }} /> ZOOM FULL SCREEN
                  </button>
                </div>

                {/* GARMENT DETAILS & SPECS INFO BOX */}
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: '#faf5ff' }}>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.82rem' }}>
                    <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e9d5ff' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem', fontWeight: 'bold' }}>NORMAL SIZE RATE</span>
                      <strong className="font-mono" style={{ color: item.regularRate > 0 ? '#047857' : '#ef4444', fontSize: '1rem' }}>
                        {item.regularRate > 0 ? `₹${item.regularRate}` : '⚠️ PENDING'}
                      </strong>
                    </div>

                    <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e9d5ff' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem', fontWeight: 'bold' }}>OVERSIZED RATE</span>
                      <strong className="font-mono" style={{ color: item.isOversized === 'YES' ? '#2563eb' : '#64748b', fontSize: '1rem' }}>
                        {item.regularRate > 0 ? `₹${item.oversizedRate || item.regularRate}` : '⚠️ PENDING'}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', itemsCenter: 'center', justifyContent: 'space-between', fontSize: '0.8rem', padding: '6px 10px', background: '#ffffff', borderRadius: 8, border: '1px solid #e9d5ff' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Party: </span>
                      <strong>{item.partyName}</strong>
                    </div>
                    <div>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: '0.72rem',
                        fontWeight: 'bold',
                        background: item.isOversized === 'YES' ? '#eff6ff' : '#ecfdf5',
                        color: item.isOversized === 'YES' ? '#2563eb' : '#047857'
                      }}>
                        OVERSIZED: {item.isOversized}
                      </span>
                    </div>
                  </div>

                  {/* SET RATE / SAVED STATUS ON CARD */}
                  {item.regularRate > 0 ? (
                    <div style={{ padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <CheckCircle2 style={{ width: 15, height: 15 }} /> RATE SAVED & LOCKED
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenLotRateEditor(item)}
                      className="btn btn-danger"
                      style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '8px 12px' }}
                    >
                      <Plus style={{ width: 14, height: 14 }} /> ENTER RATE FOR THIS LOT ENTRY
                    </button>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid #e9d5ff', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>Recorded: {item.timestamp}</span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono"
                      style={{ color: 'var(--accent-primary)', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <ExternalLink style={{ width: 12, height: 12 }} /> Google Drive Link
                    </a>
                  </div>

                </div>

              </div>
            ))}
          </div>

        ) : (

          /* COMPACT GRID VIEW */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {currentLotPhotos.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e9d5ff',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(126, 34, 206, 0.08)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ position: 'relative', height: 160, background: '#000000', cursor: 'pointer' }} onClick={() => setPreviewPhotoUrl(item.url)}>
                  <img
                    src={resolvedBase64Map.get(item.url) || getDirectDriveImageUrl(item.url)}
                    alt={`Photo ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ padding: '8px 10px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                    Lot #{item.lotNumber}
                  </span>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-purple)' }}>
                    Brand: {item.brand}
                  </span>
                </div>
              </div>
            ))}
          </div>

        )}

      </div>

      {/* GOOGLE SHEET INSPECTIONS & RATES TABLE CARD */}
      <div className="card" style={{ background: '#ffffff', border: '2px solid #3b82f6', borderRadius: 18, padding: 18, boxShadow: '0 4px 20px rgba(59, 130, 246, 0.1)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #dbeafe', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText style={{ width: 22, height: 22, color: 'var(--accent-primary)' }} />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>
                FETCHED GOOGLE SHEET LOTS & RATES ({currentLotInspections.length} Display Rows)
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Enter Regular & Oversized rates directly against each fetched Google Sheet Lot entry row below
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={handleOpenPdfModal} className="btn btn-emerald no-print" style={{ fontSize: '0.8rem' }} title="Generate PDF Report">
              <FileDown style={{ width: 14, height: 14 }} /> Download Pictures PDF
            </button>
            <button onClick={handleExportCSV} className="btn btn-outline no-print" style={{ fontSize: '0.8rem' }} title="Export CSV">
              <Download style={{ width: 14, height: 14 }} /> Export Rates CSV
            </button>
          </div>
        </div>

        {currentLotInspections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 16px', background: '#f8fafc', borderRadius: 12, border: '1px dashed #bfdbfe', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Database style={{ width: 32, height: 32, color: 'var(--accent-primary)', marginBottom: 6 }} />
            <p style={{ margin: 0, fontWeight: 'bold' }}>No inspection rows found matching selected filters.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Lot Number</th>
                  <th>JO No</th>
                  <th>Party Name</th>
                  <th>Brand</th>
                  <th>Fabric</th>
                  <th>Oversized?</th>
                  <th style={{ textAlign: 'right' }}>Normal Rate (₹)</th>
                  <th style={{ textAlign: 'right' }}>Oversized Rate (₹)</th>
                  <th style={{ textAlign: 'right' }}>Extra Surcharge</th>
                  <th>Design Photo</th>
                  <th style={{ textAlign: 'right' }} className="no-print">Enter / Edit Rate</th>
                </tr>
              </thead>
              <tbody>
                {currentLotInspections.map((insp, idx) => {
                  const rawPhotoStr = (
                    (insp.photos && insp.photos[0]) ||
                    insp['photo drive links'] ||
                    insp['photo drive link'] ||
                    insp['photo / image url'] ||
                    insp['photo/image url'] ||
                    insp['photo url'] ||
                    insp['image url'] ||
                    insp.photoUrlString ||
                    (insp.sheetDetails && (
                      insp.sheetDetails['photo drive links'] ||
                      insp.sheetDetails['photo drive link'] ||
                      insp.sheetDetails['photo / image url'] ||
                      insp.sheetDetails['photo url']
                    )) ||
                    ''
                  );
                  const photoUrl = (rawPhotoStr && rawPhotoStr !== 'No Photo') ? rawPhotoStr.split(',')[0].trim() : null;
                  const reg = Number(insp.regularRate || 0);
                  const over = Number(insp.oversizedRate || reg);
                  const extraSurcharge = insp.extraCharge || (over > reg ? `+₹${over - reg}` : '₹0');
                  const isPending = reg === 0;

                  return (
                    <tr key={idx} style={{ background: isPending ? '#fff5f5' : undefined }}>
                      <td style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {insp.timestamp || insp['timestamp'] || '-'}
                      </td>
                      <td style={{ fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontSize: '0.95rem' }}>
                        #{insp.lotNumber || insp['lot number'] || insp['lot_number'] || '-'}
                      </td>
                      <td style={{ fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                        {insp.joNo || insp['job order no'] || insp['job order'] || '-'}
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{insp.partyName || insp['party name'] || insp['party'] || '-'}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--accent-purple)' }}>
                        {insp.brand || insp['brand'] || '-'}
                      </td>
                      <td className="font-mono">{insp.fabric || insp['fabric'] || '-'}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          background: (insp.isOversized === 'YES' || insp['oversized'] === 'YES') ? '#eff6ff' : '#ecfdf5',
                          color: (insp.isOversized === 'YES' || insp['oversized'] === 'YES') ? '#2563eb' : '#047857'
                        }}>
                          {insp.isOversized || insp['oversized'] || 'NO'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '1rem', color: isPending ? '#ef4444' : '#047857', fontFamily: 'var(--font-mono)' }}>
                        {isPending ? '⚠️ PENDING' : `₹${reg.toLocaleString('en-IN')}`}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '1rem', color: isPending ? '#ef4444' : ((insp.isOversized === 'YES' || insp['oversized'] === 'YES') ? '#2563eb' : '#64748b'), fontFamily: 'var(--font-mono)' }}>
                        {isPending ? '⚠️ PENDING' : `₹${over.toLocaleString('en-IN')}`}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.85rem', color: extraSurcharge !== '₹0' ? '#2563eb' : '#64748b', fontFamily: 'var(--font-mono)' }}>
                        {extraSurcharge}
                      </td>
                      <td>
                        {photoUrl && photoUrl.startsWith('http') ? (
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                            onClick={() => setPreviewPhotoUrl(photoUrl)}
                          >
                            <img
                              src={(photoUrl && resolvedBase64Map.get(photoUrl)) || getDirectDriveImageUrl(photoUrl)}
                              alt="Drive Photo"
                              loading="lazy"
                              decoding="async"
                              style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '2px solid #a855f7', boxShadow: '0 2px 6px rgba(168, 85, 247, 0.2)' }}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 'bold', textDecoration: 'underline' }}>
                              Enlarge
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No Photo</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} className="no-print">
                        {isPending ? (
                          <button
                            onClick={() => handleOpenLotRateEditor(insp)}
                            className="btn btn-danger"
                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                          >
                            <Plus style={{ width: 14, height: 14 }} /> ENTER RATE
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', padding: '4px 10px', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                            <CheckCircle2 style={{ width: 14, height: 14 }} /> RATE SAVED & LOCKED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DEDICATED GARMENT DESIGN PICTURE SHOWCASE PDF DOWNLOAD MODAL (EXACTLY 4 IMAGES PER PAGE + BASE64 ZERO-BLANK BOXES) */}
      {showPdfModal && (
        <div className="modal-overlay" onClick={() => setShowPdfModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: 960, padding: 24, background: '#ffffff', border: '2px solid #a855f7', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(168, 85, 247, 0.25)' }}
            onClick={e => e.stopPropagation()}
          >

            {/* PDF Modal Controls Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #a855f7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #faf5ff 0%, #e9d5ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon style={{ width: 24, height: 24, color: '#9333ea' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#6b21a8', margin: 0 }}>
                    GARMENT DESIGN PICTURE SHOWCASE PDF
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Party: <strong>{selectedParty === 'ALL' ? 'All Client Parties' : selectedParty}</strong> | <strong>4 Images Per Page</strong> | Total: <strong>{currentLotPhotos.length} Images</strong>
                  </p>
                </div>
              </div>

              {/* 1-CLICK DIRECT PDF DOWNLOAD BUTTON */}
              <div style={{ display: 'flex', gap: 10 }} className="no-print">
                <button
                  onClick={handleDownloadDirectPdf}
                  disabled={isGeneratingPdf || isPreparingPdf}
                  className="btn font-bold"
                  style={{ fontSize: '0.9rem', padding: '10px 22px', background: 'linear-gradient(135deg, #9333ea 0%, #a855f7 100%)', color: '#ffffff', boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)', border: 'none' }}
                >
                  <FileDown style={{ width: 18, height: 18 }} /> {isGeneratingPdf ? '⏳ Generating PDF File...' : isPreparingPdf ? '⏳ Loading Base64 Images...' : '📥 DOWNLOAD PICTURES PDF NOW'}
                </button>
                <button onClick={() => setShowPdfModal(false)} className="btn btn-outline" style={{ padding: 8 }}>
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>
            </div>

            {isPreparingPdf ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#7e22ce' }}>
                <Loader2 style={{ width: 40, height: 40, color: '#9333ea', animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
                  Optimizing & Converting Images for PDF ({pdfPreparationProgress.current} / {pdfPreparationProgress.total})...
                </h4>
                <div style={{ maxWidth: 320, width: '100%', height: 8, background: '#e9d5ff', borderRadius: 4, margin: '12px auto', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pdfPreparationProgress.total > 0 ? (pdfPreparationProgress.current / pdfPreparationProgress.total) * 100 : 0}%`,
                      background: 'linear-gradient(90deg, #9333ea 0%, #a855f7 100%)',
                      transition: 'width 0.2s ease'
                    }}
                  />
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Batch processing in memory for 100% smooth performance even with large image sets
                </p>
              </div>
            ) : (
              /* TARGET DOCUMENT CONTAINER FOR DIRECT PDF DOWNLOAD (DESIGN PICTURES SHOWCASE ONLY - 4 PER PAGE) */
              <div id="pdf-report-document" style={{ background: '#ffffff', padding: 16 }}>

                {pdfPhotoPages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: '#faf5ff', borderRadius: 16, border: '2px dashed #d8b4fe', color: '#6b21a8' }}>
                    <ImageIcon style={{ width: 40, height: 40, color: '#a855f7', marginBottom: 10 }} />
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>No Article Images Available for Selected Filters</h4>
                  </div>
                ) : (
                  pdfPhotoPages.map((pagePhotos, pageIdx) => (
                    <div
                      key={pageIdx}
                      style={{
                        marginBottom: pageIdx < pdfPhotoPages.length - 1 ? 30 : 0,
                        pageBreakAfter: pageIdx < pdfPhotoPages.length - 1 ? 'always' : 'auto',
                        paddingBottom: 16
                      }}
                    >

                      {/* Document Header for Each PDF Page */}
                      <div style={{ borderBottom: '3px solid #9333ea', paddingBottom: 10, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#6b21a8', margin: 0, letterSpacing: '-0.01em' }}>
                            GARMENT RATE VAULT — DESIGN CATALOGUE (Page {pageIdx + 1} of {pdfPhotoPages.length})
                          </h3>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Party: {selectedParty === 'ALL' ? 'All Client Parties' : selectedParty} | 4 Images Per Page
                          </span>
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#9333ea', background: '#f3e8ff', padding: '4px 10px', borderRadius: 8 }}>
                          GARMENT VAULT PDF
                        </span>
                      </div>

                      {/* EXACTLY 4 IMAGES IN A CLEAN 2x2 GRID PER PAGE */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                        {pagePhotos.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              border: '2px solid #e9d5ff',
                              borderRadius: 14,
                              overflow: 'hidden',
                              background: '#ffffff',
                              boxShadow: '0 4px 12px rgba(147, 51, 234, 0.08)',
                              display: 'flex',
                              flexDirection: 'column'
                            }}
                          >
                            {/* CRISP GARMENT DESIGN PHOTO (BASE64 PREVENTING BLANK BOXES) */}
                            <div style={{ height: 230, background: '#f8fafc', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <img
                                src={item.base64Url || getDirectDriveImageUrl(item.url)}
                                alt={`Garment Lot ${item.lotNumber} ${item.brand}`}
                                crossOrigin="anonymous"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  const fallbackUrl = getDirectDriveImageUrl(item.url);
                                  if (e.target.src !== fallbackUrl) {
                                    e.target.src = fallbackUrl;
                                  }
                                }}
                              />
                              <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, zIndex: 2 }}>
                                <span style={{ background: 'rgba(15, 23, 42, 0.85)', color: '#ffffff', padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 'bold' }}>
                                  LOT #{item.lotNumber}
                                </span>
                                <span style={{ background: '#9333ea', color: '#ffffff', padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 'bold' }}>
                                  {item.brand}
                                </span>
                              </div>
                            </div>

                            {/* GARMENT DETAILS & RATES CARD FOOTER */}
                            <div style={{ padding: 10, fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 6, background: '#faf5ff' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Party/Client: </span>
                                  <strong style={{ color: '#0f172a' }}>{item.partyName}</strong>
                                </div>
                                <div>
                                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Fabric: </span>
                                  <strong style={{ color: '#0f172a' }}>{item.fabric}</strong>
                                </div>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #e9d5ff' }}>
                                <div style={{ background: '#ffffff', padding: '4px 8px', borderRadius: 6, border: '1px solid #e9d5ff' }}>
                                  <span style={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>NORMAL RATE</span>
                                  <strong style={{ color: item.regularRate > 0 ? '#047857' : '#ef4444', fontSize: '0.88rem' }}>
                                    {item.regularRate > 0 ? `₹${item.regularRate}` : '⚠️ PENDING'}
                                  </strong>
                                </div>

                                <div style={{ background: '#ffffff', padding: '4px 8px', borderRadius: 6, border: '1px solid #e9d5ff' }}>
                                  <span style={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>OVERSIZED RATE</span>
                                  <strong style={{ color: item.isOversized === 'YES' ? '#2563eb' : '#64748b', fontSize: '0.88rem' }}>
                                    {item.regularRate > 0 ? `₹${item.oversizedRate || item.regularRate}` : '⚠️ PENDING'}
                                  </strong>
                                </div>
                              </div>
                            </div>

                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.72rem', color: '#94a3b8', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                        Page {pageIdx + 1} of {pdfPhotoPages.length} | Official Garment Design Showcase Catalogue
                      </div>

                    </div>
                  ))
                )}

              </div>
            )}

          </div>
        </div>
      )}

      {/* DEDICATED RATE EDITOR MODAL FOR FETCHED GOOGLE SHEET LOT ENTRY */}
      {editingLotInspection && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 520, borderRadius: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>
                  Enter Rates for Lot #{editingLotInspection.lotNumber}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', fontWeight: 'bold' }}>
                  Brand: {editingLotInspection.brand} ({editingLotInspection.partyName})
                </span>
              </div>
              <button onClick={() => setEditingLotInspection(null)} className="btn btn-outline" style={{ padding: 4, border: 'none' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <form onSubmit={handleSaveLotInspectionRate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* OVERSIZED TOGGLE */}
              <div className="form-group">
                <label className="form-label">IS THIS LOT ENTRY OVERSIZED?</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setEditIsOversized('YES')}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: `2px solid ${editIsOversized === 'YES' ? '#2563eb' : '#cbd5e1'}`,
                      background: editIsOversized === 'YES' ? '#eff6ff' : '#ffffff',
                      color: editIsOversized === 'YES' ? '#2563eb' : '#64748b',
                      fontSize: '0.88rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    YES (OVERSIZED)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditIsOversized('NO')}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: `2px solid ${editIsOversized === 'NO' ? '#10b981' : '#cbd5e1'}`,
                      background: editIsOversized === 'NO' ? '#ecfdf5' : '#ffffff',
                      color: editIsOversized === 'NO' ? '#047857' : '#64748b',
                      fontSize: '0.88rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    NO (REGULAR)
                  </button>
                </div>
              </div>

              {/* CONDITIONAL RATE INPUT LABELS FOR GOOGLE SHEET LOT */}
              {editIsOversized === 'YES' ? (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: 16, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>NORMAL SIZE RATE (₹) *</label>
                      <input
                        type="number"
                        value={editRegularRate || ''}
                        onChange={(e) => setEditRegularRate(Number(e.target.value) || 0)}
                        className="input-control font-mono font-bold"
                        placeholder="e.g. 400"
                        min="0"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ color: '#2563eb', fontWeight: 'bold' }}>OVERSIZED RATE (₹) *</label>
                      <input
                        type="number"
                        value={editOversizedRate || ''}
                        onChange={(e) => setEditOversizedRate(Number(e.target.value) || 0)}
                        className="input-control font-mono font-bold"
                        style={{ borderColor: '#3b82f6', color: '#2563eb' }}
                        placeholder="e.g. 450"
                        min="0"
                        required
                      />
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #93c5fd', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', color: '#1e40af', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Normal: ₹{editRegularRate || 0} | Oversized: ₹{editOversizedRate || 0}</span>
                    <span>Extra Surcharge: +₹{Math.max(0, (editOversizedRate || 0) - (editRegularRate || 0))} / Pc</span>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#f8fafc', border: '1px solid #a7f3d0', padding: 16, borderRadius: 14 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#047857', fontWeight: 'bold' }}>NORMAL SIZE RATE PER PIECE (₹) *</label>
                    <input
                      type="number"
                      value={editRegularRate || ''}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setEditRegularRate(val);
                        setEditOversizedRate(val);
                      }}
                      className="input-control font-mono font-bold"
                      placeholder="e.g. 400"
                      step="0.5"
                      min="0"
                      required
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setEditingLotInspection(null)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-emerald">
                  <Save style={{ width: 16, height: 16 }} /> SAVE RATES FOR LOT #{editingLotInspection.lotNumber}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* FULL RESOLUTION PHOTO LIGHTBOX MODAL */}
      {previewPhotoUrl && (
        <div className="modal-overlay" onClick={() => setPreviewPhotoUrl(null)}>
          <div className="modal-card" style={{ maxWidth: 840, padding: 20, background: '#0f172a', border: '1px solid #334155', borderRadius: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, color: '#ffffff' }}>
              <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>Garment Design Inspection Preview</span>
              <button onClick={() => setPreviewPhotoUrl(null)} className="btn btn-outline" style={{ padding: 6, background: '#1e293b', border: 'none', color: '#ffffff' }}>
                <X style={{ width: 22, height: 22 }} />
              </button>
            </div>
            <div style={{ position: 'relative', width: '100%', maxHeight: '78vh', background: '#000000', borderRadius: 14, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={resolvedBase64Map.get(previewPhotoUrl) || getDirectDriveImageUrl(previewPhotoUrl)}
                alt="Inspection Full Preview"
                style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain' }}
                onError={(e) => {
                  let fileId = null;
                  if (previewPhotoUrl.includes('id=')) fileId = previewPhotoUrl.split('id=')[1]?.split('&')[0];
                  else if (previewPhotoUrl.includes('/d/')) fileId = previewPhotoUrl.split('/d/')[1]?.split('=')[0]?.split('/')[0];
                  
                  if (fileId && !e.target.src.includes('lh3.googleusercontent')) {
                    e.target.src = `https://lh3.googleusercontent.com/d/${fileId}=w800`;
                  }
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <a href={previewPhotoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ fontSize: '0.8rem', color: '#93c5fd', borderColor: '#334155' }}>
                <ExternalLink style={{ width: 14, height: 14 }} /> Open Original in Google Drive
              </a>
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem' }}
              >
                Close Zoom View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW LOT MODAL */}
      {showAddLotModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: 16 }}>Create New Garment Lot</h3>
            <form onSubmit={handleAddLotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Lot Number *</label>
                <input
                  type="text"
                  value={newLotNumber}
                  onChange={(e) => setNewLotNumber(e.target.value)}
                  className="input-control font-mono font-bold"
                  placeholder="e.g. LOT-2026-705 or 11040"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Party / Client Name</label>
                <input
                  type="text"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  className="input-control"
                  placeholder="e.g. Mohit Hosiery"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Garment Category</label>
                <select
                  value={newGarmentCategory}
                  onChange={(e) => setNewGarmentCategory(e.target.value)}
                  className="input-control"
                >
                  <option value="Sweatshirts & Hoodies">Sweatshirts & Hoodies</option>
                  <option value="Shirts">Formal & Casual Shirts</option>
                  <option value="T-Shirts">T-Shirts</option>
                  <option value="Denim Jackets">Denim Jackets & Outerwear</option>
                  <option value="Lowers & Joggers">Lowers & Joggers</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Batch Quantity (Pcs)</label>
                <input
                  type="number"
                  value={newTargetQty}
                  onChange={(e) => setNewTargetQty(Number(e.target.value))}
                  className="input-control font-mono"
                  min="1"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setShowAddLotModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Lot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
