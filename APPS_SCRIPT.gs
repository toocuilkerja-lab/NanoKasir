/**
 * GOOGLE APPS SCRIPT CODE (Copy this to your Apps Script Editor)
 * 
 * Instructions:
 * 1. Open Google Sheets.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code.
 * 4. Deploy > New Deployment > Web App.
 * 5. Set "Who has access" to "Anyone".
 * 6. Copy the Web App URL and put it in VITE_APPS_SCRIPT_URL in AI Studio Secrets.
 */

/*
function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getUsers') {
    const sheet = ss.getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const result = data.map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getMenu') {
    const sheet = ss.getSheetByName('Menu');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const result = data.map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getOrders') {
    const sheet = ss.getSheetByName('Orders');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const result = data.map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const payload = JSON.parse(e.postData.contents);
  const action = payload.action;
  
  if (action === 'addOrder') {
    const sheet = ss.getSheetByName('Orders');
    const id = Utilities.getUuid();
    sheet.appendRow([
      id,
      payload.queueNumber,
      payload.customerName,
      payload.tableNumber,
      payload.items,
      payload.totalPrice,
      payload.status,
      payload.timestamp,
      payload.user
    ]);
    return ContentService.createTextOutput(JSON.stringify({ success: true, id })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'updateOrderStatus') {
    const sheet = ss.getSheetByName('Orders');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === payload.id) {
        sheet.getRange(i + 1, 7).setValue(payload.status);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'addMenu') {
    const sheet = ss.getSheetByName('Menu');
    const id = Utilities.getUuid();
    sheet.appendRow([
      id,
      payload.name,
      payload.price,
      payload.user
    ]);
    return ContentService.createTextOutput(JSON.stringify({ success: true, id })).setMimeType(ContentService.MimeType.JSON);
  }
}
*/
