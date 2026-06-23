function doGet(e) {
  try {
    const sheetName = e.parameter.sheet;
    if (!sheetName) throw new Error("Falta el parámetro 'sheet'");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Hoja no encontrada");
    
    const data = sheet.getDataRange().getValues();
    
    return ContentService.createTextOutput(JSON.stringify({ data: data }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    // Recibe JSON como texto plano para evitar preflight de CORS
    const payload = JSON.parse(e.postData.contents);
    const sheetName = payload.sheet;
    const action = payload.action;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Hoja no encontrada");
    
    if (action === 'append') {
      sheet.appendRow(payload.row);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    else if (action === 'update') {
      const id = payload.id;
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      
      // Asume que el ID está siempre en la columna A (índice 0)
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == id) {
          rowIndex = i + 1; // +1 porque getRange es 1-indexed
          break;
        }
      }
      
      if (rowIndex === -1) throw new Error("ID no encontrado en la hoja " + sheetName);
      
      // payload.updates es un array: [{col: 10, val: 50}]
      payload.updates.forEach(upd => {
        sheet.getRange(rowIndex, upd.col).setValue(upd.val);
      });
      
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    throw new Error("Acción no válida");
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
