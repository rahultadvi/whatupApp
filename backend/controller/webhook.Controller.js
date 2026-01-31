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

  static async sendProductList(to, products) {
    try {
      // Create carousel-like experience with multiple messages
      let currentIndex = 0;
   class ProductSender {
  constructor(config = {}) {
    this.products = [];
    this.currentIndex = 0;
    this.isSending = false;
    this.userSelections = new Map();
    this.config = {
      delayBetweenProducts: 500,
      maxFeaturesToShow: 2,
      imagesPerProduct: 3,
      paginationSize: 5,
      ...config
    };
  }

  /**
   * Initialize product sender with products
   * @param {Array} products - Array of product objects
   */
  initialize(products) {
    this.products = this._validateProducts(products);
    this.currentIndex = 0;
    this.isSending = false;
    return this;
  }

  /**
   * Send products interactively with pagination
   * @param {string} userId - User identifier
   * @param {Object} options - Sending options
   * @returns {Object} - Result with status and metadata
   */
  async sendProducts(userId, options = {}) {
    if (this.isSending) {
      throw new Error('Already sending products to this user');
    }

    if (!this.products.length) {
      throw new Error('No products to send');
    }

    this.isSending = true;
    const startTime = Date.now();

    try {
      const { paginationSize = this.config.paginationSize } = options;
      const endIndex = Math.min(this.currentIndex + paginationSize, this.products.length);

      // Send products in batch with controlled concurrency
      await this._sendProductBatch(userId, this.currentIndex, endIndex);

      // Update index and check if more products exist
      this.currentIndex = endIndex;
      const hasMore = endIndex < this.products.length;

      // Send interactive options
      await this._sendInteractiveOptions(userId, hasMore);

      return {
        success: true,
        sentCount: endIndex - options.startIndex || 0,
        totalSent: endIndex,
        hasMore,
        duration: Date.now() - startTime
      };
    } catch (error) {
      this.isSending = false;
      console.error('Error sending products:', error);
      throw error;
    }
  }

  /**
   * Send a batch of products with controlled concurrency
   */
  async _sendProductBatch(userId, start, end) {
    const batch = this.products.slice(start, end);
    
    // Use concurrency control to avoid overwhelming the system
    const concurrencyLimit = 3;
    const chunks = this._chunkArray(batch, concurrencyLimit);

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map((product, index) => 
          this._sendSingleProduct(userId, product, start + index)
        )
      );
      
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this._delay(this.config.delayBetweenProducts * 2);
      }
    }
  }

  /**
   * Send a single product with retry logic
   */
  async _sendSingleProduct(userId, product, productIndex) {
    const maxRetries = 3;
    let retries = 0;

    while (retries <= maxRetries) {
      try {
        const productNumber = productIndex + 1;
        const message = this._createProductMessage(product, productNumber);
        
        // Send main image
        await this._sendImage(userId, product.images[0], message);

        // If product has multiple images, send additional ones
        if (product.images.length > 1 && this.config.imagesPerProduct > 1) {
          await this._sendAdditionalImages(userId, product);
        }

        return;
      } catch (error) {
        retries++;
        if (retries > maxRetries) {
          console.error(`Failed to send product ${product.id} after ${maxRetries} attempts`);
          throw error;
        }
        await this._delay(1000 * retries); // Exponential backoff
      }
    }
  }

  /**
   * Create formatted product message
   */
  _createProductMessage(product, productNumber) {
    const features = product.features
      .slice(0, this.config.maxFeaturesToShow)
      .map(feat => `• ${feat}`)
      .join('\n');

    const discountBadge = product.discount > 0 
      ? `🎯 *${product.discount}% OFF*\n`
      : '';

    const ratingStars = '⭐'.repeat(Math.floor(product.rating)) + 
                       (product.rating % 1 >= 0.5 ? '½' : '');

    return `
📦 *PRODUCT ${productNumber}/${this.products.length}*

*${product.name}*

💰 *Price:* $${product.price} ${product.originalPrice ? `~~$${product.originalPrice}~~` : ''}
${discountBadge}${ratingStars} *${product.rating}/5* (${product.reviewCount || 0} reviews)

📏 *Available Sizes:* ${product.sizes.join(', ')}

🔧 *Key Features:*
${features}

${product.description ? `\n📝 *Description:*\n${product.description.substring(0, 150)}...\n` : ''}

👉 *Select this product: Reply with* \`${productNumber}\`
   *View details: Reply with* \`D${productNumber}\`
   *Save for later: Reply with* \`S${productNumber}\`
    `;
  }

  /**
   * Send additional product images
   */
  async _sendAdditionalImages(userId, product) {
    const additionalImages = product.images.slice(1, this.config.imagesPerProduct);
    
    for (const image of additionalImages) {
      await this._delay(300);
      await this._sendImage(userId, image, `More views of ${product.name}`);
    }
  }

  /**
   * Send interactive options after products
   */
  async _sendInteractiveOptions(userId, hasMore) {
    const options = [
      "🔢 *Select product number* (e.g., '1')",
      "📋 *View all selections* (Type 'CART')",
      "❌ *Clear selections* (Type 'CLEAR')",
      "🔍 *Search products* (Type 'SEARCH [keyword]')",
      "💬 *Help* (Type 'HELP')"
    ];

    if (hasMore) {
      options.unshift("➡️ *Show next 5 products* (Type 'NEXT')");
    }

    if (this.currentIndex > this.config.paginationSize) {
      options.push("⬅️ *Show previous* (Type 'PREV')");
    }

    const message = `
*━━━━━━━━━━━━━━━━*
🎯 *INTERACTIVE OPTIONS*

${options.join('\n')}

*━━━━━━━━━━━━━━━━*
📊 *Progress:* ${this.currentIndex}/${this.products.length} products shown
🛒 *Your selections:* ${this.userSelections.get(userId)?.length || 0} items
    `;

    await this._sendMessage(userId, message);
  }

  /**
   * Handle user response
   */
  async handleUserResponse(userId, response) {
    response = response.trim().toUpperCase();

    const handlers = {
      NEXT: () => this.sendProducts(userId),
      PREV: () => this._showPrevious(userId),
      CART: () => this._showSelections(userId),
      CLEAR: () => this._clearSelections(userId),
      HELP: () => this._sendHelp(userId),
      SEARCH: (query) => this._searchProducts(userId, query)
    };

    // Check for product selection (e.g., "1", "D1", "S1")
    if (/^\d+$/.test(response) || /^[DS]\d+$/i.test(response)) {
      return this._handleProductAction(userId, response);
    }

    // Check for commands
    const [command, ...args] = response.split(' ');
    if (handlers[command]) {
      return handlers[command](args.join(' '));
    }

    // Default response for unknown input
    await this._sendMessage(userId, 
      "❌ Invalid option. Please choose from the options above or type HELP for assistance."
    );
  }

  /**
   * Handle product-related actions
   */
  async _handleProductAction(userId, response) {
    const action = response.charAt(0);
    const productNumber = parseInt(action.match(/\d/) ? response : response.substring(1));
    
    if (productNumber < 1 || productNumber > this.products.length) {
      await this._sendMessage(userId, `❌ Invalid product number. Please select between 1-${this.products.length}`);
      return;
    }

    const product = this.products[productNumber - 1];
    
    switch(action.toUpperCase()) {
      case 'D':
        await this._showProductDetails(userId, product, productNumber);
        break;
      case 'S':
        await this._saveForLater(userId, product, productNumber);
        break;
      default:
        await this._selectProduct(userId, product, productNumber);
    }
  }

  /**
   * Select a product
   */
  async _selectProduct(userId, product, productNumber) {
    if (!this.userSelections.has(userId)) {
      this.userSelections.set(userId, []);
    }

    const userCart = this.userSelections.get(userId);
    
    if (!userCart.find(item => item.id === product.id)) {
      userCart.push({
        ...product,
        selectedAt: new Date(),
        selectedNumber: productNumber
      });

      await this._sendMessage(userId, 
        `✅ Added to selections: *${product.name}*\n` +
        `🛒 Your cart now has ${userCart.length} items\n` +
        `💬 Reply with 'CART' to view all selections`
      );
    } else {
      await this._sendMessage(userId, 
        `ℹ️ *${product.name}* is already in your selections`
      );
    }
  }

  /**
   * Show product details
   */
  async _showProductDetails(userId, product, productNumber) {
    const detailsMessage = `
📋 *DETAILED VIEW - ${product.name}*

${product.description || 'No description available'}

📊 *Specifications:*
${product.specifications ? Object.entries(product.specifications)
  .map(([key, value]) => `• *${key}:* ${value}`)
  .join('\n') : 'No specifications available'}

🌟 *All Features:*
${product.features.map(feat => `• ${feat}`).join('\n')}

🖼️ *Images:* ${product.images.length} available

🛒 *To select this product, reply:* ${productNumber}
📌 *To save for later, reply:* S${productNumber}
    `;

    await this._sendMessage(userId, detailsMessage);
  }

  /**
   * Show user's selections
   */
  async _showSelections(userId) {
    const userCart = this.userSelections.get(userId) || [];
    
    if (!userCart.length) {
      await this._sendMessage(userId, "🛒 Your selections are empty");
      return;
    }

    let total = 0;
    const cartItems = userCart.map((item, index) => {
      total += item.price;
      return `${index + 1}. *${item.name}* - $${item.price}`;
    }).join('\n');

    const message = `
🛒 *YOUR SELECTIONS* (${userCart.length} items)

${cartItems}

*━━━━━━━━━━━━━━━━*
💰 *Total:* $${total.toFixed(2)}

💬 *Commands:*
• Remove item: Type 'REMOVE [number]'
• Checkout: Type 'CHECKOUT'
• Continue browsing: Type 'NEXT'
    `;

    await this._sendMessage(userId, message);
  }

  /**
   * Utility methods
   */
  _chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _validateProducts(products) {
    return products.filter(product => 
      product.name && 
      product.price && 
      product.images && 
      product.images.length > 0
    );
  }

  // Mock methods - implement based on your actual messaging system
  async _sendImage(userId, imageUrl, caption) {
    // Implement your image sending logic
    console.log(`Sending image to ${userId}:`, { imageUrl, caption });
  }

  async _sendMessage(userId, message) {
    // Implement your message sending logic
    console.log(`Sending message to ${userId}:`, message);
  }

  // Additional handlers (simplified for brevity)
  async _showPrevious(userId) { /* ... */ }
  async _clearSelections(userId) { /* ... */ }
  async _sendHelp(userId) { /* ... */ }
  async _searchProducts(userId, query) { /* ... */ }
  async _saveForLater(userId, product, productNumber) { /* ... */ }
}

// Usage example:
const productSender = new ProductSender({
  delayBetweenProducts: 500,
  maxFeaturesToShow: 3,
  imagesPerProduct: 2,
  paginationSize: 5
});

// Initialize with products
productSender.initialize(productsArray);

// Send first batch
await productSender.sendProducts('user123');

// Handle user responses
await productSender.handleUserResponse('user123', '1'); // Select product 1
await productSender.handleUserResponse('user123', 'NEXT'); // Show next batch
await productSender.handleUserResponse('user123', 'CART'); // View cart
      
      await sendNextProduct();
      
      // Send selection instructions after all products
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let selectionText = `*🎯 Select Your Product:*\n\n`;
      products.forEach((product, index) => {
        selectionText += `${index + 1}️⃣ *${product.name}* - $${product.price}\n`;
      });
      selectionText += `\nReply with the *number* of your choice (1, 2, or 3)`;
      
      return await this.sendText(to, selectionText);
    } catch (error) {
      console.error('❌ Error sending product list:', error);
      throw error;
    }
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

  const enhancedProducts = products.map(product => {
    // Assign images based on your products array
    const productImages = product.images && Array.isArray(product.images) 
      ? product.images 
      : ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop"];

    // Generate rating
    let rating = 4.0;
    if (product.name.includes("Basic")) rating = 4.2;
    if (product.name.includes("Pro") || product.name.includes("Plus")) rating = 4.5;
    if (product.name.includes("Elite") || product.name.includes("Premium")) rating = 4.8;

    // Calculate discount
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

  // Limit to 3 products
  const productsToShow = matchedProducts.slice(0, CONFIG.MAX_PRODUCTS_TO_SHOW);
  state.selectedProducts = productsToShow;
  state.totalProductsFound = matchedProducts.length;

  // Show products with images (card-style)
  await WhatsAppService.sendText(phone,
    `🎉 *Found ${matchedProducts.length} matching shoes!*\n\n` +
    `Now showing ${productsToShow.length} best options:\n` +
    `(Each product will be shown with image)`
  );

  // Send product cards one by one
  await WhatsAppService.sendProductList(phone, productsToShow);
  
  state.step = "SELECT_PRODUCT";
  userState.set(phone, state);
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
      errorMsg += `${idx + 1}️⃣ *${product.name}* - $${product.price}\n`;
    });
    
    errorMsg += `\nReply with *1${state.selectedProducts.length > 1 ? `, 2${state.selectedProducts.length > 2 ? ', or 3' : ''}` : ''}*`;
    
    await WhatsAppService.sendText(phone, errorMsg);
    return;
  }

  // Valid selection
  const selectedProduct = state.selectedProducts[index];
  state.selectedProduct = selectedProduct;
  state.step = "PURCHASE";

  console.log(`✅ User selected: ${selectedProduct.name} ($${selectedProduct.price})`);

  // Show detailed product info
  const details = `
👟 *${selectedProduct.name}*

${selectedProduct.description}

💰 *Price:* $${selectedProduct.price}${selectedProduct.discount > 0 ? ` (${selectedProduct.discount}% OFF)` : ''}
${selectedProduct.originalPrice ? `🎯 *Original Price:* $${selectedProduct.originalPrice}\n` : ''}
📏 *Available Sizes:* ${selectedProduct.sizes.join(', ')}
${state.selectedSize ? `✅ *Your Selected Size:* ${state.selectedSize}\n` : ''}
🎨 *Colors:* ${selectedProduct.colors.join(', ')}
⭐ *Rating:* ${selectedProduct.rating}/5 ⭐⭐⭐⭐⭐
📊 *${selectedProduct.rating >= 4.5 ? 'BESTSELLER' : 'POPULAR CHOICE'}*

🔧 *Key Features:*
${selectedProduct.features.map(f => `• ${f}`).join('\n')}

🧵 *Material:* ${selectedProduct.material}
🛡️ *Warranty:* ${selectedProduct.warranty}
📦 *Delivery:* ${selectedProduct.deliveryDays} business days
${selectedProduct.inStock ? '✅ *In Stock - Ready to Ship*' : '⏳ *Limited Stock*'}

🆔 *Product Code:* ${selectedProduct.productCode}
`;

  // Send product image with details
  await WhatsAppService.sendImage(
    phone,
    selectedProduct.images[0],
    details.trim()
  );

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
    phone: phone,
    orderId: orderId,
    customerDetails: {
      ...details,
      purchaseMethod: state.purchaseMethod
    },
    product: {
      id: state.selectedProduct.id,
      name: state.selectedProduct.name,
      type: state.selectedProduct.type,
      price: state.selectedProduct.price,
      size: state.selectedSize || "Not specified",
      productCode: state.selectedProduct.productCode,
      imageUrl: state.selectedProduct.images[0]
    },
    pricing: {
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: total
    },
    orderDate: now,
    status: "pending"
  };

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
    if (now - state.lastActivity > 30 * 60 * 1000) { // 30 minutes
      userState.delete(phone);
      console.log(`🧹 Cleared inactive session for ${phone}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// ================= ORDER MANAGEMENT =================
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderDate: -1 });
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

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.id });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};