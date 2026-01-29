import express from "express";
import { getOrders, receiveMessage, verifyWebhook } from "../controller/webhook.Controller.js";


const router = express.Router();

router.get("/webhook", verifyWebhook);
router.post("/webhook", receiveMessage);
router.get("/orders", getOrders);


export default router;