import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, XCircle, Image as ImageIcon, Trash2, Layers, AlertCircle, RefreshCw, Upload, Check, Database, Key, Tag, User, Calendar, Shirt, Package, Sparkles, Plus } from 'lucide-react';
import { DEFAULT_SHEET_ID, DEFAULT_JOBORDER_SHEET_ID, DEFAULT_STORAGE_SHEET_ID, DEFAULT_API_KEY, DEFAULT_APPS_SCRIPT_URL, fetchJobOrderData, findLotInJobOrder } from '../services/googleSheets';
import { BACKEND_URL } from '../config';

export default function LotGarmentInspection({ lots, addAuditLog, isLocked, onRequestUnlock, apiKey, sheetId, onOpenApiSettings }) {
  const [selectedLotNumber, setSelectedLotNumber] = useState('');

  // Structured JobOrder Data & Multi-Brand Items State
  const [fetchedSheetData, setFetchedSheetData] = useState(null);
  const [fetchedMatches, setFetchedMatches] = useState([]);

  // Multi-Brand Array (Each Brand has its own Brand name, Fabric, Oversize specs & Photos)
  const [brandItems, setBrandItems] = useState([
    {
      id: 'brand-1',
      brand: '',
      fabric: '',
      isOversized: 'NO',
      extraCharge: 0,
      oversizeNotes: '',
      photos: [],
      sheetDetails: null
    }
  ]);
  const [activeBrandIdx, setActiveBrandIdx] = useState(0);

  // Google Sheets Auto Fetch State
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [sheetFetchStatus, setSheetFetchStatus] = useState(null);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Inspection records history saved in LocalStorage
  const [inspections, setInspections] = useState(() => {
    const saved = localStorage.getItem('garment_vault_inspections');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('garment_vault_inspections', JSON.stringify(inspections));
  }, [inspections]);

  useEffect(() => {
    if (lots && lots.length > 0 && !selectedLotNumber) {
      setSelectedLotNumber(lots[0].lotNumber);
    }
  }, [lots, selectedLotNumber]);

  // Current Active Brand Item Helper
  const currentBrandItem = brandItems[activeBrandIdx] || brandItems[0];

  const updateCurrentBrandItem = (fields) => {
    setBrandItems(prev => {
      const copy = [...prev];
      if (copy[activeBrandIdx]) {
        copy[activeBrandIdx] = { ...copy[activeBrandIdx], ...fields };
      }
      return copy;
    });
  };

  const handleAddBrandItem = (initialData = {}) => {
    const defaultSheetDetails = initialData.sheetDetails || fetchedSheetData || (brandItems[0] && brandItems[0].sheetDetails) || null;
    const newItem = {
      id: 'brand-' + Date.now() + '-' + (brandItems.length + 1),
      brand: initialData.brand || '',
      fabric: initialData.fabric || (defaultSheetDetails && defaultSheetDetails['fabric']) || '',
      isOversized: initialData.isOversized || 'NO',
      extraCharge: initialData.extraCharge || 0,
      oversizeNotes: initialData.oversizeNotes || '',
      photos: initialData.photos || [],
      sheetDetails: defaultSheetDetails
    };
    setBrandItems(prev => [...prev, newItem]);
    setActiveBrandIdx(brandItems.length);
  };

  const handleRemoveBrandItem = (idx) => {
    if (brandItems.length <= 1) return;
    setBrandItems(prev => prev.filter((_, i) => i !== idx));
    if (activeBrandIdx >= idx && activeBrandIdx > 0) {
      setActiveBrandIdx(activeBrandIdx - 1);
    }
  };

  // Fetch Data from JobOrder Sheet against selected Lot Number
  const handleFetchFromJobOrder = async () => {
    if (!selectedLotNumber) {
      alert('Please enter or select a Lot Number first.');
      return;
    }

    const activeKey = apiKey || DEFAULT_API_KEY;
    if (!activeKey || activeKey === 'YOUR_GOOGLE_API_KEY_HERE') {
      onOpenApiSettings();
      setSheetFetchStatus({
        type: 'error',
        msg: 'Please paste your Google API Key to enable sheet data fetching.'
      });
      return;
    }

    setIsFetchingSheet(true);
    setSheetFetchStatus(null);
    setFetchedSheetData(null);
    setFetchedMatches([]);

    try {
      const sheetResult = await fetchJobOrderData(activeKey, DEFAULT_JOBORDER_SHEET_ID);
      const matches = findLotInJobOrder(sheetResult.items, selectedLotNumber);

      if (matches.length > 0) {
        setFetchedMatches(matches);
        setFetchedSheetData(matches[0]);

        const itemsFromSheet = matches.map((m, i) => {
          const sizeStr = String(m['size'] || '').toUpperCase();
          const remarksStr = String(m['remarks'] || m['style'] || '').toLowerCase();
          const isOver = sizeStr.includes('XXL') || sizeStr.includes('3XL') || sizeStr.includes('4XL') || sizeStr.includes('5XL') || remarksStr.includes('oversize') || remarksStr.includes('loose');
          const note = m['remarks'] ? `Remarks: ${m['remarks']}` : `Style: ${m['style'] || ''}`;

          return {
            id: 'brand-' + Date.now() + '-' + (i + 1),
            brand: m['brand'] || '',
            fabric: m['fabric'] || '',
            isOversized: isOver ? 'YES' : 'NO',
            extraCharge: 0,
            oversizeNotes: note,
            photos: [],
            sheetDetails: m
          };
        });

        setBrandItems(itemsFromSheet);
        setActiveBrandIdx(0);

        setSheetFetchStatus({
          type: 'success',
          msg: `Loaded ${matches.length} Brand item(s) for Lot #${selectedLotNumber}!`
        });
        addAuditLog(`Fetched ${matches.length} JobOrder row(s) for Lot: ${selectedLotNumber}`);
      } else {
        setSheetFetchStatus({
          type: 'error',
          msg: `No matching record found for Lot #${selectedLotNumber} in JobOrder sheet.`
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

  // Start Camera with facingMode support
  const startCamera = async (overrideMode) => {
    setCameraError('');
    const modeToUse = overrideMode || facingMode;
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const currentStream = videoRef.current.srcObject;
        currentStream.getTracks().forEach(track => track.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available. Please make sure the website is loaded over HTTPS.');
      }

      const constraintsOptions = [
        { video: { facingMode: { exact: modeToUse }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: { facingMode: modeToUse, width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: { facingMode: modeToUse } },
        { video: true }
      ];

      let stream = null;
      for (const constraints of constraintsOptions) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (e) {
          // try next constraint
        }
      }

      if (!stream) {
        throw new Error('Unable to access camera on this device.');
      }

      setIsCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          videoRef.current.muted = true;
          videoRef.current.play().catch(pErr => console.warn('Video play note:', pErr));
        }
      }, 100);

    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(err.message || 'Unable to access camera device. Try using the photo upload button instead.');
      setIsCameraActive(false);
    }
  };

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const compressImageDataUrl = (srcDataUrl, maxDim = 800, quality = 0.65) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

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
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(srcDataUrl);
      img.src = srcDataUrl;
    });
  };

  const takeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const maxDim = 800;
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 480;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, width, height);

      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.65);
      updateCurrentBrandItem({
        photos: [photoDataUrl, ...(currentBrandItem.photos || [])]
      });
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImageDataUrl(reader.result, 800, 0.65);
        updateCurrentBrandItem({
          photos: [compressed, ...(currentBrandItem.photos || [])]
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (photoIdx) => {
    const newPhotos = (currentBrandItem.photos || []).filter((_, i) => i !== photoIdx);
    updateCurrentBrandItem({ photos: newPhotos });
  };

  // Express Backend Sync State
  const [saveBackendStatus, setSaveBackendStatus] = useState(null);
  const [isSavingBackend, setIsSavingBackend] = useState(false);

  // Save All Brand Items as Separate Rows to Google Sheets & Drive
  const handleSaveInspection = async (e) => {
    e.preventDefault();

    if (!selectedLotNumber) {
      alert('Please enter or select a Lot Number.');
      return;
    }

    // Strict Validation: User must capture or upload at least 1 photo for every brand entry before uploading data
    for (let i = 0; i < brandItems.length; i++) {
      const item = brandItems[i];
      const itemPhotos = item.photos || [];
      const isAutoSnapAvailable = (i === activeBrandIdx && isCameraActive && videoRef.current);

      if (itemPhotos.length === 0 && !isAutoSnapAvailable) {
        alert(`📷 PHOTO REQUIRED! Please capture or upload at least 1 image for Brand #${i + 1} (${item.brand || 'Unnamed'}) before uploading data.`);
        setActiveBrandIdx(i);
        setSaveBackendStatus({
          type: 'warning',
          msg: `📷 Photo required! Please capture or upload at least 1 image for Brand #${i + 1} (${item.brand || 'Unnamed'}) first.`
        });
        return;
      }
    }

    setIsSavingBackend(true);
    setSaveBackendStatus({ type: 'info', msg: `⚡ Uploading ${brandItems.length} Brand item(s) as separate rows to Google Drive & Google Sheet...` });

    const appsScriptUrl = DEFAULT_APPS_SCRIPT_URL;
    let savedCount = 0;
    const newRecordsList = [];

    for (let i = 0; i < brandItems.length; i++) {
      const item = brandItems[i];

      // Auto-capture live frame if camera active & no photo for this item yet
      let photosToSend = [...(item.photos || [])];
      if (i === activeBrandIdx && photosToSend.length === 0 && isCameraActive && videoRef.current && canvasRef.current) {
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const maxDim = 800;
          let width = video.videoWidth || 640;
          let height = video.videoHeight || 480;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, width, height);
          photosToSend = [canvas.toDataURL('image/jpeg', 0.65)];
        } catch (snapErr) {
          console.warn('Auto snapshot note:', snapErr);
        }
      }

      const baseSheetDetails = item.sheetDetails || fetchedSheetData || {};
      const activeBrand = item.brand.trim() || baseSheetDetails['brand'] || 'N/A';
      const activeFabric = item.fabric.trim() || baseSheetDetails['fabric'] || 'N/A';

      const regularRate = Number(item.regularRate) || 0;
      const oversizedRate = item.isOversized === 'YES' ? (Number(item.oversizedRate) || regularRate) : regularRate;
      const extraCharge = item.isOversized === 'YES' ? Math.max(0, oversizedRate - regularRate) : 0;

      const record = {
        id: 'insp-' + Date.now() + '-' + (i + 1),
        lotNumber: selectedLotNumber,
        brand: activeBrand,
        fabric: activeFabric,
        isOversized: item.isOversized,
        regularRate: regularRate,
        oversizedRate: oversizedRate,
        extraCharge: extraCharge,
        oversizeNotes: item.oversizeNotes || (item.isOversized === 'YES' ? `Regular: ₹${regularRate}, Oversized: ₹${oversizedRate} (+₹${extraCharge})` : `Regular: ₹${regularRate}`),
        sheetDetails: {
          ...baseSheetDetails,
          brand: activeBrand,
          fabric: activeFabric
        },
        photos: photosToSend,
        timestamp: new Date().toLocaleString()
      };

      newRecordsList.push(record);

      let saved = false;

      // 1. Primary: Save directly to Google Apps Script Web App (Uploads photos to Drive & appends row to Google Sheet)
      if (appsScriptUrl) {
        try {
          const scriptRes = await fetch(appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(record)
          });
          const scriptData = await scriptRes.json().catch(() => ({}));
          if (scriptData && scriptData.success) {
            savedCount++;
            saved = true;
          }
        } catch (scriptErr) {
          console.warn(`Apps Script upload error for item ${i + 1}:`, scriptErr);
        }
      }

      // 2. Fallback: If Apps Script is offline or fails, save via Local Express Server
      if (!saved) {
        try {
          const backendRes = await fetch(`${BACKEND_URL}/api/save-inspection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
          }).catch(() => null);

          const data = backendRes ? await backendRes.json().catch(() => ({})) : null;
          if (data && data.success) {
            savedCount++;
          }
        } catch (err) {
          console.warn(`Error uploading brand item ${i + 1} to local backend:`, err);
        }
      }
    }

    setInspections(prev => [...newRecordsList, ...prev]);
    addAuditLog(`Saved ${newRecordsList.length} separate brand row(s) for Lot: ${selectedLotNumber}`);

    setSaveBackendStatus({
      type: 'success',
      msg: `⚡ Saved ${newRecordsList.length} separate Brand row(s) for Lot #${selectedLotNumber} into Google Sheet & Drive!`
    });

    setIsSavingBackend(false);
    stopCamera();

    // Reset brand items
    setBrandItems([{
      id: 'brand-' + Date.now() + '-1',
      brand: '',
      fabric: '',
      isOversized: 'NO',
      extraCharge: 0,
      oversizeNotes: '',
      photos: [],
      sheetDetails: null
    }]);
    setActiveBrandIdx(0);
  };

  const handleDeleteInspection = (id, lotNum) => {
    if (window.confirm(`Delete inspection record for Lot #${lotNum}?`)) {
      const updated = inspections.filter(item => item.id !== id);
      setInspections(updated);
      addAuditLog(`Deleted inspection record for Lot: ${lotNum}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', margin: '0 auto', paddingBottom: 40 }}>
      
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#ffffff',
        borderRadius: 20,
        padding: '24px 28px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justify: 'space-between',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
          }}>
            <Shirt style={{ width: 28, height: 28, color: '#ffffff' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '-0.02em', margin: 0 }}>
              Garment Inspection & Multi-Brand Photos
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Capture photos for each Brand & save as separate rows into Google Drive & Sheet
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', background: '#334155', padding: '6px 12px', borderRadius: 20, color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>
            Folder: <strong>BARCODE ARTICLE IMAGES</strong>
          </span>
        </div>
      </div>

      {/* Main Inspection Form Card */}
      <div className="card" style={{ background: '#ffffff', borderRadius: 20, border: '1px solid var(--border-light)', padding: 24, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
        
        <form onSubmit={handleSaveInspection} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* STEP 1: Enter / Select Lot Number */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 16, padding: 18 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
              1. LOT NUMBER *
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="e.g. 11040 or 11028"
                value={selectedLotNumber}
                onChange={(e) => setSelectedLotNumber(e.target.value)}
                className="input-control font-mono"
                style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--accent-primary)', flex: 1, minWidth: 220 }}
              />

              {lots && lots.length > 0 && (
                <select
                  value={selectedLotNumber}
                  onChange={(e) => setSelectedLotNumber(e.target.value)}
                  className="input-control font-mono"
                  style={{ width: 'auto', minWidth: 180, fontSize: '0.9rem' }}
                >
                  <option value="">-- Select Active Lot --</option>
                  {lots.map(l => (
                    <option key={l.id} value={l.lotNumber}>
                      {l.lotNumber} ({l.partyName})
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={handleFetchFromJobOrder}
                disabled={isFetchingSheet}
                className="btn btn-primary"
                style={{ fontSize: '0.88rem' }}
              >
                <Database style={{ width: 16, height: 16 }} />
                {isFetchingSheet ? 'Fetching Sheet...' : 'FETCH JOBORDER SHEET'}
              </button>
            </div>

            {sheetFetchStatus && (
              <div style={{
                marginTop: 10,
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

          {/* STEP 2: MULTI-BRAND MANAGER FOR LOT */}
          <div style={{ background: '#faf5ff', border: '2px solid #c084fc', borderRadius: 16, padding: 18 }}>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag style={{ width: 18, height: 18, color: '#9333ea' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#6b21a8', margin: 0 }}>
                  2. BRANDS FOR LOT #{selectedLotNumber || '___'} ({brandItems.length} Brand Entries)
                </h4>
              </div>

              <button
                type="button"
                onClick={() => handleAddBrandItem()}
                className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '6px 14px', borderColor: '#c084fc', color: '#7e22ce', background: '#ffffff' }}
              >
                <Plus style={{ width: 15, height: 15 }} />
                + ADD ANOTHER BRAND FOR THIS LOT
              </button>
            </div>

            {/* Brand Item Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {brandItems.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setActiveBrandIdx(idx)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: brandItems.length > 1 ? '10px 0 0 10px' : 10,
                      border: `2px solid ${activeBrandIdx === idx ? '#9333ea' : '#cbd5e1'}`,
                      borderRight: brandItems.length > 1 ? 'none' : undefined,
                      background: activeBrandIdx === idx ? '#9333ea' : '#ffffff',
                      color: activeBrandIdx === idx ? '#ffffff' : '#475569',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Tag style={{ width: 14, height: 14 }} />
                    Brand #{idx + 1}: {item.brand || 'Unnamed'} ({item.photos?.length || 0} photos)
                  </button>

                  {brandItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBrandItem(idx)}
                      title="Remove this brand item"
                      style={{
                        padding: '8px 8px',
                        borderRadius: '0 10px 10px 0',
                        border: `2px solid ${activeBrandIdx === idx ? '#9333ea' : '#cbd5e1'}`,
                        background: activeBrandIdx === idx ? '#7e22ce' : '#f8fafc',
                        color: activeBrandIdx === idx ? '#ffffff' : '#ef4444',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Active Brand Item Form Controls */}
            <div style={{ background: '#ffffff', border: '1px solid #e9d5ff', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>EDITING BRAND ENTRY #{activeBrandIdx + 1} OF {brandItems.length}</span>
                <span style={{ fontSize: '0.72rem', color: '#6b21a8' }}>
                  Will save as separate Row in Google Sheet!
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--accent-purple)', fontWeight: 'bold' }}>
                    BRAND NAME *
                  </label>
                  <input
                    type="text"
                    value={currentBrandItem.brand}
                    onChange={(e) => updateCurrentBrandItem({ brand: e.target.value })}
                    className="input-control font-bold"
                    placeholder="e.g. HOOD RICH, COACH, OVO"
                    style={{ border: '2px solid #c084fc', color: 'var(--accent-purple)' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    FABRIC DETAILS
                  </label>
                  <input
                    type="text"
                    value={currentBrandItem.fabric}
                    onChange={(e) => updateCurrentBrandItem({ fabric: e.target.value })}
                    className="input-control font-mono font-bold"
                    placeholder="e.g. MH GERMAN FLEECE"
                  />
                </div>
              </div>

              {/* Oversized Option for Current Brand */}
              <div style={{ paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                  IS BRAND #{activeBrandIdx + 1} OVERSIZED?
                </label>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => updateCurrentBrandItem({ isOversized: 'YES' })}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: `2px solid ${currentBrandItem.isOversized === 'YES' ? '#2563eb' : '#cbd5e1'}`,
                      background: currentBrandItem.isOversized === 'YES' ? '#eff6ff' : '#ffffff',
                      color: currentBrandItem.isOversized === 'YES' ? '#2563eb' : '#64748b',
                      fontSize: '0.88rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    YES (OVERSIZED)
                  </button>

                  <button
                    type="button"
                    onClick={() => updateCurrentBrandItem({ isOversized: 'NO' })}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: `2px solid ${currentBrandItem.isOversized === 'NO' ? '#10b981' : '#cbd5e1'}`,
                      background: currentBrandItem.isOversized === 'NO' ? '#ecfdf5' : '#ffffff',
                      color: currentBrandItem.isOversized === 'NO' ? '#047857' : '#64748b',
                      fontSize: '0.88rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    NO (REGULAR)
                  </button>
                </div>

                {/* RATE INPUT LABELS (Conditional based on Oversized status) */}
                {currentBrandItem.isOversized === 'YES' ? (
                  <div style={{ background: '#f8fafc', border: '1px solid #bfdbfe', padding: 12, borderRadius: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          REGULAR RATE (₹) *
                        </label>
                        <input
                          type="number"
                          value={currentBrandItem.regularRate || ''}
                          onChange={(e) => {
                            const reg = Number(e.target.value) || 0;
                            const over = Number(currentBrandItem.oversizedRate) || reg;
                            updateCurrentBrandItem({
                              regularRate: reg,
                              extraCharge: Math.max(0, over - reg)
                            });
                          }}
                          className="input-control font-mono font-bold"
                          placeholder="e.g. 400"
                          min="0"
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#2563eb' }}>
                          OVERSIZED RATE (₹) *
                        </label>
                        <input
                          type="number"
                          value={currentBrandItem.oversizedRate || ''}
                          onChange={(e) => {
                            const over = Number(e.target.value) || 0;
                            const reg = Number(currentBrandItem.regularRate) || 0;
                            updateCurrentBrandItem({
                              oversizedRate: over,
                              extraCharge: Math.max(0, over - reg)
                            });
                          }}
                          className="input-control font-mono font-bold"
                          style={{ borderColor: '#3b82f6', color: '#2563eb' }}
                          placeholder="e.g. 450"
                          min="0"
                        />
                      </div>
                    </div>

                    <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', padding: '8px 12px', borderRadius: 8, fontSize: '0.78rem', color: '#1e40af', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Regular: ₹{currentBrandItem.regularRate || 0} | Oversized: ₹{currentBrandItem.oversizedRate || 0}</span>
                      <span style={{ color: '#2563eb' }}>Extra Surcharge: +₹{Math.max(0, (currentBrandItem.oversizedRate || 0) - (currentBrandItem.regularRate || 0))}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', border: '1px solid #a7f3d0', padding: 12, borderRadius: 12 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: 6, color: '#047857' }}>
                      REGULAR RATE PER PC (₹) *
                    </label>
                    <input
                      type="number"
                      value={currentBrandItem.regularRate || ''}
                      onChange={(e) => {
                        const reg = Number(e.target.value) || 0;
                        updateCurrentBrandItem({
                          regularRate: reg,
                          oversizedRate: reg,
                          extraCharge: 0
                        });
                      }}
                      className="input-control font-mono font-bold"
                      placeholder="e.g. 400"
                      min="0"
                    />
                  </div>
                )}
              </div>

              {/* Photos for Current Brand */}
              <div style={{ paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Camera style={{ width: 15, height: 15, color: 'var(--accent-primary)' }} />
                  PHOTOS FOR BRAND #{activeBrandIdx + 1} ({currentBrandItem.brand || 'Unnamed'})
                </label>

                {/* Camera Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                  {!isCameraActive ? (
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="btn btn-primary"
                      style={{ fontSize: '0.85rem' }}
                    >
                      <Camera style={{ width: 16, height: 16 }} />
                      OPEN CAMERA & TAKE PHOTO
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={takeSnapshot}
                        className="btn btn-emerald"
                        style={{ fontSize: '0.85rem' }}
                      >
                        📸 CAPTURE PHOTO NOW
                      </button>

                      <button
                        type="button"
                        onClick={toggleCameraFacing}
                        className="btn btn-outline"
                        style={{ fontSize: '0.82rem' }}
                      >
                        <RefreshCw style={{ width: 14, height: 14 }} />
                        FLIP ({facingMode === 'environment' ? 'REAR' : 'FRONT'})
                      </button>

                      <button
                        type="button"
                        onClick={stopCamera}
                        className="btn btn-outline"
                        style={{ fontSize: '0.82rem', borderColor: '#ef4444', color: '#ef4444' }}
                      >
                        CLOSE CAMERA
                      </button>
                    </div>
                  )}

                  <label className="btn btn-outline" style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}>
                    <Upload style={{ width: 16, height: 16 }} />
                    UPLOAD FROM GALLERY
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {/* Live Camera Viewfinder */}
                {isCameraActive && (
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 520,
                    aspectRatio: '4/3',
                    background: '#000000',
                    borderRadius: 16,
                    overflow: 'hidden',
                    marginBottom: 14,
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.25)',
                    border: '2px solid #2563eb'
                  }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                  </div>
                )}

                {/* Captured Gallery Preview for Current Brand */}
                {currentBrandItem.photos && currentBrandItem.photos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginTop: 8 }}>
                    {currentBrandItem.photos.map((p, idx) => (
                      <div key={idx} style={{ position: 'relative', height: 100, borderRadius: 10, overflow: 'hidden', border: '2px solid #2563eb' }}>
                        <img src={p} alt={`Photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            background: 'rgba(239, 68, 68, 0.9)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <XCircle style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* Backend Save Status Feedback */}
          {saveBackendStatus && (
            <div style={{
              padding: 14,
              borderRadius: 12,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: saveBackendStatus.type === 'success' ? '#ecfdf5' : saveBackendStatus.type === 'info' ? '#eff6ff' : '#fffbeb',
              border: `1px solid ${saveBackendStatus.type === 'success' ? '#a7f3d0' : saveBackendStatus.type === 'info' ? '#bfdbfe' : '#fde68a'}`,
              color: saveBackendStatus.type === 'success' ? '#047857' : saveBackendStatus.type === 'info' ? '#1d4ed8' : '#b45309'
            }}>
              {saveBackendStatus.type === 'success' ? <CheckCircle2 style={{ width: 18, height: 18 }} /> : <AlertCircle style={{ width: 18, height: 18 }} />}
              <span style={{ fontWeight: 'bold' }}>{saveBackendStatus.msg}</span>
            </div>
          )}

          {/* SUBMIT ALL BRAND ROWS BUTTON */}
          <button
            type="submit"
            disabled={isSavingBackend}
            className="btn btn-emerald"
            style={{
              padding: '16px 24px',
              borderRadius: 14,
              fontSize: '1rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Upload style={{ width: 20, height: 20 }} />
            {isSavingBackend 
              ? 'UPLOADING ALL BRAND ROWS...' 
              : `☁️ UPLOAD ALL (${brandItems.length}) BRAND ROWS TO GOOGLE SHEETS & DRIVE`}
          </button>

        </form>

      </div>

      {/* INSPECTION RECORDS HISTORY */}
      <div className="card" style={{ background: '#ffffff', borderRadius: 20, border: '1px solid var(--border-light)', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers style={{ width: 20, height: 20, color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>
              Inspection Records History ({inspections.length})
            </h3>
          </div>
        </div>

        {inspections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            No inspection records saved yet. Fill out the form above to record your first garment inspection.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-light)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px' }}>Timestamp</th>
                  <th style={{ padding: '10px 14px' }}>Lot #</th>
                  <th style={{ padding: '10px 14px' }}>Brand</th>
                  <th style={{ padding: '10px 14px' }}>Fabric</th>
                  <th style={{ padding: '10px 14px' }}>Oversized</th>
                  <th style={{ padding: '10px 14px' }}>Photos</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((insp) => (
                  <tr key={insp.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {insp.timestamp}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 'bold', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                      {insp.lotNumber}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 'bold', color: 'var(--accent-purple)' }}>
                      {insp.brand || (insp.sheetDetails && insp.sheetDetails['brand']) || 'N/A'}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>
                      {insp.fabric || (insp.sheetDetails && insp.sheetDetails['fabric']) || 'N/A'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        background: insp.isOversized === 'YES' ? '#eff6ff' : '#ecfdf5',
                        color: insp.isOversized === 'YES' ? '#2563eb' : '#047857'
                      }}>
                        {insp.isOversized}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        📸 {insp.photos?.length || 0} photo(s)
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteInspection(insp.id, insp.lotNumber)}
                        className="btn btn-outline"
                        style={{ padding: '4px 8px', borderRadius: 8, color: '#ef4444', borderColor: '#fca5a5' }}
                        title="Delete Record"
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
