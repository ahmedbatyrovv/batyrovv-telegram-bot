require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// Bot tokeni
const token = "8519760477:AAGl_BGTVaSvFJO_XOJkcinPyifQi5_ffEc";
if (!token) {
  console.error(
    "Ýalňyşlyk: Bot tokeni berilmedi. .env faýlynda BOT_TOKEN üýtgeşýänini düzüň."
  );
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// JSON maglumat bazasy
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

// Loglama funksiýalary
const logInfo = message => {
  console.log(
    `${new Date().toLocaleString("en-US", {
      timeZone: "Asia/Seoul"
    })} - ${message}`
  );
};

const logError = (message, error) => {
  console.error(`${message}: ${error.message}\nStack: ${error.stack}`);
};

// JSON bilen işlemek üçin funksiýalar
const saveDB = () => {
  try {
    fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
    logInfo("db.json ýazuw üstünlikli ýerine ýetirildi.");
  } catch (error) {
    logError("db.json ýazuwda ýalňyşlyk", error);
    throw new Error("Maglumat bazasyny ýazmak başarmady.");
  }
};

const loadDB = () => {
  try {
    if (fs.existsSync("db.json")) {
      const data = JSON.parse(fs.readFileSync("db.json"));
      if (
        !data.channels ||
        !data.folderChannels ||
        !data.admins ||
        !data.assistantAdmins ||
        !data.users
      ) {
        throw new Error("db.json faýlynda nädogry format.");
      }
      logInfo("db.json ýüklenildi.");
      return data;
    } else {
      logInfo("db.json faýly ýok, täze faýl döredilýär.");
      saveDB();
      return db;
    }
  } catch (error) {
    logError("db.json ýüklemede ýalňyşlyk", error);
    logInfo("Default maglumat bazasy ulanylýar.");
    saveDB();
    return db;
  }
};

// Maglumat bazasyny ýüklemek
db = loadDB();

// Telegram API çäklendirmelerini dolandyrmak
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const apiRequestWithRetry = async (fn, retries = 5, delayMs = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 429 || error.message.includes("404 Not Found")) {
        logInfo(
          `API ýalňyşlygy (${error.code || "404"}): ${i +
            1}-nji synanyşyk, garaşma: ${delayMs}ms`
        );
        await delay(delayMs);
        delayMs *= 2;
      } else {
        throw error;
      }
    }
  }
  throw new Error("API çäklendirmesi: Synanyşyklar gutardy.");
};

// Admin statusyny barlamak
const isMainAdmin = userId => db.admins.includes(userId);
const isAssistantAdmin = userId => db.assistantAdmins.includes(userId);
const isAnyAdmin = userId => isMainAdmin(userId) || isAssistantAdmin(userId);

// Ulanyjynyň agzalygy barlamak
async function checkMembership(chatId) {
  const requiredChannels = [...db.channels, ...db.folderChannels];
  const notMemberChannels = [];

  for (const channel of requiredChannels) {
    try {
      if (!channel.startsWith("@")) {
        logInfo(`Nädip kanal: ${channel}`);
        notMemberChannels.push(channel);
        continue;
      }
      const chat = await apiRequestWithRetry(() => bot.getChat(channel));
      const status = await apiRequestWithRetry(() =>
        bot.getChatMember(chat.id, chatId)
      );
      if (status.status === "left" || status.status === "kicked") {
        notMemberChannels.push(channel);
      }
      await delay(500);
    } catch (error) {
      logError(`Kanalda ${channel} üçin ${chatId} barlamada ýalňyşlyk`, error);
      notMemberChannels.push(channel);
    }
  }

  return { isMember: notMemberChannels.length === 0, notMemberChannels };
}

// Kanallary we papkany görkezmek
function showChannels(chatId, notMemberChannels = []) {
  const nonFolderChannels = notMemberChannels.filter(c =>
    db.channels.includes(c)
  );
  const folderNotMemberChannels = notMemberChannels.filter(c =>
    db.folderChannels.includes(c)
  );

  let message = "VPN kody almak üçin aşakdaky kanallara agza boluň:\n";
  if (notMemberChannels.length > 0) {
    message =
      "Siz aşakdaky kanallara doly agza bolmadyňyz. Kanallara agza boluň we täzeden synanşyň:\n";
    if (nonFolderChannels.length > 0) {
      message +=
        "\nKanallar:\n" + nonFolderChannels.map(c => `${c}`).join("\n");
    }
    if (folderNotMemberChannels.length > 0) {
      message +=
        "\nAddlist'daky Kanallar:\n" +
        folderNotMemberChannels.map(c => `${c}`).join("\n");
    }
  }

  const keyboard = {
    inline_keyboard: [
      ...(nonFolderChannels.length > 0
        ? nonFolderChannels.map(channel => [
            { text: `📢 Kanal`, url: `https://t.me/${channel.slice(1)}` }
          ])
        : db.channels.map(channel => [
            { text: `📢 Kanal`, url: `https://t.me/${channel.slice(1)}` }
          ])),

      [{ text: `📢 Premium Folder`, url: db.folderInviteLink }],
      [{ text: `✅ Agza Boldum`, callback_data: "check_membership" }]
    ]
  };

  bot.sendMessage(chatId, message, { reply_markup: keyboard }).catch(error => {
    logError(`Habary ugradyp bolmady ${chatId}`, error);
  });
}

// /start komandasy
bot.onText(/\/start/, async msg => {
  const chatId = msg.chat.id;
  try {
    if (!db.users.includes(chatId)) {
      db.users.push(chatId);
      saveDB();
      logInfo(`Täze ulanyjy goşuldy: ${chatId}`);
    }

    const { isMember, notMemberChannels } = await checkMembership(chatId);
    if (isMember) {
      if (db.currentVpnCode) {
        await bot.sendMessage(
          chatId,
          `🔒 VPN kody: \n\n<code>${db.currentVpnCode}</code>`,
          {
            parse_mode: "HTML"
          }
        );
        db.vpnDistributedCount++;
        saveDB();
        logInfo(`VPN kody ugradyldy: ${chatId}`);
      } else {
        await bot.sendMessage(chatId, "Häzirki wagtda VPN kody ýok.");
      }
    } else {
      showChannels(chatId, notMemberChannels);
    }
  } catch (error) {
    logError("/start komandasynda ýalňyşlyk", error);
    await bot
      .sendMessage(chatId, "Ýalňyşlyk ýüze çykdy. Soňra synanyşyň.")
      .catch(err => {
        logError("Ýalňyşlyk habary ugratmakda ýalňyşlyk", err);
      });
  }
});

// /admin komandasy
bot.onText(/\/admin/, async msg => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  try {
    if (isAnyAdmin(userId)) {
      if (isMainAdmin(userId)) {
        const adminButtons = {
          inline_keyboard: [
            [
              {
                text: "⚙️ Esasy Admin Panel",
                callback_data: "main_admin_panel"
              }
            ],
            [
              {
                text: "⚙️ Kömekçi Admin Panel",
                callback_data: "assistant_admin_panel"
              }
            ]
          ]
        };

        await bot.sendMessage(chatId, "⚙️ Admin paneline hoş geldiňiz!", {
          reply_markup: adminButtons
        });
      } else if (isAssistantAdmin(userId)) {
        const adminButtons = {
          inline_keyboard: [
            [
              {
                text: "⚙️ Kömekçi Admin Panel",
                callback_data: "assistant_admin_panel"
              }
            ]
          ]
        };

        await bot.sendMessage(
          chatId,
          "⚙️ Kömekçi admin paneline hoş geldiňiz!",
          {
            reply_markup: adminButtons
          }
        );
      }
      logInfo(`Admin paneli görkezildi: ${chatId}`);
    } else {
      await bot.sendMessage(chatId, "Siz administrator däl.");
    }
  } catch (error) {
    logError("/admin komandasynda ýalňyşlyk", error);
    await bot.sendMessage(chatId, "Ýalňyşlyk ýüze çykdy.").catch(err => {
      logError("Ýalňyşlyk habary ugratmakda ýalňyşlyk", err);
    });
  }
});

// Callback soraglary
bot.on("callback_query", async query => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const userId = query.from.id;

  try {
    // User panel callbacks
    if (data === "check_membership") {
      const { isMember, notMemberChannels } = await checkMembership(chatId);
      if (isMember) {
        if (db.currentVpnCode) {
          await bot.sendMessage(
            chatId,
            `🔒 VPN kody: \n\n<code>${db.currentVpnCode}</code>`,
            {
              parse_mode: "HTML"
            }
          );
          db.vpnDistributedCount++;
          saveDB();
          logInfo(`VPN kody ugradyldy: ${chatId}`);
        } else {
          await bot.sendMessage(chatId, "Häzirki wagtda VPN kody ýok.");
        }
      } else {
        showChannels(chatId, notMemberChannels);
      }
    }

    if (data === "admin_statistika" && isAnyAdmin(userId)) {
      try {
        const userCount = db.users.length;
        const mainAdminCount = db.admins.length;
        const assistantAdminCount = db.assistantAdmins.length;
        const channelCount = db.channels.length;
        const folderChannelCount = db.folderChannels.length;
        await bot.sendMessage(
          chatId,
          `📊 Statistika:\n\n` +
            `👤 Jemi Ulanyjylaryň Sany: ${userCount}\n` +
            `👑 Esasy Adminleriň Sany: ${mainAdminCount}\n` +
            `🤝 Kömekçi Adminleriň Sany: ${assistantAdminCount}\n` +
            `📢 Kanallaryň Sany: ${channelCount}\n` +
            `📂 Addlistdaky Kanallaryň Sany: ${folderChannelCount}`
        );
        logInfo(`Admin statistikasy görkezildi: ${chatId}`);
      } catch (error) {
        logError("Admin statistikasy görkezmekde ýalňyşlyk", error);
        await bot.sendMessage(
          chatId,
          "Statistikany görkezmekde ýalňyşlyk ýüze çykdy."
        );
      }
    }

    if (data === "main_admin_panel" && isMainAdmin(userId)) {
      const mainAdminButtons = {
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
            {
              text: "➕ Addlist'a kanal goşmak",
              callback_data: "add_folder_channel"
            },
            {
              text: "➖ Addlist kanalyny aýyrmak",
              callback_data: "remove_folder_channel"
            }
          ],
          [
            {
              text: "🔗 Addlist Ssylka Çalsmak",
              callback_data: "replace_folder_link"
            },
            { text: "📢 Bildiriş Ugratmak", callback_data: "admin_message" }
          ],

          [
            { text: "➕ 👑 Admin Goşmak", callback_data: "add_admin" },
            { text: "➖ 👑 Admin Aýyr", callback_data: "remove_admin" }
          ],

          [
            {
              text: "➕ Kömekçi Admin Goşmak",
              callback_data: "add_assistant_admin"
            },
            {
              text: "➖ Kömekçi Admin Aýyr",
              callback_data: "remove_assistant_admin"
            }
          ],

          [
            { text: "🖼️ Start suraty goş", callback_data: "add_start_image" },
            {
              text: "🗑️ Start suraty aýyr",
              callback_data: "remove_start_image"
            }
          ],

          [
            {
              text: "📝 Start message üýtget",
              callback_data: "change_start_message"
            }
          ]
        ]
      };

      await bot.sendMessage(chatId, "⚙️ Esasy Admin Paneli:", {
        reply_markup: mainAdminButtons
      });
      logInfo(`Esasy admin paneli görkezildi: ${chatId}`);
    }

    if (data === "assistant_admin_panel" && isAnyAdmin(userId)) {
      const assistantAdminButtons = {
        inline_keyboard: [
          [{ text: "📊 Statistika", callback_data: "admin_statistika" }],
          [{ text: "📢 Admin Message", callback_data: "admin_message" }],
          [{ text: "🔒 VPN kody çalyşmak", callback_data: "replace_vpn" }]
        ]
      };

      await bot.sendMessage(chatId, "⚙️ Kömekçi Admin Paneli:", {
        reply_markup: assistantAdminButtons
      });
      logInfo(`Kömekçi admin paneli görkezildi: ${chatId}`);
    }

    if (data === "replace_vpn" && isAnyAdmin(userId)) {
      await bot.sendMessage(chatId, "Täze VPN kodyny giriziň:");
      bot.once("message", async msg => {
        if (!msg.text) {
          await bot.sendMessage(
            chatId,
            "Diňe tekst habary ugradyp bilersiňiz."
          );
          return;
        }
        db.currentVpnCode = msg.text;
        saveDB();
        await bot.sendMessage(chatId, "🔒 VPN kody çalşyldy.").catch(error => {
          logError("VPN kody çalşylyş habary ugratmakda ýalňyşlyk", error);
        });
      });
    }

    if (data === "add_channel" && isMainAdmin(userId)) {
      await bot.sendMessage(
        chatId,
        "Kanalyň adyny giriziň (mysal üçin, @ChannelName):"
      );
      bot.once("message", async msg => {
        if (!msg.text) {
          await bot.sendMessage(
            chatId,
            "Diňe tekst habary ugradyp bilersiňiz."
          );
          return;
        }
        const channel = msg.text;
        if (!channel.startsWith("@")) {
          await bot
            .sendMessage(chatId, "Kanal ady @ bilan başlamaly.")
            .catch(error => {
              logError("Kanal goşulýan habar ugratmakda ýalňyşlyk", error);
            });
          return;
        }
        db.channels.push(channel);
        saveDB();
        await bot.sendMessage(chatId, "➕ Kanal goşuldy.").catch(error => {
          logError("Kanal goşuldy habary ugratmakda ýalňyşlyk", error);
        });
      });
    }

    if (data.startsWith("remove_channel_") && isMainAdmin(userId)) {
      const channel = data.replace("remove_channel_", "");
      if (db.channels.includes(channel)) {
        db.channels = db.channels.filter(c => c !== channel);
        saveDB();
        await bot.sendMessage(chatId, `➖ ${channel} aýyryldy.`);
      } else {
        await bot.sendMessage(
          chatId,
          `${channel} aýyrylmady, sebäbi maglumat bazasynda ýok.`
        );
      }
    }

    if (data === "add_folder_channel" && isMainAdmin(userId)) {
      await bot.sendMessage(chatId, "Papka üçin kanalyň adyny giriziň:");
      bot.once("message", async msg => {
        if (!msg.text) {
          await bot.sendMessage(
            chatId,
            "Diňe tekst habary ugradyp bilersiňiz."
          );
          return;
        }
        const channel = msg.text;
        if (!channel.startsWith("@")) {
          await bot
            .sendMessage(chatId, "Kanal ady @ bilan başlamaly.")
            .catch(error => {
              logError(
                "Papka kanaly goşulýan habar ugratmakda ýalňyşlyk",
                error
              );
            });
          return;
        }
        db.folderChannels.push(channel);
        saveDB();
        await bot
          .sendMessage(chatId, "➕ Addlist kanaly goşuldy.")
          .catch(error => {
            logError("Papka kanaly goşuldy habary ugratmakda ýalňyşlyk", error);
          });
      });
    }

    if (data.startsWith("remove_folder_channel_") && isMainAdmin(userId)) {
      const channel = data.replace("remove_folder_channel_", "");
      if (db.folderChannels.includes(channel)) {
        db.folderChannels = db.folderChannels.filter(c => c !== channel);
        saveDB();
        await bot.sendMessage(chatId, `➖ ${channel} addlist'dan aýyryldy.`);
      } else {
        await bot.sendMessage(
          chatId,
          `${channel} aýyrylmady, sebäbi maglumat bazasynda ýok.`
        );
      }
    }

    if (data === "remove_channel" && isMainAdmin(userId)) {
      if (db.channels.length === 0) {
        await bot.sendMessage(chatId, "Aýyrmak üçin kanal ýok.");
        return;
      }

      const channelButtons = {
        inline_keyboard: db.channels.map(channel => [
          { text: `➖ ${channel}`, callback_data: `remove_channel_${channel}` }
        ])
      };

      await bot.sendMessage(chatId, "Haýsy kanaly aýyrmakçy:", {
        reply_markup: channelButtons
      });
      logInfo(`Kanal aýyrma paneli görkezildi: ${chatId}`);
    }

    if (data === "remove_folder_channel" && isMainAdmin(userId)) {
      if (db.folderChannels.length === 0) {
        await bot.sendMessage(chatId, "Addlist'da aýyrmak üçin kanal ýok.");
        return;
      }

      const folderChannelButtons = {
        inline_keyboard: db.folderChannels.map(channel => [
          {
            text: `➖ ${channel}`,
            callback_data: `remove_folder_channel_${channel}`
          }
        ])
      };

      await bot.sendMessage(chatId, "Addlist'dan haýsy kanaly aýyrmakçy:", {
        reply_markup: folderChannelButtons
      });
      logInfo(`Addlist kanaly aýyrma paneli görkezildi: ${chatId}`);
    }

    if (data === "replace_folder_link" && isMainAdmin(userId)) {
      await bot.sendMessage(
        chatId,
        "Täze papka çakylyk baglanyşygyny giriziň:"
      );
      bot.once("message", async msg => {
        if (!msg.text) {
          await bot.sendMessage(
            chatId,
            "Diňe tekst habary ugradyp bilersiňiz."
          );
          return;
        }
        db.folderInviteLink = msg.text;
        saveDB();
        await bot
          .sendMessage(chatId, "🔗 Papka çakylyk baglanyşygy çalşyldy.")
          .catch(error => {
            logError("Papka linki çalşylyş habary ugratmakda ýalňyşlyk", error);
          });
      });
    }

    if (data === "admin_message" && isAnyAdmin(userId)) {
      await bot.sendMessage(chatId, "Admin habaryny giriziň:");
      bot.once("message", async msg => {
        if (!msg.text) {
          await bot.sendMessage(
            chatId,
            "Diňe tekst habary ugradyp bilersiňiz."
          );
          return;
        }
        const messageText = msg.text;
        let successCount = 0;
        let failCount = 0;

        for (const userId of db.users) {
          try {
            await apiRequestWithRetry(() =>
              bot.sendMessage(
                userId,
                `📢 Habar Admin Tarapyndan:\n\n ${messageText}`
              )
            );
            successCount++;
            await delay(50);
          } catch (error) {
            logError(`Admin habary ugratmakda ýalňyşlyk ${userId}`, error);
            failCount++;
          }
        }

        await bot.sendMessage(
          chatId,
          `📢 Admin habary ähli ulanyjylara ugradyldy:\nÜstünlikli: ${successCount}\nÝalňyşlyklar: ${failCount}`
        );
      });
    }

    if (data === "add_admin" && isMainAdmin(userId)) {
      await bot.sendMessage(
        chatId,
        "Täze adminiň Telegram ID-sini giriziň (mysal üçin, 6179312865):"
      );
      bot.once("message", async msg => {
        if (!msg.text) {
          await bot.sendMessage(
            chatId,
            "Diňe tekst habary ugradyp bilersiňiz."
          );
          return;
        }
        const adminId = parseInt(msg.text);
        if (isNaN(adminId) || adminId <= 0) {
          await bot
            .sendMessage(chatId, "Dogry Telegram ID giriziň (pozitiw san).")
            .catch(error => {
              logError("Nädip ID habary ugratmakda ýalňyşlyk", error);
            });
          return;
        }
        if (db.admins.includes(adminId)) {
          await bot.sendMessage(
            chatId,
            `ID ${adminId} eýýäm adminler siýahysynda bar.`
          );
          return;
        }
        try {
          await apiRequestWithRetry(() => bot.getChat(adminId));
          db.admins.push(adminId);
          saveDB();
          await bot
            .sendMessage(chatId, `➕ ID ${adminId} admin hökmünde goşuldy.`)
            .catch(error => {
              logError("Admin goşuldy habary ugratmakda ýalňyşlyk", error);
            });
        } catch (error) {
          logError(`ID ${adminId} barlamada ýalňyşlyk`, error);
          await bot
            .sendMessage(
              chatId,
              "Girizilen ID nädogry ýa-da ulanyjy tapylmady. Täzeden synanyşyň."
            )
            .catch(error => {
              logError("Ýalňyşlyk habary ugratmakda ýalňyşlyk", error);
            });
        }
      });
    }

    if (data === "add_assistant_admin" && isMainAdmin(userId)) {
      await bot.sendMessage(
        chatId,
        "Täze kömekçi adminiň Telegram ID-sini giriziň (mysal üçin, 610000000):"
      );
      bot.once("message", async msg => {
        if (!msg.text) {
          await bot.sendMessage(
            chatId,
            "Diňe tekst habary ugradyp bilersiňiz."
          );
          return;
        }
        const adminId = parseInt(msg.text);
        if (isNaN(adminId) || adminId <= 0) {
          await bot
            .sendMessage(chatId, "Dogry Telegram ID giriziň (pozitiw san).")
            .catch(error => {
              logError("Nädip ID habary ugratmakda ýalňyşlyk", error);
            });
          return;
        }
        if (db.assistantAdmins.includes(adminId)) {
          await bot.sendMessage(
            chatId,
            `ID ${adminId} eýýäm kömekçi adminler siýahysynda bar.`
          );
          return;
        }
        try {
          await apiRequestWithRetry(() => bot.getChat(adminId));
          db.assistantAdmins.push(adminId);
          saveDB();
          await bot
            .sendMessage(
              chatId,
              `➕ ID ${adminId} kömekçi admin hökmünde goşuldy.`
            )
            .catch(error => {
              logError(
                "Kömekçi admin goşuldy habary ugratmakda ýalňyşlyk",
                error
              );
            });
        } catch (error) {
          logError(`ID ${adminId} barlamada ýalňyşlyk`, error);
          await bot
            .sendMessage(
              chatId,
              "Girizilen ID nädogry ýa-da ulanyjy tapylmady. Täzeden synanyşyň."
            )
            .catch(error => {
              logError("Ýalňyşlyk habary ugratmakda ýalňyşlyk", error);
            });
        }
      });
    }

    if (data === "remove_admin" && isMainAdmin(userId)) {
      if (db.admins.length === 0) {
        await bot.sendMessage(chatId, "Aýyrmak üçin admin ýok.");
        return;
      }

      const adminButtons = {
        inline_keyboard: db.admins.map(adminId => [
          {
            text: `➖ Admin ${adminId}`,
            callback_data: `remove_admin_${adminId}`
          }
        ])
      };

      await bot.sendMessage(chatId, "Haýsy admini aýyrmakçy:", {
        reply_markup: adminButtons
      });
      logInfo(`Admin aýyrma paneli görkezildi: ${chatId}`);
    }

    if (data.startsWith("remove_admin_") && isMainAdmin(userId)) {
      const adminId = parseInt(data.replace("remove_admin_", ""));
      if (db.admins.includes(adminId)) {
        if (db.admins.length === 1) {
          await bot.sendMessage(chatId, "Iň bolmanda bir admin galan bolmaly.");
          return;
        }
        db.admins = db.admins.filter(id => id !== adminId);
        saveDB();
        await bot.sendMessage(chatId, `➖ Admin ${adminId} aýyryldy.`);
      } else {
        await bot.sendMessage(
          chatId,
          `Admin ${adminId} aýyrylmady, sebäbi maglumat bazasynda ýok.`
        );
      }
    }

    if (data === "remove_assistant_admin" && isMainAdmin(userId)) {
      if (db.assistantAdmins.length === 0) {
        await bot.sendMessage(chatId, "Aýyrmak üçin kömekçi admin ýok.");
        return;
      }

      const assistantAdminButtons = {
        inline_keyboard: db.assistantAdmins.map(adminId => [
          {
            text: `➖ Kömekçi Admin ${adminId}`,
            callback_data: `remove_assistant_admin_${adminId}`
          }
        ])
      };

      await bot.sendMessage(chatId, "Haýsy kömekçi admini aýyrmakçy:", {
        reply_markup: assistantAdminButtons
      });
      logInfo(`Kömekçi admin aýyrma paneli görkezildi: ${chatId}`);
    }

    if (data.startsWith("remove_assistant_admin_") && isMainAdmin(userId)) {
      const adminId = parseInt(data.replace("remove_assistant_admin_", ""));
      if (db.assistantAdmins.includes(adminId)) {
        db.assistantAdmins = db.assistantAdmins.filter(id => id !== adminId);
        saveDB();
        await bot.sendMessage(chatId, `➖ Kömekçi Admin ${adminId} aýyryldy.`);
      } else {
        await bot.sendMessage(
          chatId,
          `Kömekçi Admin ${adminId} aýyrylmady, sebäbi maglumat bazasynda ýok.`
        );
      }
    }

    if (data === "add_start_image" && isMainAdmin(userId)) {
      await bot.sendMessage(chatId, "Start üçin täze suraty ugradyň:");
      bot.once("message", async msg => {
        if (!msg.photo) {
          await bot.sendMessage(chatId, "Diňe surat ugradyp bilersiňiz.");
          return;
        }
        const photo = msg.photo[msg.photo.length - 1]; // Iň ýokary çözgütli suraty al
        db.startImageId = photo.file_id;
        saveDB();
        await bot
          .sendMessage(chatId, "🖼️ Start suraty goşuldy.")
          .catch(error => {
            logError("Start suraty goşuldy habary ugratmakda ýalňyşlyk", error);
          });
      });
    }

    if (data === "remove_start_image" && isMainAdmin(userId)) {
      db.startImageId = "";
      saveDB();
      await bot
        .sendMessage(chatId, "🗑️ Start suraty aýyryldy.")
        .catch(error => {
          logError("Start suraty aýyryldy habary ugratmakda ýalňyşlyk", error);
        });
    }

    if (data === "change_start_message" && isMainAdmin(userId)) {
      await bot.sendMessage(chatId, "Start üçin täze habary giriziň:");
      bot.once("message", async msg => {
        if (!msg.text) {
          await bot.sendMessage(
            chatId,
            "Diňe tekst habary ugradyp bilersiňiz."
          );
          return;
        }
        db.startMessage = msg.text;
        saveDB();
        await bot
          .sendMessage(chatId, "📝 Start habary üýtgedildi.")
          .catch(error => {
            logError(
              "Start habary üýtgedildi habary ugratmakda ýalňyşlyk",
              error
            );
          });
      });
    }
  } catch (error) {
    logError("Callback soragynda ýalňyşlyk", error);
    await bot
      .sendMessage(chatId, "Ýalňyşlyk ýüze çykdy. Soňra synanyşyň.")
      .catch(err => {
        logError("Ýalňyşlyk habary ugratmakda ýalňyşlyk", err);
      });
  }
});

// Polling ýalňyşlyklary
bot.on("polling_error", error => {
  logError("Polling ýalňyşlygy", error);
  if (error.message.includes("404 Not Found")) {
    console.error(
      "Ýalňyş bot tokeni ýa-da Telegram API-a ýetip bolmady. .env faýlynda BOT_TOKEN barlaň ýa-da internet birikmesini barlaň."
    );
  }
});

// Botyň işledigini barlamak
bot
  .getMe()
  .then(botInfo => {
    logInfo(`Bot işledi: @${botInfo.username} (ID: ${botInfo.id})`);
  })
  .catch(error => {
    logError("Bot barlamasynda ýalňyşlyk", error);
    if (error.message.includes("404 Not Found")) {
      console.error("Nädip bot tokeni. @BotFather bilen täze token alyň.");
      process.exit(1);
    }
  });

logInfo("Bot işledilýär...");
