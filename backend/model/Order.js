import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  phone: { type: String, required: true },

  customerDetails: {
    name: String,
    phone: String,
    address: String,
    city: String,
    date: String,
  },

  purchaseMethod: {
    type: String,
    enum: ["STORE_PICKUP", "HOME_DELIVERY"],
    required: true
  },

  selectedShoes: [
    {
      productId: Number,
      name: String,
      price: Number,
      size: String,
      imageUrl: String,  
    code: String
  
    }
  ],

  pricing: {
    subtotal: Number,
    deliveryFee: Number,
    total: Number
  },

  status: {
    type: String,
    default: "CONFIRMED"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Order = mongoose.model("Order",orderSchema);
export default Order;
