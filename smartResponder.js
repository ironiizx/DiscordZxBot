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

  if (text === '!contact') {
    contactedClients[userId] = true;
    return "📨 Your request has been forwarded. Please wait to be contacted by iRoniiZx.";
  }

  if (text === '!summary') {
    return buildSummary(userId) + personalNote();
  }

  if (text === '!modify') {
    return "✏️ Sure! You can now update any of your previous answers. Once you're done, type `!summary` again to confirm.";
  }

  if (["hola", "hello", "hi"].some(w => text.includes(w))) {
    return "👋 Hi! Would you like to **create an order** or just **ask a question**?\n\nTo create an order, type `!order`. If you have a question, just type it below.";
  }
  if (["gracias", "thanks", "thank you"].some(w => text.includes(w))) {
    return "🙏 You're welcome! Let me know if there's anything else I can help with." + personalNote();
  }
  if (["chau", "adios", "bye"].some(w => text.includes(w))) {
    return "👋 Bye! Feel free to message anytime if you need a new thumbnail." + personalNote();
  }

  const offTopic = [
    'trump', 'biden', 'argentina', 'president', 'guerra', 'politics', 'elon musk', 'cristiano', 'messi', 'kanye', 'taylor swift',
    'inflación', 'dolar', 'noticias', 'clima', 'quién ganó', 'mundial', 'película', 'serie', 'streaming',
    'israel', 'palestina', 'sionismo', 'hamas', 'terrorismo', 'judío', 'musulmán',
    'zionism', 'palestine', 'hamas', 'terrorism', 'jew', 'muslim'
  ];
  if (offTopic.some(word => text.includes(word))) {
    return "I'm just a bot that helps you with your Fortnite thumbnail order 😅 Let me know how I can assist with that!" + personalNote();
  }

  if (text.includes('price') || text.includes('cuánto cuesta') || text.includes('cost')) {
    return "💰 Pricing:\n\n**Normal Delivery**\n• $45–100 USD\n• Estimated time: 2 weeks base\n\n**Fast Delivery**\n• $90–150 USD\n• Completed within 48 to 72 hours (up to 96h in rare cases)" + personalNote();
  }

  if (text.includes('fast delivery') || text.includes('normal delivery') || text.includes('tiempo de entrega') || text.includes('cuánto tarda') || text.includes('entrega')) {
    return "⏱️ Normal delivery takes ~2 weeks. Fast delivery is within 48–72 hours. Delivery depends on queue and urgency." + personalNote();
  }

  if (text.includes('paypal') || text.includes('crypto') || text.includes('wise') || text.includes('pago') || text.includes('método de pago') || text.includes('métodos de pago') || text.includes('payment') || text.includes('payment method') || text.includes('pay')) {
    return "💳 I accept PayPal, Crypto and Wise. Let me know what works best for you." + personalNote();
  }

  if (text.includes('reembolso') || text.includes('refund')) {
    return "🔁 Once the work starts or is delivered, refunds aren't possible due to the time and creative effort invested." + personalNote();
  }

  if (text.includes('modificar') || text.includes('cambio') || text.includes('corregir') || text.includes('changes')) {
    return "✏️ After delivery, I can help with small adjustments or fixes. Full remakes based on new ideas aren’t included." + personalNote();
  }

  if (text.includes('idea') || text.includes('concept') || text.includes('mapa')) {
    return "🎨 Could you describe your idea or the vibe you're going for? That helps me understand how to visualize your thumbnail." + personalNote();
  }

  if (text.includes('referencia') || text.includes('image') || text.includes('te paso') || text.includes('adjunto') || text.includes('enviar imagen')) {
    return "📎 Great! Feel free to send any reference, screenshot, or example that reflects what you want in the thumbnail." + personalNote();
  }

  if (text.includes('plagio') || text.includes('uso') || text.includes('editar después') || text.includes('reusar')) {
    return "📄 PSDs are available for full custom thumbnails, but please don’t reuse elements for new thumbnails without permission." + personalNote();
  }

  if (text.includes('urgente') || text.includes('lo necesito hoy') || text.includes('express')) {
    return "⚡ I offer fast delivery (48–72h). Let me know if you'd like to go for that option!" + personalNote();
  }

  return "Thanks! Could you tell me more about your thumbnail idea or the style you're imagining?" + personalNote();
}

module.exports = fakeGPTResponse;