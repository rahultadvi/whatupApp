import mongoose from "mongoose";

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

    selectedShoes: [
      {
        id: Number,
        name: String,
        type: String,
        price: Number,
        size: String,
        productCode: String,
        imageUrl: String,
      }
    ],

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

// 🔥 FORCE CLEAR OLD MODEL
if (mongoose.models.Order) {
  delete mongoose.models.Order;
}

export default mongoose.model("Order", orderSchema);
