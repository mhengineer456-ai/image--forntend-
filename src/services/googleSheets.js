// Service for fetching Google Sheets JobOrder & Inspection Data
export const DEFAULT_JOBORDER_SHEET_ID = '1fKSwGBIpzWEFk566WRQ4bzQ0anJlmasoY8TwrTLQHXI';
export const DEFAULT_STORAGE_SHEET_ID = '1e2Ts2gOGIYSXwO6vi_Zij8y5azpW9iSEnWEl6TZki4s';
export const DEFAULT_SHEET_ID = DEFAULT_JOBORDER_SHEET_ID;
export const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyfXLvA6BJSAm_AHWLvm25ZIWzdh5d8OTtwHq22CZQSu9E8UYD61KYchabCht8oaivH/exec';

// PASTE YOUR GOOGLE API KEY HERE
export const DEFAULT_API_KEY = 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk';

// Convert Google Drive Links to Direct Viewable Image URLs (No CORS / X-Frame-Options blocking)
export const getDirectDriveImageUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const firstUrl = url.split(',')[0].trim();
  if (!firstUrl || firstUrl === 'No Photo') return '';
  if (firstUrl.startsWith('data:image')) return firstUrl;
  
  let fileId = null;
  if (firstUrl.includes('id=')) {
    fileId = firstUrl.split('id=')[1]?.split('&')[0];
  } else if (firstUrl.includes('/file/d/')) {
    fileId = firstUrl.split('/file/d/')[1]?.split('/')[0];
  } else if (firstUrl.includes('/d/')) {
    fileId = firstUrl.split('/d/')[1]?.split('=')[0]?.split('/')[0];
  } else if (firstUrl.length > 20 && !firstUrl.includes('/')) {
    fileId = firstUrl;
  }
  
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
  }

  return firstUrl;
};

export const fetchJobOrderData = async (apiKey, sheetId = DEFAULT_JOBORDER_SHEET_ID, preferredRange = 'JobOrder!A1:Z5000') => {
  const cleanSheetId = (sheetId && sheetId.trim()) ? sheetId.trim() : DEFAULT_JOBORDER_SHEET_ID;
  const cleanApiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : DEFAULT_API_KEY.trim();

  if (!cleanApiKey || cleanApiKey === 'YOUR_GOOGLE_API_KEY_HERE') {
    throw new Error('Google Sheets API Key is required. Please set your API Key in Settings.');
  }

  const rangesToTry = [preferredRange, 'JobOrder!A1:Z5000', 'Inspections!A1:Z5000', 'Sheet1!A1:Z5000', 'A1:Z5000'];
  const uniqueRanges = Array.from(new Set(rangesToTry.filter(Boolean)));

  let lastError = null;

  for (const currentRange of uniqueRanges) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSheetId}/values/${encodeURIComponent(currentRange)}?key=${cleanApiKey}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const rows = data.values || [];

        if (rows.length < 2) {
          return { headers: [], rows: [], items: [] };
        }

        const headers = rows[0].map(h => String(h).trim().toLowerCase());
        const rawRows = rows.slice(1);

        const items = rawRows.map((row, idx) => {
          const obj = { _rowIdx: idx + 2 };
          headers.forEach((h, colIdx) => {
            obj[h] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
          });
          return obj;
        });

        return { headers, rows: rawRows, items };
      } else {
        const errorJson = await response.json().catch(() => ({}));
        const message = errorJson.error?.message || `HTTP ${response.status} Error`;
        lastError = new Error(`Google Sheets API Error: ${message}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  console.error("fetchJobOrderData failure:", lastError);
  throw lastError || new Error('Unable to parse range or fetch data from Google Sheet.');
};

// Fetch Inspection Records & Photos from Google Sheet (Tab: Inspections)
export const fetchInspectionData = async (apiKey, storageSheetId = DEFAULT_STORAGE_SHEET_ID) => {
  return fetchJobOrderData(apiKey, storageSheetId, 'Inspections!A1:Z5000');
};

// Search Lot Number in JobOrder items
export const findLotInJobOrder = (items, lotNumber) => {
  if (!items || !lotNumber) return [];
  const query = String(lotNumber).trim().toLowerCase();

  return items.filter(item => {
    const lotInSheet = (
      item['lot number'] || 
      item['lot no'] || 
      item['lot_no'] || 
      item['lot'] || 
      item['batch'] || 
      item['batch_no'] ||
      item['job order no'] ||
      ''
    ).toLowerCase();

    if (!lotInSheet) return false;
    return lotInSheet === query || lotInSheet.includes(query) || (query.length >= 3 && lotInSheet.endsWith(query));
  });
};
