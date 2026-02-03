
import { readProductsFromSheet } from "./utils/readGoogleSheet.js";

(async () => {
  try {
    const products = await readProductsFromSheet();
    console.log("✅ GOOGLE SHEET DATA:", products);
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
})();
