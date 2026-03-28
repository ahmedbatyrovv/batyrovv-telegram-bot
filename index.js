require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = "8519760477:AAGl_BGTVaSvFJO_XOJkcinPyifQi5_ffEc";
if (!token) {
  console.error("❌ Bot tokeni berilmedi!");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// ==================== MAGLUMAT BAZASY ====================
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

const logInfo = msg =>
  console.log(
    `[${new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })}] ${msg}`
  );
const logError = (msg, err) =>
  console.error(`${msg}: ${err.message}\nStack: ${err.stack || err}`);

const saveDB = () => {
  try {
    fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
    logInfo("✅ db.json saklandy");
  } catch (e) {
    logError("db.json ýazmakda ýalňyşlyk", e);
  }
};

const loadDB = () => {
  if (fs.existsSync("db.json")) {
    db = JSON.parse(fs.readFileSync("db.json"));
    logInfo("✅ db.json ýüklenildi");
  } else saveDB();
};
loadDB();

const delay = ms => new Promise(r => setTimeout(r, ms));

const isMainAdmin = id => db.admins.includes(id);
const isAssistantAdmin = id => db.assistantAdmins.includes(id);
const isAnyAdmin = id => isMainAdmin(id) || isAssistantAdmin(id);

// ==================== ULANYJY FUNKSIÝALARY ====================
async function checkMembership(chatId) {
  const required = [...db.channels, ...db.folderChannels];
  const notMember = [];
  for (const ch of required) {
    try {
      const chat = await bot.getChat(ch);
      const status = await bot.getChatMember(chat.id, chatId);
      if (["left", "kicked"].includes(status.status)) notMember.push(ch);
      await delay(400);
    } catch (err) {
      notMember.push(ch);
    }
  }
  return { isMember: notMember.length === 0, notMemberChannels: notMember };
}

function showChannels(chatId, notMember = []) {
  let text = notMember.length
    ? "❗ Kanallara doly agza bolmadyňyz:\n\n"
    : "VPN almak üçin kanallara agza boluň:\n\n";
  const keyboard = {
    inline_keyboard: [
      ...db.channels.map(c => [
        { text: `📢 ${c}`, url: `https://t.me/${c.slice(1)}` }
      ]),
      [{ text: `📂 Premium Folder`, url: db.folderInviteLink }],
      [{ text: `✅ Agza Boldum`, callback_data: "check_membership" }],
      [{ text: `🔙 Esasy Menýu`, callback_data: "main_menu" }]
    ]
  };
  bot.sendMessage(chatId, text, { reply_markup: keyboard });
}

async function showMainMenu(chatId) {
  let text = "👋 Hoş geldiňiz!\n\nAşakdaky bölümleri saýlaň:";
  if (db.startMessage) text = db.startMessage;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔑 𝐌𝐮𝐠𝐭 𝐕𝐏𝐍 𝐀𝐥𝐦𝐚𝐤", callback_data: "get_free_vpn" }
      ],
      [{ text: "💎 𝐏𝐫𝐞𝐦𝐢𝐮𝐦 𝐕𝐏𝐍", callback_data: "premium_vpn" }],
      [
        { text: "💻 𝐃𝐞𝐯 𝐈𝐧𝐟𝐨", callback_data: "dev_info" },
        { text: "📊 𝐒𝐭𝐚𝐭𝐢𝐬𝐭𝐢𝐤𝐚", callback_data: "user_statistika" }
      ]
    ]
  };

  if (db.startImageId) {
    await bot.sendPhoto(chatId, db.startImageId, {
      caption: text,
      parse_mode: "HTML",
      reply_markup: keyboard
    });
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: keyboard
    });
  }
}

// ==================== ADMIN PANELLER ====================
function showMainAdminPanel(chatId) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔒 VPN kody çalyşmak", callback_data: "replace_vpn" },
        { text: "📊 Statistika", callback_data: "admin_statistika" }
      ],
      [
        { text: "➕ Kanal goşmak", callback_data: "add_channel" },
        { text: "➖ Kanal aýyrmak", callback_data: "remove_channel" }
      ],
      [
        { text: "➕ Addlist kanal goş", callback_data: "add_folder_channel" },
        { text: "➖ Addlist kanal aýyr", callback_data: "remove_folder_channel" }
      ],
      [{ text: "🔗 Addlist link çalyş", callback_data: "replace_folder_link" }],
      [{ text: "📢 Bildiriş ugratmak", callback_data: "admin_message" }],
      [
        { text: "➕ Esasy Admin goş", callback_data: "add_admin" },
        { text: "➖ Esasy Admin aýyr", callback_data: "remove_admin" }
      ],
      [
        { text: "➕ Kömekçi Admin goş", callback_data: "add_assistant_admin" },
        {
          text: "➖ Kömekçi Admin aýyr",
          callback_data: "remove_assistant_admin"
        }
      ],
      [
        { text: "🖼️ Start suraty goş", callback_data: "add_start_image" },
        { text: "🗑️ Start suraty aýyr", callback_data: "remove_start_image" }
      ],
      [
        {
          text: "📝 Start teksti üýtget",
          callback_data: "change_start_message"
        }
      ],
      [{ text: "🔙 Esasy Menýu", callback_data: "main_menu" }]
    ]
  };
  bot.sendMessage(chatId, "⚙️ **Esasy Admin Paneli** (Doly rugsat)", {
    parse_mode: "Markdown",
    reply_markup: keyboard
  });
}

function showAssistantPanel(chatId) {
  const keyboard = {
    inline_keyboard: [
      [{ text: "🔒 VPN kody çalyşmak", callback_data: "replace_vpn" }],
      [{ text: "📊 Statistika", callback_data: "admin_statistika" }],
      [{ text: "📢 Bildiriş ugratmak", callback_data: "admin_message" }],
      [{ text: "🔙 Esasy Menýu", callback_data: "main_menu" }]
    ]
  };
  bot.sendMessage(chatId, "⚙️ **Kömekçi Admin Paneli**", {
    parse_mode: "Markdown",
    reply_markup: keyboard
  });
}

// ==================== /START ====================
bot.onText(/\/start/, async msg => {
  const chatId = msg.chat.id;
  if (!db.users.includes(chatId)) {
    db.users.push(chatId);
    saveDB();
  }
  showMainMenu(chatId);
});

// ==================== /ADMIN ====================
bot.onText(/\/admin/, async msg => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAnyAdmin(userId)) {
    return bot.sendMessage(chatId, "❌ Siz administrator däl!");
  }

  if (isMainAdmin(userId)) {
    const choiceKeyboard = {
      inline_keyboard: [
        [{ text: "⚙️ Main Admin Panel", callback_data: "main_admin_panel" }],
        [
          {
            text: "⚙️ Assistant Admin Panel",
            callback_data: "assistant_admin_panel"
          }
        ]
      ]
    };
    bot.sendMessage(chatId, "⚙️ **Choose Admin Panel**", {
      parse_mode: "Markdown",
      reply_markup: choiceKeyboard
    });
  } else {
    showAssistantPanel(chatId);
  }
});

// ==================== CALLBACK QUERIES (ÄHLI FUNKSIÝALAR) ====================
bot.on("callback_query", async query => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const userId = query.from.id;

  // Köne habary poz
  try {
    await bot.deleteMessage(chatId, query.message.message_id);
  } catch (e) {}

  try {
    // ====================== PANEL SAÝLAMAK ======================
    if (data === "main_admin_panel" && isMainAdmin(userId)) {
      showMainAdminPanel(chatId);
      return;
    }

    if (data === "assistant_admin_panel" && isMainAdmin(userId)) {
      showAssistantPanel(chatId);
      return;
    }

    // ====================== ULANYJY MENÝUSY ======================
    if (data === "main_menu") {
      await showMainMenu(chatId);
      return;
    }

    if (data === "get_free_vpn") {
      const { isMember, notMemberChannels } = await checkMembership(chatId);
      if (isMember) {
        if (db.currentVpnCode) {
          await bot.sendMessage(
            chatId,
            `🔒 Mugt VPN kody:\n\n<code>${db.currentVpnCode}</code>`,
            { parse_mode: "HTML" }
          );
          db.vpnDistributedCount++;
          saveDB();
        } else {
          await bot.sendMessage(chatId, "Häzirki wagtda bazada VPN kody ýok.");
        }
      } else {
        showChannels(chatId, notMemberChannels);
      }
      return;
    }

    if (data === "check_membership") {
      const { isMember, notMemberChannels } = await checkMembership(chatId);
      if (isMember && db.currentVpnCode) {
        await bot.sendMessage(
          chatId,
          `🔒 VPN kody:\n\n<code>${db.currentVpnCode}</code>`,
          { parse_mode: "HTML" }
        );
        db.vpnDistributedCount++;
        saveDB();
      } else if (!isMember) {
        showChannels(chatId, notMemberChannels);
      }
      return;
    }

    if (data === "premium_vpn") {
      await bot.sendMessage(
        chatId,
        `AhmedDev VPN Service
        
Happ, V2BOX, Streisand, Outline we beýleki VPN'laryň hemmesi satylýar!

💼 STANDART

⚡️ 1 hepde — 50 TMT
💸 1 aý — 150 TMT

👑 VIP

🔥 1 hepde — 75 TMT
💎 1 aý — 200 TMT

🛡️ Block YOK
⚙️ 7/24 goldaw
✅ 100% garantiýa

💥 NÄME ÜÇIN BIZI SAÝLAMALY?

⚡️ Ýokary tizlik
🔒 Doly howpsuzlyk & gizlinlik
🌍 Durnukly, güýçli serverler
🚀 Hemişe online & problemasyz

📲 Habarlaşmak Üçin:

📞 Telegram: @ahmeddevv
📞 Instagram: @ahmeddevv
📞 TikTok: @ahmeddevv
📞 Link: https://linkm.me/users/ahmeddevv`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Contact", url: "https://t.me/ahmeddevv" }],
              [{ text: "🔙 Esasy Menýu", callback_data: "main_menu" }]
            ]
          }
        }
      );
      return;
    }

    if (data === "dev_info") {
      await bot.sendMessage(
        chatId,
        `👨‍💻 Developer Info

Name: AhmedDev
Job: FullStack Web Developer
Contact: @ahmeddevv        `,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Esasy Menýu", callback_data: "main_menu" }]
            ]
          }
        }
      );
      return;
    }

    if (data === "user_statistika") {
      await bot.sendMessage(
        chatId,
        `📊 Statistika\n\n👤 Jemi ulanyjylar: ${db.users
          .length}\n🔑 Berlen VPN: ${db.vpnDistributedCount}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Esasy Menýu", callback_data: "main_menu" }]
            ]
          }
        }
      );
      return;
    }

    // ====================== ADMIN FUNKSIÝALARY ======================
    if (!isAnyAdmin(userId)) return;

    if (data === "admin_statistika") {
      const text = `📊 Statistika:\n\n👤 Ulanyjylar: ${db.users
        .length}\n🔑 VPN: ${db.vpnDistributedCount}\n📢 Kanallar: ${db.channels
        .length}\n📂 Addlist: ${db.folderChannels.length}`;
      await bot.sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔙 Yza",
                callback_data: isMainAdmin(userId)
                  ? "main_admin_panel"
                  : "assistant_admin_panel"
              }
            ]
          ]
        }
      });
      return;
    }

    if (data === "replace_vpn") {
      await bot.sendMessage(chatId, "🔒 Täze VPN kodyny giriziň:");
      bot.once("message", async msg => {
        if (msg.chat.id === chatId && msg.text) {
          db.currentVpnCode = msg.text;
          saveDB();
          await bot.sendMessage(chatId, "✅ VPN kody üstünlikli çalşyldy!");
          isMainAdmin(userId)
            ? showMainAdminPanel(chatId)
            : showAssistantPanel(chatId);
        }
      });
      return;
    }

    if (data === "admin_message") {
      await bot.sendMessage(
        chatId,
        "📢 Ähli ulanyjylara ugratjak tekstiňizi ýazyň:"
      );
      bot.once("message", async msg => {
        if (msg.chat.id === chatId && msg.text) {
          let success = 0;
          for (const uid of db.users) {
            try {
              await bot.sendMessage(uid, `📢 Admin habary:\n\n${msg.text}`);
              success++;
              await delay(50);
            } catch (e) {}
          }
          await bot.sendMessage(
            chatId,
            `✅ Habar ugradyldy! Üstünlikli: ${success}`
          );
        }
      });
      return;
    }

    // ====================== DIŇE ESASY ADMIN ======================
    if (!isMainAdmin(userId)) return;

    // Kanal goşmak
    if (data === "add_channel") {
      await bot.sendMessage(
        chatId,
        "➕ Goşjak kanalyň adyny giriziň (@channelname):"
      );
      bot.once("message", async msg => {
        if (msg.text && msg.text.startsWith("@")) {
          db.channels.push(msg.text);
          saveDB();
          await bot.sendMessage(chatId, `✅ Kanal goşuldy: ${msg.text}`);
          showMainAdminPanel(chatId);
        }
      });
      return;
    }

    // Kanal aýyrmak
    if (data === "remove_channel") {
      if (db.channels.length === 0)
        return bot.sendMessage(chatId, "Bazada kanal tapylmady.");
      const kb = {
        inline_keyboard: db.channels.map(c => [
          { text: `➖ ${c}`, callback_data: `rem_ch_${c}` }
        ])
      };
      await bot.sendMessage(chatId, "➖ Aýyrmak isleýän kanalyňy saýla:", {
        reply_markup: kb
      });
      return;
    }
    if (data.startsWith("rem_ch_")) {
      const ch = data.replace("rem_ch_", "");
      db.channels = db.channels.filter(c => c !== ch);
      saveDB();
      await bot.sendMessage(chatId, `✅ ${ch} aýyryldy.`);
      showMainAdminPanel(chatId);
      return;
    }

    // Addlist kanal goşmak
    if (data === "add_folder_channel") {
      await bot.sendMessage(
        chatId,
        "➕ Addlist üçin kanalynyň adyny giriziň (@channelname):"
      );
      bot.once("message", async msg => {
        if (msg.text && msg.text.startsWith("@")) {
          db.folderChannels.push(msg.text);
          saveDB();
          await bot.sendMessage(chatId, `✅ Addlista kanal goşuldy.`);
          showMainAdminPanel(chatId);
        }
      });
      return;
    }

    // Addlist kanal aýyrmak
    if (data === "remove_folder_channel") {
      if (db.folderChannels.length === 0)
        return bot.sendMessage(
          chatId,
          "Addlistdan aýyrmak üçin kanal tapylmady."
        );
      const kb = {
        inline_keyboard: db.folderChannels.map(c => [
          { text: `➖ ${c}`, callback_data: `rem_fold_${c}` }
        ])
      };
      await bot.sendMessage(
        chatId,
        "➖ Addlistdan aýyrmak isleýän kanalyňy saýla:",
        { reply_markup: kb }
      );
      return;
    }
    if (data.startsWith("rem_fold_")) {
      const ch = data.replace("rem_fold_", "");
      db.folderChannels = db.folderChannels.filter(c => c !== ch);
      saveDB();
      await bot.sendMessage(chatId, `✅ ${ch} aýyryldy.`);
      showMainAdminPanel(chatId);
      return;
    }

    // Addlist link çalyşmak
    if (data === "replace_folder_link") {
      await bot.sendMessage(chatId, "🔗 Täze Addlist baglanyşygyny giriziň:");
      bot.once("message", async msg => {
        if (msg.text) {
          db.folderInviteLink = msg.text;
          saveDB();
          await bot.sendMessage(chatId, "✅ Addlist linki çalşyldy!");
          showMainAdminPanel(chatId);
        }
      });
      return;
    }

    // Esasy Admin goşmak
    if (data === "add_admin") {
      await bot.sendMessage(chatId, "➕ Täze esasy admin ID-sini giriziň:");
      bot.once("message", async msg => {
        const id = parseInt(msg.text);
        if (!isNaN(id) && !db.admins.includes(id)) {
          db.admins.push(id);
          saveDB();
          await bot.sendMessage(chatId, `✅ Esasy Admin goşuldy: ${id}`);
          showMainAdminPanel(chatId);
        }
      });
      return;
    }

    // Kömekçi Admin goşmak
    if (data === "add_assistant_admin") {
      await bot.sendMessage(chatId, "➕ Täze kömekçi admin ID-sini giriziň:");
      bot.once("message", async msg => {
        const id = parseInt(msg.text);
        if (!isNaN(id) && !db.assistantAdmins.includes(id)) {
          db.assistantAdmins.push(id);
          saveDB();
          await bot.sendMessage(chatId, `✅ Kömekçi Admin goşuldy: ${id}`);
          showMainAdminPanel(chatId);
        }
      });
      return;
    }

    // Esasy Admin aýyrmak
    if (data === "remove_admin") {
      if (db.admins.length <= 1)
        return bot.sendMessage(chatId, "Iň az bir esasy admin galan bolmaly.");
      const kb = {
        inline_keyboard: db.admins.map(id => [
          { text: `➖ ${id}`, callback_data: `rem_main_${id}` }
        ])
      };
      await bot.sendMessage(chatId, "➖ Aýyrmak isleýän esasy admini saýlaň:", {
        reply_markup: kb
      });
      return;
    }
    if (data.startsWith("rem_main_")) {
      const id = parseInt(data.replace("rem_main_", ""));
      if (id !== userId) {
        db.admins = db.admins.filter(a => a !== id);
        saveDB();
        await bot.sendMessage(chatId, `✅ Esasy Admin ${id} aýyryldy.`);
        showMainAdminPanel(chatId);
      }
      return;
    }

    // Kömekçi Admin aýyrmak
    if (data === "remove_assistant_admin") {
      if (db.assistantAdmins.length === 0)
        return bot.sendMessage(chatId, "Kömekçi admin ýok.");
      const kb = {
        inline_keyboard: db.assistantAdmins.map(id => [
          { text: `➖ ${id}`, callback_data: `rem_ass_${id}` }
        ])
      };
      await bot.sendMessage(
        chatId,
        "➖ Aýyrmak isleýän kömekçi admini saýlaň:",
        { reply_markup: kb }
      );
      return;
    }
    if (data.startsWith("rem_ass_")) {
      const id = parseInt(data.replace("rem_ass_", ""));
      db.assistantAdmins = db.assistantAdmins.filter(a => a !== id);
      saveDB();
      await bot.sendMessage(chatId, `✅ Kömekçi Admin ${id} aýyryldy.`);
      showMainAdminPanel(chatId);
      return;
    }

    // Start suraty goşmak
    if (data === "add_start_image") {
      await bot.sendMessage(chatId, "🖼️ Start üçin suraty ugradyň:");
      bot.once("message", async msg => {
        if (msg.photo) {
          db.startImageId = msg.photo[msg.photo.length - 1].file_id;
          saveDB();
          await bot.sendMessage(chatId, "✅ Start suraty goşuldy.");
          showMainAdminPanel(chatId);
        }
      });
      return;
    }

    // Start suraty aýyrmak
    if (data === "remove_start_image") {
      db.startImageId = "";
      saveDB();
      await bot.sendMessage(chatId, "🗑️ Start suraty aýyryldy.");
      showMainAdminPanel(chatId);
      return;
    }

    // Start habary üýtgetmek
    if (data === "change_start_message") {
      await bot.sendMessage(chatId, "📝 Start üçin täze habary giriziň:");
      bot.once("message", async msg => {
        if (msg.text) {
          db.startMessage = msg.text;
          saveDB();
          await bot.sendMessage(chatId, "✅ Start habary üýtgedildi.");
          showMainAdminPanel(chatId);
        }
      });
      return;
    }
  } catch (error) {
    logError("Callback ýalňyşlygy", error);
    await bot.answerCallbackQuery(query.id, {
      text: "Ýalňyşlyk ýüze çykdy!",
      show_alert: true
    });
  }
});

bot.getMe().then(info => logInfo(`✅ Bot işledi → @${info.username}`));
logInfo("🚀 Bot işledilýär...");
