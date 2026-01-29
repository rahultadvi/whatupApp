import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import webhookRoutes from "./router/webhook.route.js"
import connectDB from "./config/db.js";
import cors from "cors";
dotenv.config();

const PORT = process.env.PORT || 3001;
const app = express();


connectDB();


const allowedOrigins = [
  "https://chatapp-ag-6kcl.onrender.com"
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(bodyParser.json());

app.use(
"/images",
express.static(path.join(process.cwd(), "public/images"))
);
app.use(
"/pdfs",
express.static(path.join(process.cwd(), "public/pdfs"))
);
app.use("/temp", express.static(path.join(process.cwd(), "public/temp")));

app.use("/",webhookRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});