require('dotenv').config();
const { 
  Client, GatewayIntentBits, Partials, EmbedBuilder, 
  ActionRowBuilder, ButtonBuilder, ButtonStyle, 
  StringSelectMenuBuilder, ChannelType, PermissionFlagsBits,
  SlashCommandBuilder, REST, Routes, Collection
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message]
});

// ==============================
// 📦 IN-MEMORY DATABASE
// ==============================
const db = {
  tickets: new Map(),      // ticketId -> ticket data
  userStats: new Map(),    // userId -> stats
  staffStats: new Map(),   // staffId -> stats
  config: new Map(),       // guildId -> config
  ticketCounter: new Map() // guildId -> number
};

// ==============================
// 🌐 TRANSLATIONS
// ==============================
const lang = {
  ar: {
    ticket_opened: '🎫 تم فتح تذكرة جديدة',
    ticket_closed: '🔒 تم إغلاق التذكرة',
    ticket_claimed: '✅ تم استلام التذكرة',
    ticket_rated: '⭐ شكراً على تقييمك!',
    select_category: '📂 اختر نوع الطلب',
    support: '🛠️ دعم فني',
    purchase: '🛒 طلب شراء',
    complaint: '📢 شكوى',
    other: '❓ أخرى',
    open_ticket: '🎫 افتح تذكرة',
    close_ticket: '🔒 إغلاق',
    claim_ticket: '✋ استلام',
    transcript: '📋 سجل المحادثة',
    add_user: '➕ إضافة مستخدم',
    remove_user: '➖ إزالة مستخدم',
    rate_us: '⭐ قيّم الدعم',
    already_open: '❌ عندك تذكرة مفتوحة بالفعل!',
    no_permission: '❌ ما عندك صلاحية!',
    ticket_welcome: 'مرحباً {user}! تذكرتك رقم #{num}\nسيرد عليك فريق الدعم قريباً.',
    stats_title: '📊 إحصائيات البوت',
    close_confirm: 'هل أنت متأكد من إغلاق التذكرة؟',
    confirm: '✅ تأكيد',
    cancel: '❌ إلغاء',
  },
  en: {
    ticket_opened: '🎫 New Ticket Opened',
    ticket_closed: '🔒 Ticket Closed',
    ticket_claimed: '✅ Ticket Claimed',
    ticket_rated: '⭐ Thanks for your rating!',
    select_category: '📂 Select Request Type',
    support: '🛠️ Technical Support',
    purchase: '🛒 Purchase Request',
    complaint: '📢 Complaint',
    other: '❓ Other',
    open_ticket: '🎫 Open Ticket',
    close_ticket: '🔒 Close',
    claim_ticket: '✋ Claim',
    transcript: '📋 Transcript',
    add_user: '➕ Add User',
    remove_user: '➖ Remove User',
    rate_us: '⭐ Rate Support',
    already_open: '❌ You already have an open ticket!',
    no_permission: '❌ You don\'t have permission!',
    ticket_welcome: 'Welcome {user}! Your ticket number is #{num}\nSupport team will respond shortly.',
    stats_title: '📊 Bot Statistics',
    close_confirm: 'Are you sure you want to close this ticket?',
    confirm: '✅ Confirm',
    cancel: '❌ Cancel',
  }
};

function t(guildId, key) {
  const cfg = db.config.get(guildId) || {};
  const l = cfg.language || 'ar';
  return lang[l][key] || lang['ar'][key] || key;
}

// ==============================
// 🎨 COLORS & EMBEDS
// ==============================
const COLORS = {
  primary: 0x5865F2,
  success: 0x57F287,
  danger:  0xED4245,
  warning: 0xFEE75C,
  info:    0x00B0F4,
  gold:    0xFFD700,
};

function makeEmbed(opts) {
  return new EmbedBuilder()
    .setColor(opts.color || COLORS.primary)
    .setTitle(opts.title || '')
    .setDescription(opts.desc || '')
    .setTimestamp()
    .setFooter({ text: '🎫 Ticket System • ' + new Date().toLocaleDateString('ar-IQ') });
}

// ==============================
// 🎟️ TICKET PANEL
// ==============================
async function sendTicketPanel(channel, guildId) {
  const embed = makeEmbed({
    color: COLORS.primary,
    title: '🎫 نظام التذاكر | Ticket System',
    desc: [
      '**مرحباً بك في نظام الدعم!**',
      'اضغط على الزر أدناه لفتح تذكرة جديدة.',
      '',
      '**Welcome to our Support System!**',
      'Click the button below to open a new ticket.',
      '',
      '🛠️ دعم فني | Technical Support',
      '🛒 طلب شراء | Purchase Request',
      '📢 شكوى | Complaint',
      '❓ أخرى | Other',
    ].join('\n'),
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_open')
      .setLabel('🎫 افتح تذكرة | Open Ticket')
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ==============================
// 🗂️ CATEGORY SELECT
// ==============================
function makeCategorySelect(guildId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_category')
      .setPlaceholder('📂 اختر نوع الطلب | Select Category')
      .addOptions([
        { label: '🛠️ دعم فني | Support',    value: 'support',   description: 'مشاكل تقنية | Technical issues',   emoji: '🛠️' },
        { label: '🛒 شراء | Purchase',        value: 'purchase',  description: 'طلبات الشراء | Purchase requests',  emoji: '🛒' },
        { label: '📢 شكوى | Complaint',       value: 'complaint', description: 'تقديم شكوى | Submit complaint',    emoji: '📢' },
        { label: '❓ أخرى | Other',           value: 'other',     description: 'طلبات أخرى | Other requests',      emoji: '❓' },
      ])
  );
}

// ==============================
// 🔧 TICKET BUTTONS
// ==============================
function makeTicketButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 إغلاق | Close').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('✋ استلام | Claim').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_transcript').setLabel('📋 سجل | Transcript').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_add_user').setLabel('➕ إضافة | Add User').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_remove_user').setLabel('➖ إزالة | Remove User').setStyle(ButtonStyle.Primary),
  );
  return [row1, row2];
}

// ==============================
// ⭐ RATING BUTTONS
// ==============================
function makeRatingButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rate_1').setLabel('⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_2').setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_3').setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_4').setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_5').setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Primary),
  );
}

// ==============================
// 📋 TRANSCRIPT GENERATOR
// ==============================
async function generateTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].reverse();
  let text = `📋 Transcript - ${channel.name}\n`;
  text += `Generated: ${new Date().toLocaleString('ar-IQ')}\n`;
  text += '='.repeat(50) + '\n\n';
  
  for (const msg of sorted) {
    if (msg.author.bot && msg.embeds.length) {
      text += `[${new Date(msg.createdTimestamp).toLocaleTimeString()}] [BOT EMBED] ${msg.embeds[0].title || ''}\n`;
    } else if (!msg.author.bot) {
      text += `[${new Date(msg.createdTimestamp).toLocaleTimeString()}] ${msg.author.tag}: ${msg.content}\n`;
    }
  }
  return text;
}

// ==============================
// 📊 STATS EMBED
// ==============================
function makeStatsEmbed(guild) {
  let totalTickets = 0, openTickets = 0, closedTickets = 0, totalRatings = 0, ratingSum = 0;
  
  for (const [, ticket] of db.tickets) {
    if (ticket.guildId !== guild.id) continue;
    totalTickets++;
    if (ticket.status === 'open') openTickets++;
    else closedTickets++;
    if (ticket.rating) { totalRatings++; ratingSum += ticket.rating; }
  }
  
  const avgRating = totalRatings ? (ratingSum / totalRatings).toFixed(1) : 'N/A';
  
  // Top staff
  let topStaff = 'لا يوجد | None';
  let maxHandled = 0;
  for (const [staffId, stats] of db.staffStats) {
    if (stats.handled > maxHandled) { maxHandled = stats.handled; topStaff = `<@${staffId}> (${stats.handled})`; }
  }

  return makeEmbed({
    color: COLORS.gold,
    title: '📊 إحصائيات النظام | System Statistics',
    desc: [
      `🎫 **إجمالي التذاكر | Total:** ${totalTickets}`,
      `🟢 **مفتوحة | Open:** ${openTickets}`,
      `🔴 **مغلقة | Closed:** ${closedTickets}`,
      `⭐ **متوسط التقييم | Avg Rating:** ${avgRating}/5`,
      `🏆 **أفضل موظف | Top Staff:** ${topStaff}`,
    ].join('\n'),
  });
}

// ==============================
// 🎯 SLASH COMMANDS
// ==============================
const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('إعداد نظام التذاكر | Setup ticket system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o.setName('channel').setDescription('قناة التذاكر | Ticket channel').setRequired(true))
    .addChannelOption(o => o.setName('logs').setDescription('قناة السجلات | Logs channel').setRequired(false))
    .addRoleOption(o => o.setName('staff').setDescription('رتبة الدعم | Staff role').setRequired(false))
    .addStringOption(o => o.setName('language').setDescription('اللغة | Language').addChoices(
      { name: 'العربية', value: 'ar' },
      { name: 'English', value: 'en' },
      { name: 'عربي + English', value: 'both' }
    )),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('إحصائيات التذاكر | Ticket statistics'),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('إغلاق التذكرة الحالية | Close current ticket'),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('إضافة مستخدم للتذكرة | Add user to ticket')
    .addUserOption(o => o.setName('user').setDescription('المستخدم | User').setRequired(true)),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('إزالة مستخدم من التذكرة | Remove user from ticket')
    .addUserOption(o => o.setName('user').setDescription('المستخدم | User').setRequired(true)),

  new SlashCommandBuilder()
    .setName('claim')
    .setDescription('استلام التذكرة الحالية | Claim current ticket'),

  new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('استخراج سجل المحادثة | Get ticket transcript'),

  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('إرسال لوحة التذاكر | Send ticket panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map(c => c.toJSON());

// ==============================
// 🚀 BOT READY
// ==============================
client.once('ready', async () => {
  console.log(`✅ Bot Online: ${client.user.tag}`);
  client.user.setActivity('🎫 Ticket System', { type: 3 });

  // Register slash commands globally
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered!');
  } catch (err) {
    console.error('❌ Error registering commands:', err);
  }
});

// ==============================
// 💬 INTERACTION HANDLER
// ==============================
client.on('interactionCreate', async interaction => {
  try {
    const guildId = interaction.guildId;

    // ── SLASH COMMANDS ──
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
      return;
    }

    // ── BUTTON ──
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    // ── SELECT MENU ──
    if (interaction.isStringSelectMenu()) {
      await handleSelect(interaction);
      return;
    }
  } catch (err) {
    console.error('Interaction error:', err);
    try {
      const msg = { content: '❌ حدث خطأ | An error occurred', flags: 64 };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
      else await interaction.reply(msg);
    } catch {}
  }
});

// ==============================
// ⚡ SLASH COMMAND HANDLER
// ==============================
async function handleSlashCommand(interaction) {
  const { commandName, guild, member, channel } = interaction;
  const guildId = guild.id;
  const cfg = db.config.get(guildId) || {};

  if (commandName === 'setup') {
    const ticketChannel = interaction.options.getChannel('channel');
    const logsChannel   = interaction.options.getChannel('logs');
    const staffRole     = interaction.options.getRole('staff');
    const language      = interaction.options.getString('language') || 'ar';

    db.config.set(guildId, {
      ticketChannelId: ticketChannel.id,
      logsChannelId:   logsChannel?.id,
      staffRoleId:     staffRole?.id,
      language,
      category:        ticketChannel.parentId,
    });

    await sendTicketPanel(ticketChannel, guildId);
    await interaction.reply({ 
      embeds: [makeEmbed({ color: COLORS.success, title: '✅ تم الإعداد | Setup Complete', desc: `قناة التذاكر: ${ticketChannel}\nالسجلات: ${logsChannel || 'لا يوجد'}\nرتبة الدعم: ${staffRole || 'لا يوجد'}` })],
      flags: 64 
    });
  }

  else if (commandName === 'panel') {
    const ticketChannel = cfg.ticketChannelId ? guild.channels.cache.get(cfg.ticketChannelId) : channel;
    await sendTicketPanel(ticketChannel || channel, guildId);
    await interaction.reply({ content: '✅ تم إرسال اللوحة | Panel sent!', flags: 64 });
  }

  else if (commandName === 'stats') {
    await interaction.reply({ embeds: [makeStatsEmbed(guild)] });
  }

  else if (commandName === 'close') {
    const ticket = [...db.tickets.values()].find(t => t.channelId === channel.id);
    if (!ticket) return interaction.reply({ content: '❌ هذه القناة ليست تذكرة | This is not a ticket channel', flags: 64 });
    await closeTicket(interaction, ticket, channel);
  }

  else if (commandName === 'claim') {
    const ticket = [...db.tickets.values()].find(t => t.channelId === channel.id);
    if (!ticket) return interaction.reply({ content: '❌ ليست تذكرة | Not a ticket', flags: 64 });
    await claimTicket(interaction, ticket, channel);
  }

  else if (commandName === 'add') {
    const user = interaction.options.getUser('user');
    const ticket = [...db.tickets.values()].find(t => t.channelId === channel.id);
    if (!ticket) return interaction.reply({ content: '❌ ليست تذكرة | Not a ticket', flags: 64 });
    await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
    await interaction.reply({ embeds: [makeEmbed({ color: COLORS.success, title: `➕ تمت الإضافة | Added`, desc: `${user} تم إضافته للتذكرة | has been added to the ticket` })] });
  }

  else if (commandName === 'remove') {
    const user = interaction.options.getUser('user');
    const ticket = [...db.tickets.values()].find(t => t.channelId === channel.id);
    if (!ticket) return interaction.reply({ content: '❌ ليست تذكرة | Not a ticket', flags: 64 });
    if (user.id === ticket.userId) return interaction.reply({ content: '❌ لا يمكن إزالة صاحب التذكرة | Cannot remove ticket owner', flags: 64 });
    await channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
    await interaction.reply({ embeds: [makeEmbed({ color: COLORS.warning, title: `➖ تمت الإزالة | Removed`, desc: `${user} تم إزالته من التذكرة | has been removed` })] });
  }

  else if (commandName === 'transcript') {
    const ticket = [...db.tickets.values()].find(t => t.channelId === channel.id);
    if (!ticket) return interaction.reply({ content: '❌ ليست تذكرة | Not a ticket', flags: 64 });
    const text = await generateTranscript(channel);
    const { AttachmentBuilder } = require('discord.js');
    const buf = Buffer.from(text, 'utf-8');
    const att = new AttachmentBuilder(buf, { name: `transcript-${channel.name}.txt` });
    await interaction.reply({ files: [att], flags: 64 });
  }
}

// ==============================
// 🔘 BUTTON HANDLER
// ==============================
async function handleButton(interaction) {
  const { customId, guild, member, channel, user } = interaction;
  const guildId = guild.id;
  const cfg = db.config.get(guildId) || {};

  // ── OPEN TICKET ──
  if (customId === 'ticket_open') {
    // Check existing open ticket
    const existing = [...db.tickets.values()].find(t => t.userId === user.id && t.guildId === guildId && t.status === 'open');
    if (existing) {
      const ch = guild.channels.cache.get(existing.channelId);
      return interaction.reply({ content: `❌ عندك تذكرة مفتوحة: ${ch || 'محذوفة'} | You have an open ticket: ${ch || 'deleted'}`, flags: 64 });
    }
    // Show category select
    await interaction.reply({
      embeds: [makeEmbed({ color: COLORS.info, title: '📂 اختر الفئة | Select Category', desc: 'اختر نوع طلبك من القائمة | Choose your request type from the menu' })],
      components: [makeCategorySelect(guildId)],
      flags: 64
    });
  }

  // ── CLOSE TICKET ──
  else if (customId === 'ticket_close') {
    const ticket = [...db.tickets.values()].find(t => t.channelId === channel.id);
    if (!ticket) return interaction.reply({ content: '❌ ليست تذكرة | Not a ticket', flags: 64 });
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('✅ تأكيد | Confirm').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('❌ إلغاء | Cancel').setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({
      embeds: [makeEmbed({ color: COLORS.warning, title: '⚠️ تأكيد الإغلاق | Confirm Close', desc: 'هل أنت متأكد؟ | Are you sure?' })],
      components: [row],
      flags: 64
    });
  }

  else if (customId === 'ticket_close_confirm') {
    const ticket = [...db.tickets.values()].find(t => t.channelId === channel.id);
    if (!ticket) return;
    await interaction.deferUpdate();
    await closeTicket(interaction, ticket, channel);
  }

  else if (customId === 'ticket_close_cancel') {
    await interaction.update({ content: '❌ تم الإلغاء | Cancelled', embeds: [], components: [] });
  }

  // ── CLAIM TICKET ──
  else if (customId === 'ticket_claim') {
    const ticket = [...db.tickets.values()].find(t => t.channelId === channel.id);
    if (!ticket) return interaction.reply({ content: '❌ ليست تذكرة | Not a ticket', flags: 64 });
    await claimTicket(interaction, ticket, channel);
  }

  // ── TRANSCRIPT ──
  else if (customId === 'ticket_transcript') {
    const ticket = [...db.tickets.values()].find(t => t.channelId === channel.id);
    if (!ticket) return interaction.reply({ content: '❌ ليست تذكرة | Not a ticket', flags: 64 });
    const text = await generateTranscript(channel);
    const { AttachmentBuilder } = require('discord.js');
    const buf = Buffer.from(text, 'utf-8');
    const att = new AttachmentBuilder(buf, { name: `transcript-${channel.name}.txt` });
    await interaction.reply({ content: '📋 Transcript', files: [att], flags: 64 });
  }

  // ── ADD/REMOVE USER ──
  else if (customId === 'ticket_add_user') {
    await interaction.reply({ content: '➕ استخدم الأمر `/add @مستخدم` | Use `/add @user`', flags: 64 });
  }
  else if (customId === 'ticket_remove_user') {
    await interaction.reply({ content: '➖ استخدم الأمر `/remove @مستخدم` | Use `/remove @user`', flags: 64 });
  }

  // ── RATINGS ──
  else if (customId.startsWith('rate_')) {
    const rating = parseInt(customId.split('_')[1]);
    const ticket = [...db.tickets.values()].find(t => t.userId === user.id && t.guildId === guildId);
    if (ticket) {
      ticket.rating = rating;
      // Update staff stats
      if (ticket.claimedBy) {
        const ss = db.staffStats.get(ticket.claimedBy) || { handled: 0, totalRating: 0, ratingCount: 0 };
        ss.totalRating += rating;
        ss.ratingCount++;
        db.staffStats.set(ticket.claimedBy, ss);
      }
    }
    const stars = '⭐'.repeat(rating);
    await interaction.update({
      embeds: [makeEmbed({ color: COLORS.gold, title: '⭐ شكراً على تقييمك! | Thanks for rating!', desc: `تقييمك: ${stars} (${rating}/5)\nنقدر دعمك! | We appreciate your feedback!` })],
      components: []
    });
  }
}

// ==============================
// 📋 SELECT MENU HANDLER
// ==============================
async function handleSelect(interaction) {
  const { customId, values, guild, user } = interaction;
  const guildId = guild.id;
  const cfg = db.config.get(guildId) || {};

  if (customId === 'ticket_category') {
    const category = values[0];
    await interaction.deferUpdate();
    await createTicket(interaction, category, guild, user, cfg);
  }
}

// ==============================
// 🆕 CREATE TICKET
// ==============================
async function createTicket(interaction, category, guild, user, cfg) {
  const guildId = guild.id;
  
  // Generate ticket number
  const num = (db.ticketCounter.get(guildId) || 0) + 1;
  db.ticketCounter.set(guildId, num);

  const catLabels = { support: 'دعم|Support', purchase: 'شراء|Purchase', complaint: 'شكوى|Complaint', other: 'أخرى|Other' };
  const channelName = `ticket-${String(num).padStart(4, '0')}-${user.username.slice(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  // Permission overwrites
  const overwrites = [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
  ];
  if (cfg.staffRoleId) {
    overwrites.push({ id: cfg.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] });
  }

  // Create channel
  const parentId = cfg.category || null;
  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parentId,
    permissionOverwrites: overwrites,
    topic: `🎫 تذكرة #${num} | ${user.tag} | ${catLabels[category]}`,
  });

  // Save ticket data
  const ticketId = `${guildId}-${num}`;
  const ticketData = {
    id: ticketId,
    guildId,
    channelId: ticketChannel.id,
    userId: user.id,
    category,
    status: 'open',
    number: num,
    openedAt: Date.now(),
    claimedBy: null,
    rating: null,
  };
  db.tickets.set(ticketId, ticketData);

  // Update user stats
  const us = db.userStats.get(user.id) || { opened: 0 };
  us.opened++;
  db.userStats.set(user.id, us);

  // Welcome embed
  const catEmojis = { support: '🛠️', purchase: '🛒', complaint: '📢', other: '❓' };
  const welcomeEmbed = makeEmbed({
    color: COLORS.primary,
    title: `${catEmojis[category]} تذكرة #${num} | Ticket #${num}`,
    desc: [
      `**صاحب التذكرة | Owner:** ${user}`,
      `**الفئة | Category:** ${catLabels[category]}`,
      `**الحالة | Status:** 🟢 مفتوحة | Open`,
      `**الوقت | Time:** <t:${Math.floor(Date.now()/1000)}:F>`,
      '',
      `مرحباً ${user}! سيرد عليك فريق الدعم قريباً.`,
      `Welcome ${user}! Support team will respond shortly.`,
    ].join('\n'),
  });

  if (cfg.staffRoleId) {
    welcomeEmbed.addFields({ name: '👥 فريق الدعم | Support Team', value: `<@&${cfg.staffRoleId}>`, inline: true });
  }

  await ticketChannel.send({ 
    content: `${user} ${cfg.staffRoleId ? `<@&${cfg.staffRoleId}>` : ''}`,
    embeds: [welcomeEmbed], 
    components: makeTicketButtons() 
  });

  // Update the select menu message
  await interaction.editReply({
    embeds: [makeEmbed({ color: COLORS.success, title: '✅ تم فتح التذكرة | Ticket Created', desc: `تذكرتك جاهزة: ${ticketChannel}\n\nYour ticket is ready: ${ticketChannel}` })],
    components: [],
  });

  // Log to logs channel
  if (cfg.logsChannelId) {
    const logsChannel = guild.channels.cache.get(cfg.logsChannelId);
    if (logsChannel) {
      await logsChannel.send({ embeds: [makeEmbed({
        color: COLORS.info,
        title: '📝 تذكرة جديدة | New Ticket',
        desc: `**#${num}** | ${user.tag} | ${catLabels[category]}\nقناة | Channel: ${ticketChannel}`
      })] });
    }
  }
}

// ==============================
// 🔒 CLOSE TICKET
// ==============================
async function closeTicket(interaction, ticket, channel) {
  const guild = interaction.guild;
  const cfg = db.config.get(guild.id) || {};
  
  ticket.status = 'closed';
  ticket.closedAt = Date.now();
  ticket.closedBy = interaction.user.id;

  // Generate transcript
  const text = await generateTranscript(channel);
  const { AttachmentBuilder } = require('discord.js');
  const buf = Buffer.from(text, 'utf-8');
  const att = new AttachmentBuilder(buf, { name: `transcript-${channel.name}.txt` });

  // Log
  if (cfg.logsChannelId) {
    const logsChannel = guild.channels.cache.get(cfg.logsChannelId);
    if (logsChannel) {
      const owner = guild.members.cache.get(ticket.userId);
      await logsChannel.send({
        embeds: [makeEmbed({
          color: COLORS.danger,
          title: '🔒 تذكرة مغلقة | Ticket Closed',
          desc: [
            `**رقم | Number:** #${ticket.number}`,
            `**صاحب التذكرة | Owner:** ${owner || ticket.userId}`,
            `**أُغلقت بواسطة | Closed by:** ${interaction.user}`,
            `**مدة | Duration:** ${Math.round((Date.now() - ticket.openedAt) / 60000)} دقيقة | minutes`,
            ticket.claimedBy ? `**استلمها | Claimed by:** <@${ticket.claimedBy}>` : '',
          ].filter(Boolean).join('\n')
        })],
        files: [att]
      });
    }
  }

  // Send rating request to ticket owner via DM
  try {
    const owner = await guild.members.fetch(ticket.userId);
    if (owner) {
      await owner.send({
        embeds: [makeEmbed({ color: COLORS.gold, title: '⭐ قيّم تجربتك | Rate Your Experience', desc: `تذكرة #${ticket.number}\nكيف كانت تجربتك مع فريق الدعم؟\nHow was your experience with our support team?` })],
        components: [makeRatingButtons()]
      }).catch(() => {});
    }
  } catch {}

  // Close channel with delay
  const closeEmbed = makeEmbed({
    color: COLORS.danger,
    title: '🔒 جاري الإغلاق | Closing...',
    desc: 'سيتم حذف هذه القناة بعد 5 ثوانٍ | This channel will be deleted in 5 seconds'
  });

  await channel.send({ embeds: [closeEmbed] });

  setTimeout(async () => {
    try { await channel.delete(); } catch {}
  }, 5000);
}

// ==============================
// ✋ CLAIM TICKET
// ==============================
async function claimTicket(interaction, ticket, channel) {
  const { user, guild } = interaction;
  const cfg = db.config.get(guild.id) || {};

  // Check staff permission
  if (cfg.staffRoleId) {
    const member = await guild.members.fetch(user.id);
    if (!member.roles.cache.has(cfg.staffRoleId) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ رتبة الدعم مطلوبة | Staff role required', flags: 64 });
    }
  }

  if (ticket.claimedBy) {
    return interaction.reply({ content: `❌ التذكرة محجوزة بالفعل بواسطة <@${ticket.claimedBy}> | Already claimed`, flags: 64 });
  }

  ticket.claimedBy = user.id;

  // Update staff stats
  const ss = db.staffStats.get(user.id) || { handled: 0, totalRating: 0, ratingCount: 0 };
  ss.handled++;
  db.staffStats.set(user.id, ss);

  await channel.send({ embeds: [makeEmbed({
    color: COLORS.success,
    title: '✅ تم استلام التذكرة | Ticket Claimed',
    desc: `${user} استلم هذه التذكرة وسيتولى المساعدة.\n${user} has claimed this ticket and will assist you.`
  })] });

  await interaction.reply({ content: '✅ تم الاستلام | Claimed successfully', flags: 64 });
}

// ==============================
// 🔌 LOGIN
// ==============================
client.login(process.env.DISCORD_TOKEN);
