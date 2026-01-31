import mongoose from "mongoose";

const selectedShoeSchema = new mongoose.Schema(
  {
    id: Number,
    name: String,
    type: String,
    price: Number,
    size: String,
    productCode: String,
    imageUrl: String,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
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
      required: true,
    },

    selectedShoes: {
      type: [selectedShoeSchema],
      required: true,
    },

    pricing: {
      subtotal: Number,
      deliveryFee: Number,
      total: Number,
    },

    status: {
      type: String,
      default: "CONFIRMED",
    },
  },
  { timestamps: true }
);

// 🔥 THIS is the REAL fix
mongoose.models = {};

export default mongoose.model("Order", orderSchema);
