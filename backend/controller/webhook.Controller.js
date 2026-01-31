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
    // Always use public URLs for WhatsApp
    let finalImageUrl = imageUrl;

    // If image is localhost or not valid, use Unsplash
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

  static async sendInteractiveButtons(to, message, buttons) {
    return this.sendMessage(to, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: message
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
}

// ================= PRODUCTS DATA ENHANCEMENT =================
const enhanceProducts = () => {
  // Define colors for each category
  const categoryColors = {
    "SPORTS": ["Blue", "Red", "Black", "White", "Gray"],
    "CASUAL": ["Brown", "Beige", "Black", "White", "Navy"],
    "FORMAL": ["Black", "Brown", "Oxblood", "Tan", "Charcoal"]
  };

  // Define features for each category
  const categoryFeatures = {
    "SPORTS": ["Lightweight", "Breathable", "Shock Absorption", "Flexible"],
    "CASUAL": ["Comfortable", "Stylish", "Versatile", "Durable"],
    "FORMAL": ["Elegant", "Premium Leather", "Polished Finish", "Classic Design"]
  };

  const enhancedProducts = products.map(product => {
    const category = product.type;
    
    // ✅ FIX 1: Ensure images array exists
    let imagesArray = [];
    
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      // Use product's own images if available
      imagesArray = product.images.slice(0, 3);
    } else if (CONFIG.CATEGORY_IMAGES[category]) {
      // Use category images
      imagesArray = CONFIG.CATEGORY_IMAGES[category].slice(0, 3);
    } else {
      // Fallback
      imagesArray = [
        "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&auto=format&fit=crop"
      ];
    }

    // ✅ FIX 2: Ensure we have exactly 3 images
    while (imagesArray.length < 3) {
      imagesArray.push(imagesArray[0] || "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&auto=format&fit=crop");
    }

    // Generate rating
    let rating = 4.0;
    if (product.name.includes("Basic")) rating = 4.2;
    if (product.name.includes("Pro")) rating = 4.5;
    if (product.name.includes("Elite") || product.name.includes("Premium")) rating = 4.8;

    // Add features
    const features = categoryFeatures[category] || ["Comfortable", "Durable", "Stylish"];

    // Calculate discount
    const discount = product.price > 50 ? 10 : (product.price > 30 ? 5 : 0);
    const originalPrice = discount > 0 ? (product.price / (1 - discount / 100)).toFixed(2) : null;
    
    return {
      ...product,
      images: imagesArray, // ✅ FIXED: Always 3 images
      colors: categoryColors[category] || ["Black", "White", "Gray"],
      rating,
      features,
      discount,
      originalPrice,
      inStock: true,
      deliveryDays: category === "FORMAL" ? 5 : 3,
      material:
        category === "FORMAL"
          ? "Genuine Leather"
          : category === "SPORTS"
            ? "Breathable Mesh"
            : "Synthetic Fabric",
      warranty: category === "FORMAL" ? "1 Year" : "6 Months"
    };
  });

  console.log(`✅ Enhanced ${enhancedProducts.length} products`);
  
  // ✅ FIX 3: Log each product details
  enhancedProducts.forEach(p => {
    console.log(`📦 ${p.name}: ${p.type} | $${p.price} | Sizes: ${p.sizes} | Images: ${p.images.length}`);
  });

  return enhancedProducts;
};

const enhancedProducts = enhanceProducts();
// ✅ GUARANTEE minimum 3 products per category for production
const addMissingProducts = () => {
  const productsByCategory = {
    SPORTS: enhancedProducts.filter(p => p.type === "SPORTS"),
    CASUAL: enhancedProducts.filter(p => p.type === "CASUAL"),
    FORMAL: enhancedProducts.filter(p => p.type === "FORMAL")
  };

  Object.keys(productsByCategory).forEach(category => {
    if (productsByCategory[category].length < 3) {
      const needed = 3 - productsByCategory[category].length;
      console.log(`🔄 Adding ${needed} products for ${category} category`);
      
      for (let i = 1; i <= needed; i++) {
        const baseId = enhancedProducts.length + i;
        const dummyProduct = {
          id: baseId,
          name: `${category.charAt(0) + category.slice(1).toLowerCase()} Premium ${i}`,
          type: category,
          price: category === "FORMAL" ? 60 + (i * 10) : 
                 category === "SPORTS" ? 50 + (i * 10) : 
                 40 + (i * 5),
          description: `High-quality ${category.toLowerCase()} shoes for everyday comfort`,
          sizes: [6, 7, 8, 9, 10],
          images: CONFIG.CATEGORY_IMAGES[category] || CONFIG.CATEGORY_IMAGES.CASUAL,
          isDummy: true // Mark as dummy for debugging
        };
        
        // Enhance this dummy product
        const enhancedDummy = {
          ...dummyProduct,
          colors: categoryColors[category] || ["Black", "White"],
          rating: 4.0 + (i * 0.1),
          features: categoryFeatures[category] || ["Comfortable", "Durable"],
          discount: i === 1 ? 10 : 5,
          originalPrice: (dummyProduct.price * 1.1).toFixed(2),
          inStock: true,
          deliveryDays: category === "FORMAL" ? 5 : 3,
          material: category === "FORMAL" ? "Genuine Leather" : 
                   category === "SPORTS" ? "Breathable Mesh" : "Synthetic Fabric",
          warranty: category === "FORMAL" ? "1 Year" : "6 Months"
        };
        
        enhancedProducts.push(enhancedDummy);
      }
    }
  });
  
  console.log(`📊 Final product counts:`);
  console.log(`• SPORTS: ${enhancedProducts.filter(p => p.type === "SPORTS").length}`);
  console.log(`• CASUAL: ${enhancedProducts.filter(p => p.type === "CASUAL").length}`);
  console.log(`• FORMAL: ${enhancedProducts.filter(p => p.type === "FORMAL").length}`);
  
  return enhancedProducts;
};

const finalProducts = addMissingProducts();

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
  // Immediate response to WhatsApp
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return;
    }

    const message = messages[0];
    const from = message.from;
    const userText = message.text?.body?.trim() || "";
    const messageId = message.id;

    // Duplicate message protection
    if (processedMessages.has(messageId)) {
      console.log(`🔄 Duplicate message ignored: ${messageId}`);
      return;
    }
    processedMessages.add(messageId);


    const endWords = ["END", "EXIT", "BYE", "CANCEL"];

    if (endWords.includes(userText.toUpperCase())) {
      userState.delete(from);

      await WhatsAppService.sendText(
        from,
        "🛑 *Chat Ended Successfully*\n\n" +
        "Thank you for visiting *Sarwan Shoes Store* 👟\n\n" +
        "👉 To start again, type *start*"
      );

      return; // ⛔ stop further execution
    }


    // Initialize user state
    if (!userState.has(from)) {
      userState.set(from, {
        step: "WELCOME",
        lastActivity: Date.now()
      });
    }

    const state = userState.get(from);
    state.lastActivity = Date.now();


    if (state.step === "WELCOME" && userText.toLowerCase() !== "start") {
      return;
    }
    // ================= HANDLE MESSAGES =================
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
      case "SELECT_PRODUCT": // 👈 YAHIN
        await handleProductSelection(from, userText, state);
        break;
      case "PURCHASE":
        await handlePurchase(from, userText, state);
        break;
      case "ORDER_CONFIRM":
        await handleOrderConfirmation(from, userText, state);
        break;
      default:
        userState.set(from, {
          step: "WELCOME",
          lastActivity: Date.now()
        });
        await WhatsAppService.sendText(from,
          "👋 Welcome to Sarwan Shoes Store! Type *start* to begin."
        );
    }

    // Update state
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
    // await WhatsAppService.sendText(phone,
    //   "👋 *Welcome to Sarwan Shoes Store!*\n\n" +
    //   "Discover amazing shoes at great prices!\n\n" +
    //   "Type *start* to begin shopping!"
    // );
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

    // Show appropriate budget ranges
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
    } else { // FORMAL
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

  // Filter products
  let matchedProducts = [];

  if (text === '1') {
    // All sizes
    matchedProducts = enhancedProducts.filter(p =>
      p.type === state.type &&
      p.price >= state.min &&
      p.price <= state.max
    );
  } else {
    const sizeMap = { '2': 6, '3': 7, '4': 8, '5': 9, '6': 10 };
    const selectedSize = sizeMap[text];
    state.selectedSize = selectedSize;

    matchedProducts = enhancedProducts.filter(p =>
      p.type === state.type &&
      p.price >= state.min &&
      p.price <= state.max &&
      p.sizes.includes(selectedSize)
    );
  }

  console.log(`🔍 DEBUG: Found ${matchedProducts.length} products for:`);
  console.log(`• Type: ${state.type}`);
  console.log(`• Min Price: ${state.min}`);
  console.log(`• Max Price: ${state.max}`);
  console.log(`• Size: ${state.selectedSize || 'All'}`);
  console.log(`Products:`, matchedProducts.map(p => p.name));

  if (matchedProducts.length === 0) {
    await WhatsAppService.sendText(phone,
      `😔 *No Shoes Found*\n\n` +
      `No shoes match:\n` +
      `• ${state.typeEmoji} ${state.typeName}\n` +
      `• 💰 $${state.min} - $${state.max}\n` +
      `• 📏 Size: ${text === '1' ? 'All' : state.selectedSize}\n\n` +
      `Try different options with *start*`
    );

    userState.delete(phone);
    return;
  }

  // ✅ FIX: ALWAYS SHOW 3 PRODUCTS (or less if not available)
  const maxToShow = Math.min(CONFIG.MAX_PRODUCTS_TO_SHOW, matchedProducts.length);
  state.selectedShoes = matchedProducts.slice(0, maxToShow);
  state.totalProductsFound = matchedProducts.length;

  console.log(`✅ DEBUG: Showing ${state.selectedShoes.length} products:`);
  state.selectedShoes.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} - $${p.price}`);
  });

  // Send product list
  let productsList = `🎉 *Found ${matchedProducts.length} matching shoes!*\n\n`;
  productsList += `👟 *Available Options:*\n\n`;
  
  for (const [index, product] of state.selectedShoes.entries()) {
    productsList += `${index + 1}️⃣ *${product.name}*\n`;
    productsList += `   💰 Price: $${product.price}\n`;
    productsList += `   ⭐ Rating: ${product.rating}/5\n`;
    productsList += `   📏 Sizes: ${product.sizes.join(', ')}\n`;
    
    if (product.discount > 0) {
      productsList += `   🎯 Discount: ${product.discount}% OFF\n`;
    }
    
    productsList += `   🆔 Code: SAR-${product.type.slice(0, 3)}-${String(product.id).padStart(3, '0')}\n\n`;
  }

  productsList += `*Select a shoe to view details:*\n`;
  productsList += `Reply with *1*, *2*, or *3*`;

  await WhatsAppService.sendText(phone, productsList);

  // Move to product selection step
  state.step = "SELECT_PRODUCT";
  
  // Save state immediately
  userState.set(phone, state);
}

// async function handleProductSelection(phone, text, state) {
//   const index = parseInt(text) - 1;

//   if (isNaN(index) || index < 0 || index >= state.selectedShoes.length) {
//     await WhatsAppService.sendText(phone, "❌ Please select a valid option.");
//     return;
//   }

//   const product = state.selectedShoes[index];
//   state.chosenProduct = product;

//   const productMessage = `
// 👟 *${product.name}*

// ${product.description}

// 💰 *Price:* $${product.price}
// 📏 *Sizes:* ${product.sizes.join(', ')}
// 🎨 *Colors:* ${product.colors.join(', ')}
// ⭐ *Rating:* ${product.rating}/5

// 🧵 *Material:* ${product.material}
// 🛡️ *Warranty:* ${product.warranty}
// 📦 *Delivery:* ${product.deliveryDays} days
// ${product.inStock ? '✅ In Stock' : '⏳ Limited Stock'}

// 🆔 *Product Code:* SAR-${product.type.slice(0,3)}-${String(product.id).padStart(3,'0')}
// `;

//   // ✅ send ALL images of SELECTED product
//   for (let i = 0; i < product.images.length; i++) {
//     await WhatsAppService.sendImage(
//       phone,
//       product.images[i],
//       i === 0 ? productMessage.trim() : ""
//     );

//     await new Promise(res => setTimeout(res, 800));
//   }

//   // next step
//   state.step = "PURCHASE";

//   await WhatsAppService.sendText(
//     phone,
//     `🛒 *Ready to Order?*\n\n` +
//     `You selected: *${product.name}*\n\n` +
//     `1️⃣ Store Pickup\n` +
//     `2️⃣ Home Delivery\n\n` +
//     `Reply with *1* or *2*`
//   );
// }

async function handleProductSelection(phone, text, state) {
  console.log(`🔍 DEBUG: User selected: ${text}`);
  console.log(`🔍 DEBUG: Available products: ${state.selectedShoes?.length || 0}`);
  
  if (state.selectedShoes) {
    state.selectedShoes.forEach((p, i) => {
      console.log(`Product ${i + 1}: ${p.name}`);
    });
  }

  const index = parseInt(text) - 1;

  if (isNaN(index) || index < 0 || !state.selectedShoes || index >= state.selectedShoes.length) {
    console.log(`❌ DEBUG: Invalid selection. Index: ${index}, Available: ${state.selectedShoes?.length || 0}`);
    
    // Send available options again
    if (state.selectedShoes && state.selectedShoes.length > 0) {
      let optionsText = `❌ Please select a valid option:\n\n`;
      state.selectedShoes.forEach((p, i) => {
        optionsText += `${i + 1}️⃣ ${p.name} — $${p.price}\n`;
      });
      optionsText += `\nReply with *1*${state.selectedShoes.length > 1 ? `, *2*` : ''}${state.selectedShoes.length > 2 ? `, or *3*` : ''}`;
      
      await WhatsAppService.sendText(phone, optionsText);
    } else {
      await WhatsAppService.sendText(phone, "❌ No products available. Please start again with *start*");
      userState.delete(phone);
    }
    return;
  }

  const product = state.selectedShoes[index];
  state.chosenProduct = product;

  console.log(`✅ DEBUG: Selected product: ${product.name}`);

  // Detailed product info
  const productMessage = `
👟 *${product.name}*

${product.description}

💰 *Price:* $${product.price}${product.discount > 0 ? ` (${product.discount}% OFF)` : ''}
${product.originalPrice ? `🎯 *Original Price:* $${product.originalPrice}\n` : ''}
📏 *Available Sizes:* ${product.sizes.join(', ')}
🎨 *Colors Available:* ${product.colors.join(', ')}
⭐ *Rating:* ${product.rating}/5 ⭐⭐⭐⭐⭐
📊 *${product.rating >= 4.5 ? 'BESTSELLER' : 'POPULAR CHOICE'}*

🔧 *Key Features:*
${product.features.map(f => `• ${f}`).join('\n')}

🧵 *Material:* ${product.material}
🛡️ *Warranty:* ${product.warranty}
📦 *Delivery Time:* ${product.deliveryDays} business days
${product.inStock ? '✅ *In Stock - Ready to Ship*' : '⏳ *Limited Stock Available*'}

🆔 *Product Code:* SAR-${product.type.slice(0,3)}-${String(product.id).padStart(3,'0')}
`;

  // Send image with details
  await WhatsAppService.sendImage(
    phone,
    product.images[0],
    productMessage.trim()
  );

  // Ask for purchase method
  state.step = "PURCHASE";

  await new Promise(res => setTimeout(res, 1000));

  await WhatsAppService.sendText(
    phone,
    `🛒 *Ready to Order ${product.name}?*\n\n` +
    `Total Price: *$${product.price}*\n\n` +
    `Choose your delivery method:\n\n` +
    `1️⃣ *Store Pickup*\n` +
    `   📍 Collect from our store\n` +
    `   🕐 Same day pickup available\n\n` +
    `2️⃣ *Home Delivery*\n` +
    `   🚚 Delivered to your address\n` +
    `   📦 ${product.deliveryDays} business days\n\n` +
    `Reply with *1* or *2*`
  );
  
  // Save state
  userState.set(phone, state);
}


async function handlePurchase(phone, text, state) {
  const response = text.toLowerCase();

  if (response.includes('pickup') || response === 'btn1' || text === '1') {
    state.purchaseMethod = "STORE_PICKUP";
    state.step = "ORDER_CONFIRM";

    await WhatsAppService.sendText(phone,
      `🏪 *Store Pickup Selected*\n\n` +
      `📍 *Store Location:*\n` +

      `Sarwan Shoes Store\n` +
      `123 Fashion Street, City Center\n` +
      `🕐 Open: 10AM - 9PM (Mon-Sat)\n\n` +
      `Please provide:\n` +
      `1️⃣ Full Name\n` +
      `2️⃣ Phone Number\n` +
      `3️⃣ Preferred Pickup Date\n\n` +
      `*Format:*\n` +
      `Name: Your Name\n` +
      `Phone: 1234567890\n` +
      `Date: DD/MM/YYYY\n\n` +
      `*Example:*\n` +
      `Name: Ali Khan\n` +
      `Phone: 9876543210\n` +
      `Date: 25/12/2024`
    );
  } else if (response.includes('delivery') || response.includes('home') || response === 'btn2' || text === '2') {
    state.purchaseMethod = "HOME_DELIVERY";
    state.step = "ORDER_CONFIRM";

    await WhatsAppService.sendText(phone,
      `🚚 *Home Delivery Selected*\n\n` +
      `📦 *Delivery Info:*\n` +
      `• Free delivery over $50\n` +
      `• $5 charge for orders below $50\n` +
      `• 3-5 business days\n\n` +
      `Please provide:\n` +
      `1️⃣ Full Name\n` +
      `2️⃣ Delivery Address\n` +
      `3️⃣ City & PIN Code\n` +
      `4️⃣ Alternate Phone\n\n` +
      `*Format:*\n` +
      `Name: Your Name\n` +
      `Address: Complete Address\n` +
      `City: City Name, PIN\n` +
      `Phone: 1234567890\n\n` +
      `*Example:*\n` +
      `Name: Ali Khan\n` +
      `Address: 123 Main St, Apt 4B\n` +
      `City: Mumbai, 400001\n` +
      `Phone: 9876543210`
    );
  } else {
    await WhatsAppService.sendText(phone,
      "❌ Please select an option:\n\n" +
      "1️⃣ Store Pickup\n" +
      "2️⃣ Home Delivery"
    );
  }
}

async function handleOrderConfirmation(phone, text, state) {
  // Parse details
  const details = {};
  text.split('\n').forEach(line => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim().toLowerCase();
      const value = parts.slice(1).join(':').trim();
      details[key] = value;
    }
  });

  // Validate
  const required = state.purchaseMethod === "STORE_PICKUP"
    ? ['name', 'phone', 'date']
    : ['name', 'address', 'city', 'phone'];

  const missing = required.filter(f => !details[f]);

  if (missing.length > 0) {
    await WhatsAppService.sendText(phone,
      `❌ *Missing:* ${missing.join(', ')}\n\n` +
      `Please send complete details.`
    );
    return;
  }

  // Generate order
  const orderId = `SAR-${Date.now().toString(36).toUpperCase().substr(-6)}`;
  const now = new Date();

  let summary = `✅ *ORDER CONFIRMED!*\n\n`;
  summary += `📋 *Order ID:* ${orderId}\n`;
  summary += `📅 *Date:* ${now.toLocaleDateString()}\n`;
  summary += `⏰ *Time:* ${now.toLocaleTimeString()}\n`;
  summary += `📱 *Customer:* ${phone}\n\n`;

  // Customer info
  summary += `👤 *Customer Details:*\n`;
  Object.entries(details).forEach(([key, value]) => {
    summary += `• ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}\n`;
  });

  summary += `\n📦 *Order Summary:*\n`;

  let subtotal = 0;
  state.selectedShoes.forEach((p, i) => {
    summary += `\n${i + 1}. ${p.name}\n`;
    summary += `   Price: $${p.price}\n`;
    summary += `   Size: ${state.selectedSize || 'Selected at store'}\n`;
    summary += `   Code: SAR-${p.type.slice(0, 3)}-${String(p.id).padStart(3, '0')}\n`;
    subtotal += p.price;
  });

  const deliveryFee = state.purchaseMethod === "HOME_DELIVERY" && subtotal < 50 ? 5 : 0;
  const total = subtotal + deliveryFee;


  // Save order to MongoDB
  const orderData = new Order({
    phone: phone,

    customerDetails: details,

    purchaseMethod: state.purchaseMethod,

    selectedShoes: state.selectedShoes.map(p => ({
      productId: p.id,
      name: p.name,
      price: p.price,
      size: state.selectedSize || "Store Selection",
      code: `SAR-${p.type.slice(0, 3)}-${String(p.id).padStart(3, '0')}`,
      imageUrl: p.images[0]


    })),

    pricing: {
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: total
    }
  });

  await orderData.save();
  console.log("🗄️ Order saved in MongoDB:", orderData._id);



  summary += `\n💰 *Payment Summary:*\n`;
  summary += `• Subtotal: $${subtotal.toFixed(2)}\n`;
  if (deliveryFee > 0) summary += `• Delivery: $${deliveryFee.toFixed(2)}\n`;
  summary += `• *Total: $${total.toFixed(2)}*\n\n`;

  // Next steps
  if (state.purchaseMethod === "STORE_PICKUP") {
    summary += `🏪 *Pickup Instructions:*\n`;
    summary += `1. Visit store with Order ID\n`;
    summary += `2. Bring ID proof\n`;
    summary += `3. Pay at store (Cash/Card)\n`;
    summary += `4. Collect your order\n\n`;
    summary += `📍 *Store:* 123 Fashion Street\n`;
    summary += `📞 *Call:* +91-1234567890\n`;
  } else {
    summary += `🚚 *Delivery Info:*\n`;
    summary += `1. Order will be processed in 24hrs\n`;
    summary += `2. Delivery: 3-5 business days\n`;
    summary += `3. Cash on Delivery\n`;
    summary += `4. Keep exact change ready\n\n`;
    summary += `📞 *Delivery Contact:* +91-9876543210\n`;
  }

  summary += `📧 *Confirmation email sent*\n\n`;
  summary += `🙏 *Thank you for shopping with Sarwan Shoes!*\n`;
  summary += `Start new order: send *start*`;

  // Send confirmation
  await WhatsAppService.sendText(phone, summary);

  // Cleanup
  setTimeout(() => userState.delete(phone), 10000);
}

// ================= SESSION CLEANUP =================
setInterval(() => {
  const now = Date.now();
  for (const [phone, state] of userState.entries()) {
    if (now - state.lastActivity > 30 * 60 * 1000) {
      userState.delete(phone);
      console.log(`🧹 Cleared session for ${phone}`);
    }
  }
}, 30 * 60 * 1000);

// Get all orders for frontend / admin panel
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      total: orders.length,
      data: orders
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};