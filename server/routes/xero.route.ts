import express, { Request, Response } from "express";
import {
  setupPage,
  connect,
  callback,
  organization,
  index,
  webhookCallback,
  getContactByAccountNumber,
  CreateOverPayment,
  createInvoicePayment,
  cancelPayment,
  refundOverPayment,
} from "../controllers/xero.controller.js";
import authenticateXero from "../utils/authenticate.js";

const router = express.Router();

interface IRequest extends Request {
  session: any;
}

interface IResponse extends Response {}

router.get("/", index);

// Authentication and Authorization Routes
router.get("/setup", setupPage);
router.get("/connect", connect); // Step 1: Authorize
router.get("/callback", callback); // Step 2: Callback from Xero OAuth2 Server

// Payer Validation Routes
router.get("/contacts", getContactByAccountNumber);
// router.

// Payment Notification / Callback Routes
router.get("/overpayment", CreateOverPayment); // Pay with student code
router.get("/create-invoice-payment", createInvoicePayment); // Pay with invoice number

// Payment Cancellation Routes
router.get("/cancel-payment", cancelPayment); // Cancel invoice payment
router.get("/refund-overpayment", refundOverPayment); // Refund overpayment

// Merchant Information Routes
router.get("/organization", organization);

// Webhook Routes
router.post("/webhooks", webhookCallback);

// Test Redis Authentication
router.get("/api/auth", async (req: IRequest, res: IResponse) => {
  try {
    const xero = await authenticateXero();
    return res
      .status(200)
      .json({ message: "Successfully authenticated with Xero" });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ error: error, message: "Error authenticating with Xero" });
  }
});

export default router;
