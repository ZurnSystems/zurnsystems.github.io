const TelegramBot = require('node-telegram-bot-api');

// Reemplaza con tu token:
const token = '7633689775:AAHPkP8PYnlOYjSdOYnIIl1DY_vtQQ--Y6c';

const bot = new TelegramBot(token, { polling: true });

console.log("🤖 Bot activo y escuchando mensajes...");

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name;

  bot.sendMessage(chatId, `¡Hola ${name}! Soy Zurnip, necesitas ayuda con algo?`);
});
