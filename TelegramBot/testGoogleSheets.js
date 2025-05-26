const { GoogleSpreadsheet } = require('google-spreadsheet');
const creds = require('./credentials.json');

(async () => {
  const doc = new GoogleSpreadsheet('1YR1LBoPgMwafd2iLc3Hm_ujnonqGxGT9rloUUCKAA3k');
  console.log('Métodos disponibles en doc:', Object.getOwnPropertyNames(Object.getPrototypeOf(doc)));
  if (typeof doc.useServiceAccountAuth !== 'function') {
    console.error('❌ useServiceAccountAuth NO está disponible. Tu entorno NO está usando la versión 4.x');
    return;
  }
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle['Reservas'];
  if (!sheet) throw new Error("No se encontró la hoja 'Reservas'");
  await sheet.addRow({
    nombre: 'Prueba',
    telefono: '123456789',
    correo: 'prueba@correo.com',
    personas: 2,
    fecha: '01-01-2025',
    hora: '13:00',
    telegramID: 123456,
    'Fecha de Registro': new Date().toLocaleString('es-ES'),
  });
  console.log('¡Fila añadida correctamente!');
})();