const userSessions = {};
const contactedClients = {};
const initiatedClients = {};
const waitingMessages = [
  "⏳ Hang tight! iRoniiZx will reply to you soon.",
  "🙌 Please wait a bit while iRoniiZx prepares your response.",
  "📩 Your message was received! Await a reply shortly.",
  "🤖 iRoniiZx has been notified. He'll get back to you soon.",
  "⌛ Thanks! Just a moment while iRoniiZx responds."
];

function extractOrderData(message) {
  const lower = message.toLowerCase();
  const data = {};
  if (lower.includes('zonewars') || lower.includes('map')) {
    const match = lower.match(/(title|map|zonewars)[^.,!\n]*/);
    if (match) data.title = match[0];
  }
  if (lower.includes('idea') || lower.includes('concept')) {
    const match = lower.match(/(no (idea|concept)|don’t have (idea|concept)|have.*?concept)[^.,!\n]*/);
    data.idea = match ? match[0] : '—';
  }
  if (lower.includes('normal delivery')) data.delivery = 'Normal Delivery';
  if (lower.includes('fast delivery')) data.delivery = 'Fast Delivery';
  if (lower.includes('paypal')) data.payment = 'PayPal';
  if (lower.includes('wise')) data.payment = 'Wise';
  if (lower.includes('crypto')) data.payment = 'Crypto';
  return data;
}

function updateSession(userId, newData) {
  if (!userSessions[userId]) userSessions[userId] = {};
  Object.assign(userSessions[userId], newData);
}

function buildSummary(userId) {
  const data = userSessions[userId] || {};
  return `📋 **Order Summary for ${userId}**\n\n🗺️ Title: ${data.title || '—'}\n🎯 Idea: ${data.idea || '—'}\n📎 References: ${data.references || '—'}\n🚚 Delivery: ${data.delivery || '—'}\n💳 Payment: ${data.payment || '—'}`;
}

function personalNote() {
  return "\n\n🔔 To speak directly with **iRoniiZx**, type `!contact`.";
}

function fakeGPTResponse(message, userId) {
  const text = message.toLowerCase();
  const updates = extractOrderData(text);
  updateSession(userId, updates);

  if (!initiatedClients[userId]) {
    initiatedClients[userId] = true;
    return "👋 Hi! Would you like to **create an order** or just **ask a question**?\n\nTo create an order, type `!order`. If you have a question, just type it below.";
  }

  if (contactedClients[userId]) {
    return waitingMessages[Math.floor(Math.random() * waitingMessages.length)];
  }

  // Basic Commands
  if (text === '!contact') {
    contactedClients[userId] = true;
    return "📨 Your request has been forwarded. Please wait to be contacted by iRoniiZx.";
  }

  if (text === '!summary') return buildSummary(userId) + personalNote();
  if (text === '!modify') return "✏️ You can now update any of your previous answers. Once you're done, type `!summary` again to confirm.";
  if (text === '!tips') return "📌 Tip: Try to share a clear idea, references or colors that define your vibe! The more info, the better result." + personalNote();
  if (text === '!process') return "🛠️ Process: You send details > I design the thumbnail > You get preview > Final delivery > Minor adjustments if needed." + personalNote();
  if (text === '!portfolio') return "🎨 You can see my past works here: https://www.behance.net/iRoniiZx" + personalNote();
  if (text === '!commands') return "📖 Available commands:\n!order – Start an order\n!summary – See your order summary\n!modify – Modify your order\n!tips – Get useful tips\n!process – See how it works\n!portfolio – Check my work\n!contact – Ask for direct support" + personalNote();

  // Greetings and casual
  if (["hola", "hello", "hi", "hey"].some(w => text.includes(w))) {
    return "👋 Hi! Would you like to **create an order** or just **ask a question**?\n\nTo create an order, type `!order`. If you have a question, just type it below.";
  }
  if (["thanks", "thank you", "gracias"].some(w => text.includes(w))) {
    return "🙏 You're welcome! Let me know if there's anything else I can help with." + personalNote();
  }
  if (["bye", "goodbye", "see ya", "chau"].some(w => text.includes(w))) {
    return "👋 Bye! Feel free to message anytime if you need a new thumbnail." + personalNote();
  }

  // Off-topic filtering
  const offTopic = [
    'trump', 'biden', 'argentina', 'president', 'politics', 'news', 'elon', 'messi', 'kanye',
    'israel', 'palestine', 'hamas', 'terrorism', 'war', 'climate', 'movie', 'series', 'celebrity'
  ];
  if (offTopic.some(w => text.includes(w))) {
    return "I'm just a bot that helps with Fortnite thumbnails 😊 Let me know how I can assist with your order!" + personalNote();
  }

  // Pricing & Payment
  if (text.match(/(price|cost|how much|cuánto|rate|fee)/)) {
    return "💰 Pricing:\n\n**Normal Delivery**: $45–100 USD (2 weeks)\n**Fast Delivery**: $90–150 USD (48–72h)\n*Prices vary depending on complexity.*" + personalNote();
  }

  if (text.match(/(payment|how to pay|paypal|wise|crypto|method|transfer)/)) {
    return "💳 I accept PayPal, Crypto, and Wise. Let me know your preference so I can send the correct details." + personalNote();
  }

  // Delivery
  if (text.match(/(delivery|fast delivery|normal delivery|how long|wait time|entrega|cuánto tarda)/)) {
    return "🚚 Normal delivery takes ~2 weeks. Fast delivery is within 48–72 hours depending on queue." + personalNote();
  }

  // Refund
  if (text.match(/(refund|reembolso|return money|cancel order)/)) {
    return "🔁 I don’t offer refunds once the work has started or been delivered, due to the creative effort involved." + personalNote();
  }

  // Modifications
  if (text.match(/(modify|change|adjustment|fix|correction|edit|update info)/)) {
    return "✏️ After delivery, I'm open to minor adjustments. Full remakes based on new ideas aren’t included." + personalNote();
  }

  // Ideas & Concepts
  if (text.match(/(idea|concept|theme|vibe|what should i do)/)) {
    return "🎯 Feel free to share your idea, theme, or any concept that represents your map or goal!" + personalNote();
  }

  // References
  if (text.match(/(reference|image|send screenshot|attach|example|drawing|photo)/)) {
    return "📎 You can send references, examples, drawings, or screenshots to better explain your idea." + personalNote();
  }

  // Usage, PSDs
  if (text.match(/(reuse|psd|plagiarism|use again|template|edit later)/)) {
    return "📄 PSD files are available for fully custom thumbnails. Please don’t reuse parts for new versions without agreement." + personalNote();
  }

  // Urgency
  if (text.match(/(urgent|asap|today|express|hurry|rush)/)) {
    return "⚡ I offer fast delivery (48–72h). Let me know if you want to proceed with that option!" + personalNote();
  }

  // Multi-thumbnails or packs
  if (text.match(/(multiple|pack|bundle|more than one|group of thumbnails|several maps)/)) {
    return "🧩 I can create packs of thumbnails for multiple maps. Let me know how many you need and I’ll send options!" + personalNote();
  }

  // File formats
  if (text.match(/(format|file type|resolution|dimensions|jpg|png|1080|1920)/)) {
    return "🖼️ Thumbnails are usually delivered in 1920x1080 PNG. Let me know if you need other formats." + personalNote();
  }

  return "🧠 Let me know more about your thumbnail idea or ask anything about the process!" + personalNote();
}

module.exports = fakeGPTResponse;
