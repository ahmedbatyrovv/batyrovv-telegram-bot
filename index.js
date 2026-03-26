require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = "8519760477:AAGl_BGTVaSvFJO_XOJkcinPyifQi5_ffEc";
if (!token) {
  console.error("❌ Bot tokeni berilmedi!");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

let db = {
  channels: ["@cobra_servers", "@turkmen_shadowsocks"],
  folderChannels: ["@shadow_community_servers"],
  folderInviteLink: "https://t.me/addlist/IYQiFKJc9cQwMGZi",
  currentVpnCode: "",
  admins: [6179312865],
  assistantAdmins: [],
  users: [],
  vpnDistributedCount: 0,
  startImageId: "",
  startMessage: ""
};

const logInfo = (msg) => console.log(`[${new Date().toLocaleString("en-US", {timeZone:"Asia/Seoul"})}] ${msg}`);
const logError = (msg, err) => console.error(`${msg}: ${err.message}`);

const saveDB = () => {
  try { fs.writeFileSync("db.json", JSON.stringify(db, null, 2)); logInfo("db.json saklandy"); }
  catch(e) { logError("db.json ýazmakda ýalňyşlyk", e); }
};

const loadDB = () => {
  if (fs.existsSync("db.json")) {
    db = JSON.parse(fs.readFileSync("db.json"));
    logInfo("db.json ýüklenildi");
  } else saveDB();
};
loadDB();

const delay = ms => new Promise(r => setTimeout(r, ms));

const isMainAdmin = id => db.admins.includes(id);
const isAssistantAdmin = id => db.assistantAdmins.includes(id);
const isAnyAdmin = id => isMainAdmin(id) || isAssistantAdmin(id);

// ==================== ESASY MENÝU ====================
async function showMainMenu(chatId) {
  let text = "👋 Hoş geldiňiz!\n\nAşakdaky bölümleri saýlaň:";
  if (db.startMessage) text = db.startMessage + "\n\n" + text;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔑 Mugt VPN Almak", callback_data: "get_free_vpn" }],
      [{ text: "💎 Premium VPN", callback_data: "premium_vpn" }],
      [{ text: "👨‍💻 Developer Info", callback_data: "dev_info" }],
      [{ text: "📊 Statistika", callback_data: "user_statistika" }]
    ]
  };

  if (db.startImageId) {
    bot.sendPhoto(chatId, db.startImageId, { caption: text, parse_mode: "HTML", reply_markup: keyboard });
  } else {
    bot.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}

// ==================== /START ====================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  if (!db.users.includes(chatId)) {
    db.users.push(chatId);
    saveDB();
  }
  showMainMenu(chatId);
});

// ==================== /ADMIN ====================
bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAnyAdmin(userId)) {
    return bot.sendMessage(chatId, "❌ Siz administrator däl.");
  }

  if (isMainAdmin(userId)) {
    bot.sendMessage(chatId, "⚙️ Esasy Admin Paneli", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔒 VPN Kody Çalyş", callback_data: "replace_vpn" }],
          [{ text: "📊 Statistika", callback_data: "admin_statistika" }],
          [{ text: "➕ Kanal Goş", callback_data: "add_channel" }, { text: "➖ Kanal Aýyr", callback_data: "remove_channel" }],
          [{ text: "📢 Habar Ugrat", callback_data: "admin_message" }],
          // Başga admin funksiýalaryny isleseňiz goşup bileris
        ]
      }
    });
  } else {
    bot.sendMessage(chatId, "⚙️ Kömekçi Admin Paneli", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 Statistika", callback_data: "admin_statistika" }],
          [{ text: "🔒 VPN Kody Çalyş", callback_data: "replace_vpn" }]
        ]
      }
    });
  }
});

// Callbackler (esasy + admin)
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const userId = query.from.id;

  // Esasy ulanyjy menýusy
  if (data === "main_menu") return showMainMenu(chatId);
  if (data === "get_free_vpn") { /* mugt vpn logic */ }
  if (data === "premium_vpn") { /* premium */ }
  if (data === "dev_info") { /* dev info */ }
  if (data === "user_statistika") { /* user statistika */ }

  // Admin funksiýalary
  if (data === "replace_vpn" && isAnyAdmin(userId)) {
    bot.sendMessage(chatId, "Täze VPN kodyny giriziň:");
    // ... (öňki logic)
  }

  if (data === "admin_statistika" && isAnyAdmin(userId)) {
    bot.sendMessage(chatId, `📊 Statistika:\nUlanyjylar: ${db.users.length}\nVPN berildi: ${db.vpnDistributedCount}`);
  }

  // Beýleki admin funksiýalary (add_channel, remove_channel, admin_message we ş.m.) gerek bolsa aýt, doly goşayyn.
});

logInfo("🚀 Bot işledilýär...");