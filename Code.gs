// ── Utilidades ────────────────────────────────────────────────
function sha256(message) {
  const msgBytes = Utilities.newBlob(message).getBytes();
  const digest   = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, msgBytes);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function todayString() {
  // Formato YYYY-MM-DD en la zona horaria del script
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function expectedToken(email) {
  return sha256(email + todayString());
}

// Valida que el token del request coincida con el esperado para ese email
function validateToken(email, token) {
  if (!email || !token) return false;
  return token === expectedToken(email);
}

// ── doGet ─────────────────────────────────────────────────────
function doGet(e) {
  try {
    const sheetName = e.parameter.sheet;
    if (!sheetName) throw new Error("Falta el parámetro 'sheet'");

    // Validación de token en GET (email y token en query params)
    const email = e.parameter.email;
    const token = e.parameter.token;
    if (!validateToken(email, token)) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'No autorizado' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
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

// ── doPost ────────────────────────────────────────────────────
function doPost(e) {
  try {
    // Recibe JSON como texto plano para evitar preflight de CORS
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;

    // ── LOGIN (acción pública, sin token) ──────────────────────
    if (action === 'login') {
      const email    = (payload.email    || '').toLowerCase().trim();
      const passHash = (payload.password_hash || '');

      const ss    = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('usuarios');
      if (!sheet) throw new Error('Hoja \'usuarios\' no encontrada');

      const rows = sheet.getDataRange().getValues();
      // Encabezados: email | password_hash | nombre | rol | activo
      for (let i = 1; i < rows.length; i++) {
        const rowEmail = String(rows[i][0]).toLowerCase().trim();
        const rowHash  = String(rows[i][1]).trim();
        const nombre   = String(rows[i][2]);
        const rol      = String(rows[i][3]).toLowerCase().trim();
        const activo   = rows[i][4] === true || String(rows[i][4]).toUpperCase() === 'TRUE';

        if (rowEmail === email) {
          if (!activo) {
            return ContentService.createTextOutput(
              JSON.stringify({ success: false, error: 'Usuario inactivo' }))
              .setMimeType(ContentService.MimeType.JSON);
          }
          if (rowHash !== passHash) {
            return ContentService.createTextOutput(
              JSON.stringify({ success: false, error: 'Credenciales incorrectas' }))
              .setMimeType(ContentService.MimeType.JSON);
          }
          // Credenciales OK → devolver datos de sesión
          const token = expectedToken(email);
          return ContentService.createTextOutput(
            JSON.stringify({ success: true, nombre, email, rol, token }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'Credenciales incorrectas' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Acciones protegidas (requieren token) ──────────────────
    if (!validateToken(payload.email, payload.token)) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'No autorizado' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── CREATE USER (solo coordinador) ────────────────────────
    if (action === 'createUser') {
      const ss    = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('usuarios');
      if (!sheet) throw new Error('Hoja \'usuarios\' no encontrada');
      sheet.appendRow([
        payload.newEmail.toLowerCase().trim(),
        payload.password_hash,
        payload.nombre,
        payload.rol,
        'TRUE'
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheetName = payload.sheet;
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Hoja no encontrada");
    
    if (action === 'append') {
      sheet.appendRow(payload.row);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    else if (action === 'update') {
      const id   = payload.id;
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
