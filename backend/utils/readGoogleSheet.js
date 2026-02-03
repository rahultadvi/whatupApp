import { google } from "googleapis";

// 🔐 AUTH via ENV variable (Render + Local compatible)
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

// 👇 GOOGLE SHEET ID
const SPREADSHEET_ID = "1NA2hti5JdMahsIJeF6KT1d4SETGIFKn2t3VZJcnuvAQ";

export async function readProductsFromSheet() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A2:H",
    });

    const rows = res.data.values || [];

    return rows
      .filter(row => row[2] && row[3] && row[4])
      .map(row => ({
        id: Number(row[0]) || 0,
        title: row[1] || "",
        name: row[2] || "Unnamed Shoe",
        type: row[3]?.toUpperCase() || "CASUAL",
        price: Number(row[4]) || 0,
        sizes: row[5]
          ? row[5].split(",").map(s => Number(s.trim()))
          : [],
        description: row[6] || "",
        images: row[7] ? [row[7]] : [],
      }));
  } catch (error) {
    console.error("❌ Failed to load products from sheet:", error.message);
    return [];
  }
}
