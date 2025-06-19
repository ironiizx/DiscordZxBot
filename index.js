require('dotenv').config();

const emailjs = require('@emailjs/nodejs');
emailjs.init(process.env.EMAILJS_PUBLIC_KEY);
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionsBitField
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const fakeGPTResponse = require('./smartResponder');

const registrationData = new Map();
const registrationStep = new Map();
const registeredUsers = new Set();
const completedOrders = new Set();
const registrationInitialized = new Set();
const emailPromptSent = new Set();
const confirmSentFlag = new Set();

const userTicketMap = new Map();

function isUserRegistered(userId) {
  return registeredUsers.has(userId);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});


const clientsFile = path.join(__dirname, 'clients.json');
if (fs.existsSync(clientsFile)) {
  try {
    const savedClients = JSON.parse(fs.readFileSync(clientsFile, 'utf8'));
    
    savedClients.forEach(client => registeredUsers.add(client.id));

    console.log('✅ Loaded registered users from clients.json');
  } catch (e) {
    console.error('❌ Failed to load registered users from file:', e);
  }
}


const ORDER_CHANNEL_ID = process.env.ORDER_CHANNEL_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const GUILD_ID = process.env.GUILD_ID;

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot is online as ${client.user.tag}`);
});

client.on(Events.GuildMemberRemove, async (member) => {
  registeredUsers.delete(member.id);
  registrationInitialized.delete(member.id);

  const clientsFile = path.join(__dirname, 'clients.json');
  try {
    if (fs.existsSync(clientsFile)) {
      const raw = fs.readFileSync(clientsFile, 'utf8') || '[]';
      const savedClients = JSON.parse(raw);

      const updatedClients = savedClients.filter(client => String(client.id) !== String(member.id));

      fs.writeFileSync(clientsFile, JSON.stringify(updatedClients, null, 2));
      console.log(`🗑️ Removed ${member.id} from clients.json`);
    }
  } catch (e) {
    console.error('❌ Failed to update clients.json on member leave:', e);
  }
});

 


  client.on(Events.GuildMemberAdd, async (member) => {
  registeredUsers.delete(member.id);
  registrationInitialized.delete(member.id);
  registrationStep.delete(member.id);
  emailPromptSent.delete(member.id);
  confirmSentFlag.delete(member.id);
  registrationData.delete(member.id);

  let registroChannel = member.guild.channels.cache.find(
    ch => ch.name === `registro-${member.id}`
  );

  if (!registroChannel) {
    registroChannel = await member.guild.channels.create({
      name: 'registro',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: member.guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: member.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: client.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });
  }

  try {
    const messages = await registroChannel.messages.fetch({ limit: 10 });
    await registroChannel.bulkDelete(messages);
  } catch (err) {
    console.error('❌ No se pudieron borrar los mensajes previos:', err);
  }

  registrationInitialized.add(member.id);
  registrationStep.set(member.id, 'awaitingAlias');

  await registroChannel.send({
    content: `👋 Welcome <@${member.id}> to **ZxCreativeFN**!\nPlease enter your **alias or name**:`
  });

  const role = member.guild.roles.cache.find(r => r.name.toLowerCase() === 'pendient');
  if (role) await member.roles.add(role).catch(console.error);
});



  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

  const userId = message.author.id;

  const inRegisterChannel = message.channel.name === 'registro' || message.channel.name === 'register';
  const step = registrationStep.get(message.author.id);

  if (!isUserRegistered(message.author.id) && !inRegisterChannel) return;

  if (step === 'awaitingAlias') {
    if (!emailPromptSent.has(userId)) {
      registrationData.set(userId, { alias: message.content });
      registrationStep.set(userId, 'awaitingEmail');
      emailPromptSent.add(userId); 
      await message.channel.send(`<@${userId}> Got it! Now, please enter your **email address**:`);
    }
    return;
  }


  if (step === 'awaitingEmail') {
    const data = registrationData.get(message.author.id) || {};
    data.email = message.content;

  if (step === 'awaitingEmail') {
    if (confirmSentFlag.has(userId)) return; 

  confirmSentFlag.add(userId); 

  const data = registrationData.get(userId) || {};
  data.email = message.content;
  registrationData.set(userId, data);
  registrationStep.delete(userId);

  const confirmBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_registration_${userId}`)
      .setLabel("✅ Confirm & Accept Terms")
      .setStyle(ButtonStyle.Success)
  );

  await message.channel.send({
    content: `<@${userId}> Great! Click the button below to confirm and proceed.\n\n*By confirming, you agree to share this information for identification purposes and to receive future order summaries.*`,
    components: [confirmBtn]
  });

  return;
}

}


  const text = message.content.toLowerCase();
  const order = client.orderData?.[userId];

  if (!isUserRegistered(userId)) return;

  if (text === '!order') {
    if (!client.orderData) client.orderData = {};

  
  delete client.orderData[userId];
  completedOrders.delete(userId);

  client.orderData[userId] = { step: 'delivery' };


  const messages = await message.channel.messages.fetch({ limit: 10 });
  const botMessages = messages.filter(m => m.author.id === client.user.id && m.components.length > 0);
  botMessages.forEach(m => m.delete().catch(console.error));

  await message.channel.send({
    content: '📦 Please select the delivery type for your thumbnail:',
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_delivery')
          .setPlaceholder('Choose your delivery speed')
          .addOptions([
            { label: 'Normal Delivery (2 weeks)', value: 'normal_delivery' },
            { label: 'Fast Delivery (48–72h)', value: 'fast_delivery' }
          ])
      )
    ]
  });
  return;
}
console.log('🧾 Current order before confirm:', order);
if (text === '!confirm') {
  if (completedOrders.has(userId)) {
    await message.channel.send('⚠️ Your order has already been confirmed.');
    return;
  }

  const order = client.orderData?.[userId];
  const user = registrationData.get(userId);

  if (!order || !order.delivery || !order.payment || !order.references) {
    await message.channel.send('❌ You need to complete all steps before confirming.');
    return;
  }

  const summary = `✅ Thanks for your order! Here's the summary:

📦 **Order Summary:**
🚚 **Delivery:** ${order.delivery.replace('_', ' ')}
💳 **Payment:** ${order.payment}
🖼️ **References/Idea:** ${order.references}

Please wait for **iRoniiZx** to respond. To modify your order, type \`!modify\`.`;

  await message.channel.send(summary);

  const orderChannel = await client.channels.fetch(ORDER_CHANNEL_ID).catch(console.error);
  if (orderChannel && orderChannel.isTextBased()) {
    await orderChannel.send({
      content: `🆕 **New Order from <@${userId}>**\n🚚 **Delivery:** ${order.delivery}\n💳 **Payment:** ${order.payment}\n🖼️ **References/Idea:** ${order.references}`
    });
  }

  const ordersFile = path.join(__dirname, 'orders.json');
  const newOrder = {
    timestamp: new Date().toISOString(),
    alias: user?.alias || 'Unknown',
    email: user?.email || 'unknown@email.com',
    delivery: order.delivery,
    payment: order.payment,
    references: order.references
  };

  try {
    let existingOrders = [];
    if (fs.existsSync(ordersFile)) {
      existingOrders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    }
    existingOrders.push(newOrder);
    fs.writeFileSync(ordersFile, JSON.stringify(existingOrders, null, 2));
    console.log('✅ Order saved to orders.json');
  } catch (err) {
    console.error('❌ Failed to save order:', err);
  }

  completedOrders.add(userId);
  delete client.orderData[userId];
  return;
}


if (text === '!modify') {
  if (!client.orderData) client.orderData = {};
  client.orderData[userId] = { step: 'delivery' };
  completedOrders.delete(userId);

  await message.channel.send('🔄 Starting modification. Please select the delivery type again:');
  return;
}

  if (text === '!commands') {
    await message.channel.send(`📋 **Available Commands:**
• \`!order\` – Start your thumbnail order
• \`!confirm\` – Confirm the order once complete
• \`!modify\` – Modify an existing order
• \`!workflow\` – Understand the design process
• \`!tips\` – Get tips for better thumbnails
• \`!portfolio\` – See past work and examples`);
    return;
  }

  if (text === '!workflow') {
    await message.channel.send(`🛠️ **Workflow**
1. You provide your idea
2. I create the thumbnail
3. You review and approve
4. Small adjustments allowed`);
    return;
  }

  if (text === '!tips') {
    await message.channel.send(`💡 **Tips for a Great Thumbnail**
• Provide clear references
• Use vibrant colors
• Avoid clutter`);
    return;
  }

  if (text === '!portfolio') {
    await message.channel.send(`🖼️ Check out my portfolio:\nhttps://www.behance.net/iRoniiZx`);
    return;
  }

if (order && order.step === 'references') {
  order.references = (order.references || '') + `\n${message.content}`;
  client.orderData[userId] = order;
  return;
}

  const reply = fakeGPTResponse(text, userId);
  if (reply) message.channel.send(reply);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  const userId = interaction.user.id;

if (interaction.isButton() && interaction.customId === `confirm_registration_${userId}` && !registeredUsers.has(userId)) {
    const data = registrationData.get(userId);
    if (!data) {
      return interaction.reply({ content: "❌ Registration data not found.", ephemeral: true });
    }

    const clientsFile = path.join(__dirname, 'clients.json');
    let existing = [];
    try {
      if (fs.existsSync(clientsFile)) {
        existing = JSON.parse(fs.readFileSync(clientsFile, 'utf8'));
      }
      existing.push({
        id: userId,
        alias: data.alias,
        email: data.email
      });
      fs.writeFileSync(clientsFile, JSON.stringify(existing, null, 2));
    } catch (err) {
      console.error('❌ Error writing to clients.json:', err);
    }

    const guild = interaction.guild;
    const orderChannel = await guild.channels.create({
      name: `order-from-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: userId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: client.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    await orderChannel.send(`✅ Registration completed!\n**Name:** ${data.alias}\n**Email:** ${data.email}\nYou can now use \`!order\` to start.`);
    await interaction.channel.delete().catch(console.error);

    registeredUsers.add(userId);
    registrationData.delete(userId);
    registrationStep.delete(userId);

    try {
  const authData = process.env.GOOGLE_SHEETS_CREDENTIALS;
  const spreadsheetId = '1U833WHIW1WMhdV-1QU2DbiCSwMCxvs69pCa6wvj5lOs';
  await appendToGoogleSheet(authData, spreadsheetId, 'Clients', [
    userId,
    data.alias,
    data.email,
    new Date().toISOString()
  ]);
  console.log('✅ Cliente guardado en Google Sheets');
} catch (error) {
  console.error('❌ Error al guardar en Google Sheets:', error);
}
  }

 
  if (interaction.isStringSelectMenu()) {
  if (!client.orderData) client.orderData = {};
  const order = client.orderData[interaction.user.id] || {};

  if (interaction.customId === 'select_delivery') {
    order.delivery = interaction.values[0];
    order.step = 'payment';
    client.orderData[interaction.user.id] = order;

    await interaction.reply({
      content: '💳 Please select a payment method:',
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_payment')
            .setPlaceholder('Choose payment method')
            .addOptions([
              { label: 'PayPal', value: 'PayPal' },
              { label: 'Crypto', value: 'Crypto' },
              { label: 'Wise', value: 'Wise' }
            ])
        )
      ]
    });
  }

  if (interaction.customId === 'select_payment') {
    order.payment = interaction.values[0];
    order.step = 'references';
    client.orderData[interaction.user.id] = order;

  await interaction.reply({
  content: '🖼️ Please describe your idea or send reference images. Once done, type `!confirm`.',
  ephemeral: false
});

  }
}






});

process.on('unhandledRejection', err => console.error('❌ Unhandled promise rejection:', err));
process.on('uncaughtException', err => console.error('❌ Uncaught exception:', err));

client.login(process.env.DISCORD_BOT_TOKEN);


const { google } = require('googleapis');

async function appendToGoogleSheet(authData, spreadsheetId, sheetName, values) {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(authData),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
}