const TelegramBot = require('node-telegram-bot-api');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const creds = require('./credentials.json');

// Configuración
const BOT_TOKEN = '7680078180:AAGf0UInb660cHm4Nv5DlINlQX0DpW4saVw'; // <-- Cambia esto por tu token real
const SHEET_ID = '1YR1LBoPgMwafd2iLc3Hm_ujnonqGxGT9rloUUCKAA3k';
const SHEET_NAME = 'Reservas';

// Estados temporales de usuarios
const estados = {};

// Utilidades de fechas y horas
function getMonthsOptions() {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      text: date.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
      value: `${date.getFullYear()}-${date.getMonth()}`
    });
  }
  return months;
}

function getDaysOptions(year, month) {
  const now = new Date();
  const days = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    // No mostrar días pasados
    if (
      date < new Date(now.getFullYear(), now.getMonth(), now.getDate())
    ) continue;
    days.push({
      text: d.toString().padStart(2, '0'),
      value: d
    });
  }
  return days;
}

function getHoursOptions() {
  const hours = [];
  for (let h = 13; h <= 22; h++) {
    for (let m of [0, 30]) {
      if (h === 22 && m > 0) continue;
      const label = `${h.toString().padStart(2, '0')}:${m === 0 ? '00' : '30'}`;
      hours.push({ text: label, value: label });
    }
  }
  return hours;
}

// Guardar reserva en Google Sheets
async function guardarReserva(reserva) {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[SHEET_NAME];
  if (!sheet) throw new Error("No se encontró la hoja 'Reservas'");
  await sheet.addRow({
    nombre: reserva.nombre,
    telefono: reserva.telefono,
    correo: reserva.correo,
    personas: reserva.personas,
    fecha: reserva.fecha,
    hora: reserva.hora,
    telegramID: reserva.telegramID,
    'Fecha de Registro': new Date().toLocaleString('es-ES'),
  });
}

// Menú principal
function mainMenu() {
  return {
    reply_markup: {
      keyboard: [
        ['📖 Ver carta', '📅 Reservar'],
        ['📞 Contacto', '❓ Preguntas frecuentes']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

// --- Bot ---
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  estados[msg.from.id] = {};
  bot.sendMessage(msg.chat.id, '¡Bienvenido al bot de reservas! ¿Qué deseas hacer?', mainMenu());
});

bot.on('message', async (msg) => {
  const id = msg.from.id;
  const text = msg.text;
  const estado = estados[id];

  // Menú principal
  if (!estado || !estado.paso) {
    if (text === '📖 Ver carta') {
      return bot.sendMessage(msg.chat.id, 'Aquí tienes nuestra carta:\nhttps://tucarta.com', mainMenu());
    }
    if (text === '📞 Contacto') {
      return bot.sendMessage(msg.chat.id, '📞 Teléfono: 123 456 789\n📧 Email: restaurante@ejemplo.com\n📍 Dirección: Calle Falsa 123', mainMenu());
    }
    if (text === '❓ Preguntas frecuentes') {
      return bot.sendMessage(
        msg.chat.id,
        '❓ *Preguntas frecuentes*\n\n' +
        '• ¿Puedo modificar mi reserva?\n  Sí, responde a este chat con tu nombre y la nueva información.\n' +
        '• ¿Hay opciones vegetarianas?\n  Sí, consulta nuestra carta.\n' +
        '• ¿Se aceptan mascotas?\n  Solo en la terraza.\n' +
        '• ¿Cuál es el horario?\n  De 13:00 a 22:00.',
        { ...mainMenu(), parse_mode: 'Markdown' }
      );
    }
    if (text === '📅 Reservar') {
      estados[id] = { paso: 'mes' };
      const months = getMonthsOptions();
      return bot.sendMessage(
        msg.chat.id,
        '¿Para qué mes quieres reservar?',
        {
          reply_markup: {
            keyboard: months.map(m => [m.text]),
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
    }
    return;
  }

  // Flujo de reserva
  try {
    if (estado.paso === 'mes') {
      const months = getMonthsOptions();
      const selected = months.find(m => m.text === text);
      if (!selected) {
        return bot.sendMessage(msg.chat.id, 'Por favor, selecciona un mes válido.', {
          reply_markup: {
            keyboard: months.map(m => [m.text]),
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
      }
      const [year, month] = selected.value.split('-').map(Number);
      estado.year = year;
      estado.month = month;
      estado.paso = 'dia';
      const days = getDaysOptions(year, month);
      const dayRows = [];
      for (let i = 0; i < days.length; i += 7) {
        dayRows.push(days.slice(i, i + 7).map(d => d.text));
      }
      return bot.sendMessage(msg.chat.id, '¿Qué día?', {
        reply_markup: {
          keyboard: dayRows,
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    }

    if (estado.paso === 'dia') {
      const days = getDaysOptions(estado.year, estado.month);
      if (!days.find(d => d.text === text)) {
        return bot.sendMessage(msg.chat.id, 'Selecciona un día válido.', {
          reply_markup: {
            keyboard: days.map(d => [d.text]),
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
      }
      estado.day = Number(text);
      estado.paso = 'hora';
      const hours = getHoursOptions();
      const hourRows = [];
      for (let i = 0; i < hours.length; i += 4) {
        hourRows.push(hours.slice(i, i + 4).map(h => h.text));
      }
      return bot.sendMessage(msg.chat.id, '¿A qué hora?', {
        reply_markup: {
          keyboard: hourRows,
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    }

    if (estado.paso === 'hora') {
      const hours = getHoursOptions();
      if (!hours.find(h => h.text === text)) {
        return bot.sendMessage(msg.chat.id, 'Selecciona una hora válida.', {
          reply_markup: {
            keyboard: hours.map(h => [h.text]),
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
      }
      estado.hora = text;
      estado.paso = 'personas';
      return bot.sendMessage(msg.chat.id, '¿Para cuántas personas es la reserva?', {
        reply_markup: { remove_keyboard: true }
      });
    }

    if (estado.paso === 'personas') {
      const num = parseInt(text);
      if (isNaN(num) || num < 1 || num > 20) {
        return bot.sendMessage(msg.chat.id, 'Introduce un número válido de personas (1-20).');
      }
      estado.personas = num;
      estado.paso = 'nombre';
      return bot.sendMessage(msg.chat.id, '¿Cuál es tu nombre completo?');
    }

    if (estado.paso === 'nombre') {
      if (text.length < 2) {
        return bot.sendMessage(msg.chat.id, 'Por favor, introduce un nombre válido.');
      }
      estado.nombre = text;
      estado.paso = 'telefono';
      return bot.sendMessage(msg.chat.id, '¿Cuál es tu número de teléfono?');
    }

    if (estado.paso === 'telefono') {
      if (!/^\d{9,15}$/.test(text.replace(/\s+/g, ''))) {
        return bot.sendMessage(msg.chat.id, 'Introduce un número de teléfono válido (solo dígitos).');
      }
      estado.telefono = text.replace(/\s+/g, '');
      estado.paso = 'correo';
      return bot.sendMessage(msg.chat.id, '¿Cuál es tu correo electrónico?');
    }

    if (estado.paso === 'correo') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        return bot.sendMessage(msg.chat.id, 'Introduce un correo electrónico válido.');
      }
      estado.correo = text;
      const fecha = `${estado.day.toString().padStart(2, '0')}-${(estado.month + 1).toString().padStart(2, '0')}-${estado.year}`;
      const reserva = {
        nombre: estado.nombre,
        telefono: estado.telefono,
        correo: estado.correo,
        personas: estado.personas,
        fecha,
        hora: estado.hora,
        telegramID: id
      };
      await guardarReserva(reserva);
      bot.sendMessage(
        msg.chat.id,
        `✅ ¡Reserva completada!\n\n` +
        `*Nombre:* ${reserva.nombre}\n` +
        `*Teléfono:* ${reserva.telefono}\n` +
        `*Correo:* ${reserva.correo}\n` +
        `*Personas:* ${reserva.personas}\n` +
        `*Fecha:* ${reserva.fecha}\n` +
        `*Hora:* ${reserva.hora}\n\n` +
        `Te esperamos. Si necesitas modificar tu reserva, responde a este chat.`,
        { ...mainMenu(), parse_mode: 'Markdown' }
      );
      delete estados[id];
      return;
    }
  } catch (err) {
    console.error('Error guardando reserva:', err);
    bot.sendMessage(msg.chat.id, '❌ Ocurrió un error al guardar tu reserva. Intenta de nuevo más tarde.', mainMenu());
    delete estados[id];
  }
});

console.log('Bot en marcha...');
