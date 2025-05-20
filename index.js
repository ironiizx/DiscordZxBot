require('dotenv').config();

if (!global.fetch) global.fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionsBitField
} = require('discord.js');
const fakeGPTResponse = require('./smartResponder');

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

const completedOrders = new Set();
const ORDER_CHANNEL_ID = process.env.ORDER_CHANNEL_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const GUILD_ID = process.env.GUILD_ID;

const userTicketMap = new Map();

client.once(Events.ClientReady, async () => {
  console.log(`🤖 Bot is online as ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  const members = await guild.members.fetch();
  const channels = await guild.channels.fetch();

  for (const [memberId, member] of members) {
    if (member.user.bot) continue;

    const existingChannel = channels.find(
      ch =>
        ch.type === ChannelType.GuildText &&
        ch.parentId === TICKET_CATEGORY_ID &&
        ch.name === `order-from-${member.user.username.toLowerCase()}`
    );

    if (!existingChannel) {
      const channel = await guild.channels.create({
        name: `order-from-${member.user.username}`,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
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

      userTicketMap.set(member.id, channel.id);

      await channel.send(`👋 Welcome <@${member.id}>! You can start your order or consultation here. Use \`!order\` to begin.`);
    }
  }
});

client.on(Events.GuildMemberAdd, async member => {
  const guild = member.guild;

  const channel = await guild.channels.create({
    name: `order-from-${member.user.username}`,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: guild.roles.everyone,
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

  userTicketMap.set(member.id, channel.id);
  await channel.send(`👋 Welcome <@${member.id}>! You can start your order or consultation here. Use \`!order\` to begin.`);
});

client.on(Events.GuildMemberRemove, async member => {
  const channelId = userTicketMap.get(member.id);
  if (!channelId) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel) {
    await channel.delete().catch(console.error);
    console.log(`🗑️ Deleted ticket for user ${member.user.username}`);
  }

  userTicketMap.delete(member.id);
});

client.on(Events.InteractionCreate, async interaction => {
  const userId = interaction.user.id;

  if (interaction.isStringSelectMenu()) {
    const order = interaction.client.orderData || {};

    if (interaction.customId === 'select_delivery') {
      order.delivery = interaction.values[0];
      order.step = 'payment';
      interaction.client.orderData = order;

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
      return;
    }

    if (interaction.customId === 'select_payment') {
      order.payment = interaction.values[0];
      order.step = 'references';
      interaction.client.orderData = order;
      await interaction.reply('🖼️ Please describe your idea or send reference images. Once done, type `!confirm` to finalize your order.');
      return;
    }
  }
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const text = message.content.toLowerCase();

  if (text === '!order') {
    client.orderData = { step: 'delivery' };
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

  if (text === '!confirm') {
    const order = client.orderData;
    if (!order || !order.delivery || !order.payment || !order.references) {
      await message.channel.send('❌ You need to complete all steps before confirming.');
      return;
    }
    const summary = `✅ Thanks for your order! Here's the summary:

📦 **Order Summary:**
🚚 **Delivery:** ${order.delivery.replace('_', ' ')}
💳 **Payment:** ${order.payment}
🖼️ **References/Idea:** ${order.references}

Please wait for **iRoniiZx** to respond. To modify your order, type \`!modify\`.

🛠️ Your order will begin once payment is confirmed and details are approved by iRoniiZx.`;

    await message.channel.send(summary);

    const orderChannel = await client.channels.fetch(ORDER_CHANNEL_ID).catch(console.error);
    if (orderChannel && orderChannel.isTextBased()) {
      await orderChannel.send({
        content: `🆕 **New Order from <@${userId}>**

📦 **Order Summary:**
🚚 **Delivery:** ${order.delivery.replace('_', ' ')}
💳 **Payment:** ${order.payment}
🖼️ **References/Idea:** ${order.references}`
      });
    }

    completedOrders.add(userId);
    client.orderData = null;
    return;
  }

  if (text === '!modify') {
    client.orderData = { step: 'delivery' };
    completedOrders.delete(userId);
    await message.channel.send('🔄 Starting modification. Please select the delivery type again:');
    await message.channel.send({
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

1. You provide:
   • Map title
   • Concept or idea
   • References or examples

2. I start working on your thumbnail

3. You receive the design for review

4. Small adjustments allowed (no full redesigns)

5. Order completes after confirmation`);
    return;
  }

  if (text === '!tips') {
    await message.channel.send(`💡 **Tips for a Great Thumbnail**

• Provide strong visual references
• Be clear about the vibe or story
• Avoid overcrowding the layout
• Colors matter – vibrant sells more
• Simplicity = clarity`);
    return;
  }

  if (text === '!portfolio') {
    await message.channel.send(`🖼️ Check out my portfolio here:\nhttps://www.behance.net/iRoniiZx`);
    return;
  }

  const order = client.orderData;
  if (order && order.step === 'references') {
    if (!order.references) order.references = '';
    order.references += `\n${message.content}`;
    client.orderData = order;
    return;
  }

  if (completedOrders.has(userId)) {
    const essentials = ['price', 'time', 'delivery', 'payment', 'cost', 'method', 'how much', 'pay'];
    const isEssential = essentials.some(word => text.includes(word));
    if (!isEssential && text !== '!modify') {
      await message.channel.send('⏳ Please wait for **iRoniiZx** to respond.');
      return;
    }
  }

  const reply = fakeGPTResponse(text, userId);
  if (reply) message.channel.send(reply);
});

client.login(process.env.DISCORD_BOT_TOKEN);
