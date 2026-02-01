// backend/controller/webhook.Controller.js
import axios from "axios";
import products from "../data/collageElements.js";
import Order from "../model/Order.js";

// ================= CONFIGURATION =================
const CONFIG = {
  MAX_PRODUCTS_TO_SHOW: 3,
  BASE_URL: process.env.BASE_URL || "http://localhost:3000",
  // Public images from Unsplash (WhatsApp can access these)
  CATEGORY_IMAGES: {
    "SPORTS": [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=400&auto=format&fit=crop"
    ],
    "CASUAL": [
      "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400&auto=format&fit=crop"
    ],
    "FORMAL": [
      "https://images.unsplash.com/photo-1595341888016-a392ef81b7de?w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1560769624-7d7a2a6b0d4c?w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&auto=format&fit=crop"
    ]
  }
};

// ================= USER SESSION =================
const userState = new Map();
const processedMessages = new Set();

// ================= WHATSAPP SERVICE =================
class WhatsAppService {
  static async sendMessage(to, payload) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000
        }
      );
      return response.data;
    } catch (error) {
      console.error('❌ WhatsApp API Error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }

  static async sendText(to, message) {
    return this.sendMessage(to, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { body: message }
    });
  }

  static async sendImage(to, imageUrl, caption = '') {
    let finalImageUrl = imageUrl;
    
    if (!imageUrl || !imageUrl.startsWith('https') || imageUrl.includes('localhost')) {
      console.warn('⚠️ Using fallback image for WhatsApp');
      finalImageUrl = "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&auto=format&fit=crop";
    }

    return this.sendMessage(to, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'image',
      image: {
        link: finalImageUrl,
        caption: caption.substring(0, 3000)
      }
    });
  }
static getSafeImage(product, index = 0) {
  // Agar product ke paas MULTIPLE images hain
  if (
    product.images &&
    Array.isArray(product.images) &&
    product.images.length > 1
  ) {
    return product.images[index % product.images.length];
  }

  // Agar product ke paas sirf 1 image hai
  //  category images se rotate karo
  const categoryImages = CONFIG.CATEGORY_IMAGES[product.type] || [];

  if (categoryImages.length > 0) {
    return categoryImages[index % categoryImages.length];
  }

  // 3️⃣ Final fallback
  return "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400";
}



  static async sendInteractiveButtons(to, message, buttons) {
    return this.sendMessage(to, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: message,
        },
        action: {
          buttons: buttons.map((btn, index) => ({
            type: "reply",
            reply: {
              id: `btn${index + 1}`,
              title: btn.title
            }
          }))
        }
      }
    });
  }

  static async sendProductCards(to, products, totalFound) {
    try {
      // Send introductory message
      await this.sendText(to,
        `🎉 *Found ${totalFound} matching shoes!*\n\n` +
        `Now showing ${products.length} best options:`
      );

      // Send each product as a card
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const productNumber = i + 1;
        const totalProducts = products.length;
        
        // Create card caption in your desired format
        const cardCaption = this.formatProductCard(product, productNumber, totalProducts);

        
        
        // Send image with card caption
        const imageUrl = WhatsAppService.getSafeImage(product, i);
await this.sendImage(to, imageUrl, cardCaption);

        
        // Add small delay between cards
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      
      // Send selection instructions
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await this.sendSelectionInstructions(to, products);
      
    } catch (error) {
      console.error('❌ Error sending product cards:', error);
      throw error;
    }
  }

static formatProductCard(product, current, total) {
  // Create rating stars
  const stars = '★'.repeat(Math.floor(product.rating));
  const halfStar = product.rating % 1 >= 0.5 ? '★' : '';
  const emptyStars = '☆'.repeat(5 - Math.ceil(product.rating));
  const ratingStars = stars + halfStar + emptyStars;
  
  // Format the card exactly as you want
  return `${current}/${total}: ${product.name}\n\n` +
         `💰 Price: $${product.price}\n` +
         `${product.discount > 0 ? `🎯 Discount: ${product.discount}% OFF\n` : ''}` +
         `📏 Sizes: ${product.sizes.join(', ')}\n` +
         `🎨 Colors: ${product.colors.slice(0, 3).join(', ')}${product.colors.length > 3 ? '...' : ''}\n` +
         `⭐ Rating: ${product.rating}/5 ${ratingStars}\n\n` +
         `🔧 Features: ${product.features.slice(0, 2).join(', ')}\n` +
         `🧵 Material: ${product.material}\n` +
         `🛡️ Warranty: ${product.warranty}\n` +
         `📦 Delivery: ${product.deliveryDays} days\n` +
         `${product.inStock ? '✅ In Stock' : '⏳ Low Stock'}\n\n` +
         `🆔 Product Code: ${product.productCode}\n\n` +
         `*Select this product: Reply with ${current}*`;
}
  static async sendSelectionInstructions(to, products) {
    let instructions = `*🎯 Select Your Product:*\n\n`;
    
    products.forEach((product, index) => {
      const number = index + 1;
      const emoji = number === 1 ? '1️⃣' : number === 2 ? '2️⃣' : '3️⃣';
      instructions += `${emoji} *${product.name}*\n`;
      instructions += `   💰 $${product.price}\n`;
      instructions += `   ⭐ ${product.rating}/5\n`;
      instructions += `   📏 ${product.sizes.join(', ')}\n`;
      instructions += `   🆔 ${product.productCode}\n\n`;
    });
    
    if (products.length === 1) {
      instructions += `*To select, reply with:* 1`;
    } else if (products.length === 2) {
      instructions += `*To select, reply with:* 1 or 2`;
    } else {
      instructions += `*To select, reply with:* 1, 2, or 3`;
    }
    
    return await this.sendText(to, instructions);
  }

  static async sendProductDetails(to, product, selectedSize) {
    // Create detailed product view
    const stars = '★'.repeat(Math.floor(product.rating));
    const halfStar = product.rating % 1 >= 0.5 ? '★' : '';
    const emptyStars = '☆'.repeat(5 - Math.ceil(product.rating));
    const ratingStars = stars + halfStar + emptyStars;
    
    const details = `👟 *${product.name}*\n\n` +
                   `${product.description}\n\n` +
                   `💰 Price: $${product.price}\n` +
                   `${product.discount > 0 ? `🎯 Discount: ${product.discount}% OFF\n` : ''}` +
                   `${product.originalPrice ? `📊 Original: $${product.originalPrice}\n` : ''}` +
                   `📏 Sizes: ${product.sizes.join(', ')}\n` +
                   `${selectedSize ? `✅ Your Size: ${selectedSize}\n` : ''}` +
                   `🎨 Colors: ${product.colors.join(', ')}\n` +
                   `⭐ Rating: ${product.rating}/5 ${ratingStars}\n\n` +
                   `🔧 Features:\n${product.features.map(f => `• ${f}`).join('\n')}\n\n` +
                   `🧵 Material: ${product.material}\n` +
                   `🛡️ Warranty: ${product.warranty}\n` +
                   `📦 Delivery: ${product.deliveryDays} days\n` +
                   `${product.inStock ? '✅ In Stock' : '⏳ Limited Stock'}\n\n` +
                   `🆔 Product Code: ${product.productCode}`;
    
    const imageUrl = WhatsAppService.getSafeImage(product, 0);
return await this.sendImage(to, imageUrl, details);

  }
}

// ================= PRODUCTS DATA ENHANCEMENT =================
const enhanceProducts = () => {
  const categoryColors = {
    "SPORTS": ["Blue", "Red", "Black", "White", "Gray"],
    "CASUAL": ["Brown", "Beige", "Black", "White", "Navy"],
    "FORMAL": ["Black", "Brown", "Oxblood", "Tan", "Charcoal"]
  };

  const categoryFeatures = {
    "SPORTS": ["Lightweight", "Breathable", "Shock Absorption", "Flexible"],
    "CASUAL": ["Comfortable", "Stylish", "Versatile", "Durable"],
    "FORMAL": ["Elegant", "Premium Leather", "Polished Finish", "Classic Design"]
  };

  const enhancedProducts = products.map((product, index) => {

   const fallbackImages = CONFIG.CATEGORY_IMAGES[product.type] || [];

const productImages =
  product.images &&
  Array.isArray(product.images) &&
  product.images.length > 0
    ? product.images
    : fallbackImages.length > 0
      ? [fallbackImages[index % fallbackImages.length]]
      : ["https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400"];


    let rating = 4.0;
    if (product.name.includes("Basic")) rating = 4.2;
    if (product.name.includes("Pro") || product.name.includes("Plus")) rating = 4.5;
    if (product.name.includes("Elite") || product.name.includes("Premium")) rating = 4.8;

    const discount = product.price > 50 ? 10 : (product.price > 30 ? 5 : 0);
    const originalPrice = discount > 0 ? (product.price / (1 - discount / 100)).toFixed(2) : null;

    return {
      ...product,
      images: productImages,
      colors: categoryColors[product.type] || ["Black", "Brown", "Blue"],
      rating,
      features: categoryFeatures[product.type] || ["Comfortable", "Durable", "Stylish"],
      discount,
      originalPrice,
      inStock: true,
      deliveryDays: product.type === "FORMAL" ? 5 : 3,
      material: product.type === "FORMAL" ? "Genuine Leather" : 
               product.type === "SPORTS" ? "Breathable Mesh" : "Synthetic Fabric",
      warranty: product.type === "FORMAL" ? "1 Year" : "6 Months",
      productCode: `SAR-${product.type.slice(0,3)}-${String(product.id).padStart(3,'0')}`
    };
  });

  console.log(`✅ Enhanced ${enhancedProducts.length} products`);
  return enhancedProducts;
};

const enhancedProducts = enhanceProducts();

// ================= WEBHOOK VERIFICATION =================
export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    return res.status(200).send(challenge);
  }
  console.log("❌ Webhook verification failed");
  return res.sendStatus(403);
};

// ================= MAIN MESSAGE HANDLER =================
export const receiveMessage = async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    const message = messages[0];
    const from = message.from;
    const userText = message.text?.body?.trim() || "";
    const messageId = message.id;

    console.log(`📨 Message from ${from}: "${userText}"`);

    // Duplicate message protection
    if (processedMessages.has(messageId)) {
      console.log(`🔄 Duplicate message ignored: ${messageId}`);
      return;
    }
    processedMessages.add(messageId);

    // Handle exit commands
    const endWords = ["END", "EXIT", "BYE", "CANCEL", "STOP"];
    if (endWords.includes(userText.toUpperCase())) {
      userState.delete(from);
      await WhatsAppService.sendText(
        from,
        "🛑 *Chat Ended Successfully*\n\n" +
        "Thank you for visiting *Sarwan Shoes Store* 👟\n\n" +
        "👉 To start again, type *start*"
      );
      return;
    }

    // Initialize or get user state
    if (!userState.has(from)) {
      userState.set(from, {
        step: "WELCOME",
        lastActivity: Date.now(),
        selectedProduct: null,
        selectedProducts: []
      });
    }

    const state = userState.get(from);
    state.lastActivity = Date.now();

    // Route to appropriate handler
    switch (state.step) {
      case "WELCOME":
        await handleWelcome(from, userText, state);
        break;
      case "LANG":
        await handleLanguage(from, userText, state);
        break;
      case "TYPE":
        await handleShoeType(from, userText, state);
        break;
      case "BUDGET":
        await handleBudget(from, userText, state);
        break;
      case "SIZE":
        await handleSizeAndShowProducts(from, userText, state);
        break;
      case "SELECT_PRODUCT":
        await handleProductSelection(from, userText, state);
        break;
      case "PURCHASE":
        await handlePurchase(from, userText, state);
        break;
      case "ORDER_CONFIRM":
        await handleOrderConfirmation(from, userText, state);
        break;
      default:
        userState.set(from, { step: "WELCOME", lastActivity: Date.now() });
        await WhatsAppService.sendText(from,
          "👋 Welcome to Sarwan Shoes Store! Type *start* to begin."
        );
    }

    userState.set(from, state);

  } catch (error) {
    console.error("❌ Webhook processing error:", error);
  }
};

// ================= HANDLER FUNCTIONS =================
async function handleWelcome(phone, text, state) {
  if (text.toLowerCase() === 'start') {
    state.step = "LANG";
    await WhatsAppService.sendText(phone,
      `🌍 *Choose Your Language:*\n\n` +
      `1️⃣ English\n` +
      `2️⃣ Arabic\n\n` +
      `Reply with *1* or *2*`
    );
  } else {
    await WhatsAppService.sendText(phone,
      "👋 *Welcome to Sarwan Shoes Store!*\n\n" +
      "Discover amazing shoes at great prices!\n\n" +
      "Type *start* to begin shopping!"
    );
  }
}

async function handleLanguage(phone, text, state) {
  if (text === '1') {
    state.step = "TYPE";
    state.language = "EN";
    await WhatsAppService.sendText(phone, "✅ English selected.");
    await WhatsAppService.sendText(phone,
      `📦 *Choose Shoe Category:*\n\n` +
      `1️⃣ Casual Shoes\n` +
      `2️⃣ Sports Shoes\n` +
      `3️⃣ Formal Shoes\n\n` +
      `Reply with *1*, *2*, or *3*`
    );
  } else if (text === '2') {
    state.step = "TYPE";
    state.language = "AR";
    await WhatsAppService.sendText(phone, "✅ العربية محددة.");
    await WhatsAppService.sendText(phone,
      `📦 *اختر فئة الحذاء:*\n\n` +
      `1️⃣ أحذية كاجوال\n` +
      `2️⃣ أحذية رياضية\n` +
      `3️⃣ أحذية رسمية\n\n` +
      `رد بـ *1*, *2*, أو *3*`
    );
  } else {
    await WhatsAppService.sendText(phone,
      "❌ Invalid option. Please choose:\n\n" +
      "1️⃣ English\n" +
      "2️⃣ Arabic\n\n" +
      "Reply with *1* or *2*"
    );
  }
}

async function handleShoeType(phone, text, state) {
  const typeMap = {
    '1': { type: 'CASUAL', name: 'Casual Shoes', emoji: '👟' },
    '2': { type: 'SPORTS', name: 'Sports Shoes', emoji: '🏃' },
    '3': { type: 'FORMAL', name: 'Formal Shoes', emoji: '👔' }
  };

  if (typeMap[text]) {
    state.step = "BUDGET";
    state.type = typeMap[text].type;
    state.typeName = typeMap[text].name;
    state.typeEmoji = typeMap[text].emoji;

    await WhatsAppService.sendText(phone,
      `${typeMap[text].emoji} *${typeMap[text].name} selected!*`
    );

    let budgetOptions, budgetRanges;
    if (state.type === 'CASUAL') {
      budgetOptions = "1️⃣ $20 - $40 (Basic)\n2️⃣ $40 - $70 (Premium)\n3️⃣ $70+ (Luxury)";
      budgetRanges = {
        '1': { min: 20, max: 40, label: 'Basic' },
        '2': { min: 40, max: 70, label: 'Premium' },
        '3': { min: 70, max: 100, label: 'Luxury' }
      };
    } else if (state.type === 'SPORTS') {
      budgetOptions = "1️⃣ $25 - $50 (Basic)\n2️⃣ $50 - $80 (Professional)\n3️⃣ $80+ (Elite)";
      budgetRanges = {
        '1': { min: 25, max: 50, label: 'Basic' },
        '2': { min: 50, max: 80, label: 'Professional' },
        '3': { min: 80, max: 100, label: 'Elite' }
      };
    } else {
      budgetOptions = "1️⃣ $35 - $60 (Basic)\n2️⃣ $60 - $85 (Premium)\n3️⃣ $85+ (Luxury)";
      budgetRanges = {
        '1': { min: 35, max: 60, label: 'Basic' },
        '2': { min: 60, max: 85, label: 'Premium' },
        '3': { min: 85, max: 100, label: 'Luxury' }
      };
    }

    state.budgetRanges = budgetRanges;
    await WhatsAppService.sendText(phone,
      `💰 *Select Your Budget Range:*\n\n` +
      `${budgetOptions}\n\n` +
      `Reply with *1*, *2*, or *3*`
    );
  } else {
    await WhatsAppService.sendText(phone,
      "❌ Invalid option. Please choose:\n\n" +
      "1️⃣ Casual Shoes\n" +
      "2️⃣ Sports Shoes\n" +
      "3️⃣ Formal Shoes\n\n" +
      "Reply with *1*, *2*, or *3*"
    );
  }
}

async function handleBudget(phone, text, state) {
  if (!state.budgetRanges || !state.budgetRanges[text]) {
    await WhatsAppService.sendText(phone,
      "❌ Invalid option. Please select a valid budget range."
    );
    return;
  }

  const budget = state.budgetRanges[text];
  state.step = "SIZE";
  state.min = budget.min;
  state.max = budget.max;
  state.budgetLabel = budget.label;

  await WhatsAppService.sendText(phone,
    `💰 *${budget.label} Range ($${budget.min}-$${budget.max}) selected!*`
  );

  await WhatsAppService.sendText(phone,
    `📏 *Select Your Shoe Size:*\n\n` +
    `1️⃣ All Available Sizes\n` +
    `2️⃣ Size 6\n` +
    `3️⃣ Size 7\n` +
    `4️⃣ Size 8\n` +
    `5️⃣ Size 9\n` +
    `6️⃣ Size 10\n\n` +
    `Reply with *1*, *2*, *3*, *4*, *5*, or *6*`
  );
}

async function handleSizeAndShowProducts(phone, text, state) {
  const validOptions = ['1', '2', '3', '4', '5', '6'];
  if (!validOptions.includes(text)) {
    await WhatsAppService.sendText(phone,
      "❌ Invalid option. Please choose a valid size."
    );
    return;
  }

  // Determine selected size
  let selectedSize = null;
  if (text !== '1') {
    const sizeMap = { '2': 6, '3': 7, '4': 8, '5': 9, '6': 10 };
    selectedSize = sizeMap[text];
  }
  state.selectedSize = selectedSize;

  // Filter products

let matchedProducts = enhancedProducts.filter(p => {
  if (p.type !== state.type) return false;
  if (p.price < state.min || p.price > state.max) return false;
  if (selectedSize && !p.sizes.includes(selectedSize)) return false;
  return true;
});

// 🔁 FALLBACK: agar 3 se kam mile
if (matchedProducts.length < CONFIG.MAX_PRODUCTS_TO_SHOW) {
  const extraProducts = enhancedProducts.filter(p => {
    if (p.type !== state.type) return false;
    if (matchedProducts.includes(p)) return false;
    return true;
  });

  matchedProducts = [
    ...matchedProducts,
    ...extraProducts.slice(
      0,
      CONFIG.MAX_PRODUCTS_TO_SHOW - matchedProducts.length
    )
  ];
}

const shownCount = Math.min(
  matchedProducts.length,
  CONFIG.MAX_PRODUCTS_TO_SHOW
);

await WhatsAppService.sendText(
  phone,
  `🎉 *Found ${shownCount} matching shoes!*\n\nNow showing ${shownCount} best options:`
);




  console.log(`🔍 Found ${matchedProducts.length} matching products for ${state.type}, size ${selectedSize || 'all'}, price $${state.min}-$${state.max}`);

  if (matchedProducts.length === 0) {
    await WhatsAppService.sendText(phone,
      `😔 *No Shoes Found*\n\n` +
      `No shoes match:\n` +
      `• ${state.typeEmoji} ${state.typeName}\n` +
      `• 💰 $${state.min} - $${state.max}\n` +
      `• 📏 Size: ${selectedSize ? 'Size ' + selectedSize : 'All'}\n\n` +
      `Try different options with *start*`
    );
    userState.delete(phone);
    return;
  }

  // Limit to 3 products for card display
  const productsToShow = matchedProducts.slice(0, CONFIG.MAX_PRODUCTS_TO_SHOW);
  state.selectedProducts = productsToShow;
  state.totalProductsFound = matchedProducts.length;
  state.step = "SELECT_PRODUCT";
  
  // Show products in card format
  try {
    // पहला message भेजें
    // await WhatsAppService.sendText(phone,
    //   `🎉 *Found ${matchedProducts.length} matching shoes!*\n\n` +
    //   `Now showing ${productsToShow.length} best options:`
    // );
    
    // Wait for a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Product cards send करें
 // ✅ SAFE images array (product images OR fallback)
// const imagesToSend =
//   products.images && products.images.length > 0
//     ? products.images
//     : [WhatsAppService.getSafeImage(products, 0)];

// Product cards send करें
// Product cards send करें
for (let i = 0; i < productsToShow.length; i++) {
  const product = productsToShow[i];

  const cardCaption = WhatsAppService.formatProductCard(
    product,
    i + 1,
    productsToShow.length
  );

  // ✅ ONLY ONE IMAGE PER PRODUCT
  const imageUrl = WhatsAppService.getSafeImage(product, 0);

  await WhatsAppService.sendImage(phone, imageUrl, cardCaption);

  // delay between products
  if (i < productsToShow.length - 1) {
    await new Promise(r => setTimeout(r, 1200));
  }
}




    
    // Wait before sending selection instructions
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send selection instructions
    await WhatsAppService.sendSelectionInstructions(phone, productsToShow);
    
  } catch (error) {
    console.error('❌ Error sending product cards:', error);
    // Fallback to simple text
    await WhatsAppService.sendText(phone,
      `🎉 Found ${matchedProducts.length} matching shoes!\n\n` +
      productsToShow.map((p, idx) => 
        `${idx+1}. ${p.name} - $${p.price} (${p.rating}⭐)`
      ).join('\n\n') +
      `\n\nReply with 1, 2, or 3 to select`
    );
  }
}

async function handleProductSelection(phone, text, state) {
  const cleanedText = text.trim();
  const index = parseInt(cleanedText) - 1;

  // Validate selection
  if (isNaN(index) || index < 0 || index >= state.selectedProducts.length) {
    // Show products again with selection instructions
    let errorMsg = `❌ *Invalid Selection*\n\n`;
    errorMsg += `Please select from available options:\n\n`;
    
    state.selectedProducts.forEach((product, idx) => {
      const number = idx + 1;
      const emoji = number === 1 ? '1️⃣' : number === 2 ? '2️⃣' : '3️⃣';
      errorMsg += `${emoji} *${product.name}*\n`;
      errorMsg += `   💰 $${product.price}\n`;
      errorMsg += `   ⭐ ${product.rating}/5\n`;
      errorMsg += `   📏 ${product.sizes.join(', ')}\n`;
      errorMsg += `   🆔 ${product.productCode}\n\n`;
    });
    
    if (state.selectedProducts.length === 1) {
      errorMsg += `*To select, reply with:* 1`;
    } else if (state.selectedProducts.length === 2) {
      errorMsg += `*To select, reply with:* 1 or 2`;
    } else {
      errorMsg += `*To select, reply with:* 1, 2, or 3`;
    }
    
    await WhatsAppService.sendText(phone, errorMsg);
    return;
  }

  // Valid selection
  const selectedProduct = state.selectedProducts[index];
  state.selectedProduct = selectedProduct;
  state.step = "PURCHASE";

  console.log(`✅ User selected: ${selectedProduct.name} ($${selectedProduct.price})`);

  // Show detailed product view
  await WhatsAppService.sendProductDetails(phone, selectedProduct, state.selectedSize);

  // Ask for purchase method
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await WhatsAppService.sendText(
    phone,
    `🛒 *Ready to Order ${selectedProduct.name}?*\n\n` +
    `Total: *$${selectedProduct.price}*\n\n` +
    `Choose delivery method:\n\n` +
    `1️⃣ *Store Pickup*\n` +
    `   📍 Collect from store\n` +
    `   🕐 Same day available\n\n` +
    `2️⃣ *Home Delivery*\n` +
    `   🚚 Delivered to address\n` +
    `   📦 ${selectedProduct.deliveryDays} business days\n\n` +
    `Reply with *1* or *2*`
  );
}

async function handlePurchase(phone, text, state) {
  if (text === '1') {
    state.purchaseMethod = "STORE_PICKUP";
    state.step = "ORDER_CONFIRM";
    
    await WhatsAppService.sendText(phone,
      `🏪 *Store Pickup Selected*\n\n` +
      `📍 *Sarwan Shoes Store*\n` +
      `123 Fashion Street, City Center\n` +
      `🕐 10AM - 9PM (Mon-Sat)\n\n` +
      `Please provide:\n` +
      `• Full Name\n` +
      `• Phone Number\n` +
      `• Preferred Pickup Date\n\n` +
      `*Format:*\n` +
      `Name: Your Name\n` +
      `Phone: 1234567890\n` +
      `Date: DD/MM/YYYY\n\n` +
      `*Example:*\n` +
      `Name: Ali Khan\n` +
      `Phone: 9876543210\n` +
      `Date: 25/12/2024`
    );
  } else if (text === '2') {
    state.purchaseMethod = "HOME_DELIVERY";
    state.step = "ORDER_CONFIRM";
    
    await WhatsAppService.sendText(phone,
      `🚚 *Home Delivery Selected*\n\n` +
      `📦 *Delivery Info:*\n` +
      `• Free delivery over $50\n` +
      `• $5 charge for orders below $50\n` +
      `• ${state.selectedProduct.deliveryDays} business days\n\n` +
      `Please provide:\n` +
      `• Full Name\n` +
      `• Delivery Address\n` +
      `• City & PIN Code\n` +
      `• Alternate Phone\n\n` +
      `*Format:*\n` +
      `Name: Your Name\n` +
      `Address: Complete Address\n` +
      `City: City Name, PIN\n` +
      `Phone: 1234567890`
    );
  } else {
    await WhatsAppService.sendText(phone,
      "❌ Please select:\n\n" +
      "1️⃣ Store Pickup\n" +
      "2️⃣ Home Delivery"
    );
  }
}

async function handleOrderConfirmation(phone, text, state) {
  // Parse customer details
  const details = {};
  const lines = text.split('\n');
  
  lines.forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      details[key] = value;
    }
  });

  // Validate required fields
  const requiredFields = state.purchaseMethod === "STORE_PICKUP"
    ? ['name', 'phone', 'date']
    : ['name', 'address', 'city', 'phone'];
  
  const missing = requiredFields.filter(field => !details[field]);
  
  if (missing.length > 0) {
    await WhatsAppService.sendText(phone,
      `❌ *Missing Information:*\n\n` +
      `Please provide: ${missing.join(', ')}\n\n` +
      `Send complete details in the requested format.`
    );
    return;
  }

  // Generate order ID
  const orderId = `SAR-${Date.now().toString(36).toUpperCase().substr(-6)}`;
  const now = new Date();

  // Calculate delivery fee
  const subtotal = state.selectedProduct.price;
  const deliveryFee = state.purchaseMethod === "HOME_DELIVERY" && subtotal < 50 ? 5 : 0;
  const total = subtotal + deliveryFee;

  // Prepare order data for database
const orderData = {
  orderId, 

  phone: phone,
  purchaseMethod: state.purchaseMethod,  

  customerDetails: {
    ...details
  },

selectedShoes: [
  {
    id: state.selectedProduct.id,
    name: state.selectedProduct.name,
    type: state.selectedProduct.type,
    price: state.selectedProduct.price,
    size: state.selectedSize || "Not specified",
    productCode: state.selectedProduct.productCode,
    imageUrl: WhatsAppService.getSafeImage(state.selectedProduct, 0),
  }
],


  pricing: {
    subtotal,
    deliveryFee,
    total
  },

  status: "pending"
};

console.log(
  "DEBUG selectedShoes →",
  typeof orderData.selectedShoes,
  Array.isArray(orderData.selectedShoes),
  orderData.selectedShoes
);


  try {
    // Save to MongoDB
    const order = new Order(orderData);
    await order.save();
    console.log(`✅ Order saved to MongoDB: ${orderId}`);

    // Send confirmation to user
    let confirmation = `✅ *ORDER CONFIRMED!*\n\n`;
    confirmation += `📋 *Order ID:* ${orderId}\n`;
    confirmation += `📅 *Date:* ${now.toLocaleDateString()}\n`;
    confirmation += `⏰ *Time:* ${now.toLocaleTimeString()}\n\n`;
    
    confirmation += `👤 *Customer Details:*\n`;
    Object.entries(details).forEach(([key, value]) => {
      confirmation += `• ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}\n`;
    });
    
    confirmation += `\n📦 *Order Summary:*\n`;
    confirmation += `• Product: ${state.selectedProduct.name}\n`;
    confirmation += `• Size: ${state.selectedSize || 'Select at store'}\n`;
    confirmation += `• Price: $${subtotal.toFixed(2)}\n`;
    if (deliveryFee > 0) confirmation += `• Delivery: $${deliveryFee.toFixed(2)}\n`;
    confirmation += `• *Total: $${total.toFixed(2)}*\n`;
    confirmation += `• Code: ${state.selectedProduct.productCode}\n\n`;
    
    if (state.purchaseMethod === "STORE_PICKUP") {
      confirmation += `🏪 *Pickup Instructions:*\n`;
      confirmation += `1. Visit store with Order ID\n`;
      confirmation += `2. Bring ID proof\n`;
      confirmation += `3. Pay at store\n`;
      confirmation += `4. Collect your order\n\n`;
      confirmation += `📍 *Store:* 123 Fashion Street\n`;
      confirmation += `📞 *Call:* +91-1234567890\n`;
    } else {
      confirmation += `🚚 *Delivery Info:*\n`;
      confirmation += `1. Processed within 24 hours\n`;
      confirmation += `2. Delivery: 3-5 business days\n`;
      confirmation += `3. Cash on Delivery\n`;
      confirmation += `4. Keep exact change ready\n\n`;
      confirmation += `📞 *Delivery Contact:* +91-9876543210\n`;
    }
    
    confirmation += `\n📧 *Confirmation sent to your phone*\n\n`;
    confirmation += `🙏 *Thank you for shopping with Sarwan Shoes!*\n`;
    confirmation += `Start new order: type *start*`;

    await WhatsAppService.sendText(phone, confirmation);

    // Clean up user state after delay
    setTimeout(() => {
      if (userState.has(phone)) {
        userState.delete(phone);
        console.log(`🧹 Cleared session for ${phone} after order`);
      }
    }, 30000);

  } catch (error) {
    console.error('❌ Error saving order:', error);
    await WhatsAppService.sendText(phone,
      "❌ *Order Processing Error*\n\n" +
      "There was an issue processing your order.\n" +
      "Please try again or contact support.\n\n" +
      "Type *start* to begin again."
    );
  }
}

// ================= SESSION CLEANUP =================
setInterval(() => {
  const now = Date.now();
  for (const [phone, state] of userState.entries()) {
    if (now - state.lastActivity > 30 * 60 * 1000) {
      userState.delete(phone);
      console.log(`🧹 Cleared inactive session for ${phone}`);
    }
  }
}, 5 * 60 * 1000);

// ================= ORDER MANAGEMENT =================
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// export const getOrderById = async (req, res) => {
//   try {
//     const order = await Order.findOne({ orderId: req.params.id });
//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         error: 'Order not found'
//       });
//     }
//     res.status(200).json({
//       success: true,
//       data: order
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// };