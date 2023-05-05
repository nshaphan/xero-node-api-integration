import authenticateXero, { authenticationData } from "../utils/authenticate";
import { Request, Response } from "express";
import {
  TokenSetParameters,
  BankTransactions,
  Payments,
  CurrencyCode,
  Payment,
  BankTransaction,
  XeroClient,
} from "xero-node";
import * as crypto from "crypto";
import getRedis from "../utils/redis";
import config from "../config";

interface IRequest extends Request {
  session: any;
}

interface IResponse extends Response {}

function setupPage(req, res) {
  res.send(`<a href="/xero/connect">Connect to Xero</a>`);
}

async function index(req: Request, res: Response) {
  const xero = await authenticateXero();
  const tokenSet: TokenSetParameters = xero.readTokenSet();
  try {
    const authData = authenticationData(
      tokenSet,
      xero.tenants,
      xero.tenants[0]
    );
    // Send JSON response
    res.json({
      consentUrl: await xero.buildConsentUrl(),
      authenticated: authData,
    });
  } catch (err) {
    res.status(500).json({
      consentUrl: await xero.buildConsentUrl(),
      error: err,
    });
  }
}

async function connect(req, res) {
  try {
    const xero = await authenticateXero();
    const consentUrl = await xero.buildConsentUrl();
    res.redirect(consentUrl);
  } catch (err) {
    console.log(err);
    res.send("Sorry, something went wrong");
  }
}

async function callback(req: IRequest, res: IResponse) {
  const xeroClient = new XeroClient(config.xeroClientConf);
  try {
    // Calling apiCallback will setup all the client with
    // and return the orgData of each authorized tenant
    const tokenSet: TokenSetParameters = await xeroClient.apiCallback(req.url);
    await xeroClient.updateTenants(false);

    console.log("xero.config.state", xeroClient.config.state);

    // This is where you can associate & save your
    // `tokenSet` to a user in your Database
    const redis = await getRedis();
    const authData = authenticationData(
      tokenSet,
      xeroClient.tenants,
      xeroClient.tenants[0]
    );
    await redis.set("authData", JSON.stringify(authData));

    res.json({
      consentUrl: await xeroClient.buildConsentUrl(),
      authenticated: authData,
    });
  } catch (err) {
    console.log(err);
    res.status(res.statusCode).json({
      consentUrl: await xeroClient.buildConsentUrl(),
      error: err,
    });
  }
}

const verifyWebhookEventSignature = (req: Request) => {
  let computedSignature = crypto
    .createHmac("sha256", process.env.XERO_WEBHOOK_KEY)
    .update(req.body.toString())
    .digest("base64");
  let xeroSignature = req.headers["x-xero-signature"];

  if (xeroSignature === computedSignature) {
    console.log("Signature passed verification! This is from Xero.");
    return true;
  } else {
    // If this happens someone who is not Xero is sending you a webhook
    console.log("Signature failed verification! This is NOT from Xero.");
    console.log("Computed signature: ", computedSignature);

    return false;
  }
};

async function webhookCallback(req: IRequest, res: IResponse) {
  console.log(
    "webhook event received!",
    req.headers,
    req.body,
    JSON.parse(req.body)
  );

  verifyWebhookEventSignature(req)
    ? res.status(200).send()
    : res.status(401).send();
}

async function organization(req, res) {
  try {
    const xero = await authenticateXero();

    const response = await xero.accountingApi.getOrganisations(
      xero.tenants[0].tenantId
    );

    res.send(`Hello, ${response.body.organisations[0].name}!`);
  } catch (err) {
    console.log(err);
    res.send("Sorry, something went wrong");
  }
}

async function getContactByAccountNumber(req: IRequest, res: IResponse) {
  try {
    const xero = await authenticateXero();

    const response = await xero.accountingApi.getContacts(
      xero.tenants[0].tenantId,
      undefined,
      `AccountNumber="12345"`
    );

    const contact = response.body.contacts[0];

    const payerData = {
      merchant_code: "TH0001",
      service_group_code: "0001",
      payer_must_pay_total_amount: "NO",
      amount: "5",
      payer_code: "12345",
      payer_names: contact.name,
      department_code: "0001",
      department_name: "Department 1",
      class_name: "Class 1",
      currency: "RWF",
      comment: "School fees",
    };

    res.status(200).json({
      status: 200,
      message: "Success",
      timestamp: new Date().toISOString(),
      data: payerData,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      timestamp: new Date().toISOString(),
      data: null,
    });
  }
}

async function CreateOverPayment(req: IRequest, res: IResponse) {
  try {
    const xero = await authenticateXero();

    const response = await xero.accountingApi.getContacts(
      xero.tenants[0].tenantId,
      undefined,
      `AccountNumber="12345"`
    );

    const contact = response.body.contacts[0];

    const overPayment: BankTransaction = {
      type: BankTransaction.TypeEnum.RECEIVEOVERPAYMENT,
      contact: {
        contactID: contact.contactID,
      },
      lineItems: [
        {
          description: "School fees",
          lineAmount: 8000,
        },
      ],
      currencyCode: CurrencyCode.RWF,
      currencyRate: 1,
      reference: "TXNREF705",
      status: BankTransaction.StatusEnum.AUTHORISED,
      date: new Date().toISOString(),
      bankAccount: {
        bankAccountNumber: "1234567890",
      },
    };

    const newBankTransactions: BankTransactions = new BankTransactions();
    newBankTransactions.bankTransactions = [overPayment];

    const newBankTransactionResponse =
      await xero.accountingApi.createBankTransactions(
        xero.tenants[0].tenantId,
        newBankTransactions
      );

    res.status(200).json({
      status: 200,
      message: "Success",
      timestamp: new Date().toISOString(),
      data: newBankTransactionResponse.body,
    });
  } catch (err) {
    console.log("Error", err.response.body);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      timestamp: new Date().toISOString(),
      data: null,
    });
  }
}

async function createInvoicePayment(req: IRequest, res: IResponse) {
  try {
    const xero = await authenticateXero();

    const getInvoiceResponse = await xero.accountingApi.getInvoices(
      xero.tenants[0].tenantId,
      undefined,
      `InvoiceNumber="INV-0037"`
    );

    const invoice = getInvoiceResponse.body.invoices[0];

    console.log("Invoice", invoice);

    const payments: Payments = {
      payments: [
        {
          invoice: {
            invoiceID: invoice.invoiceID,
          },
          account: {
            code: "890",
          },
          date: new Date().toISOString(),
          amount: 5,
          currencyRate: 1,
          reference: "TXNREF4000",
          paymentType: Payment.PaymentTypeEnum.ACCRECPAYMENT,
        },
      ],
    };

    const newPaymentResponse = await xero.accountingApi.createPayments(
      xero.tenants[0].tenantId,
      payments
    );

    res.status(200).json({
      status: 200,
      message: "Success",
      timestamp: new Date().toISOString(),
      data: newPaymentResponse.body,
    });
  } catch (err) {
    console.log("Error", err.response.body.Elements[0].ValidationErrors);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      timestamp: new Date().toISOString(),
      data: null,
    });
  }
}

async function cancelPayment(req: IRequest, res: IResponse) {
  try {
    const xero = await authenticateXero();

    const getPaymentResponse = await xero.accountingApi.getPayments(
      xero.tenants[0].tenantId,
      undefined,
      'Reference="TXNREF700"'
    );

    console.log("Payment", getPaymentResponse.body);

    const payment = getPaymentResponse.body.payments[0];

    const paymentID = payment.paymentID;

    const newPaymentResponse = await xero.accountingApi.deletePayment(
      xero.tenants[0].tenantId,
      paymentID,
      {
        status: "DELETED",
      }
    );

    return res.status(200).json({
      status: 200,
      message: "Success",
      timestamp: new Date().toISOString(),
      data: newPaymentResponse.body,
    });
  } catch (err) {
    console.log("Error", err.response.body.Elements[0].ValidationErrors);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      timestamp: new Date().toISOString(),
      data: null,
    });
  }
}

async function refundOverPayment(req: IRequest, res: IResponse) {
  try {
    const xero = await authenticateXero();

    const payments: Payments = {
      payments: [
        {
          overpayment: {
            overpaymentID: "48da73af-9221-4e5e-897c-2e25c329a767",
          },
          account: {
            code: "890",
          },
          date: new Date().toISOString(),
          amount: 8000,
          currencyRate: 1,
          reference: "TXNREF705",
        },
      ],
    };

    const newPaymentResponse = await xero.accountingApi.createPayments(
      xero.tenants[0].tenantId,
      payments
    );

    return res.status(200).json({
      status: 200,
      message: "Success",
      timestamp: new Date().toISOString(),
      data: newPaymentResponse.body,
    });
  } catch (err) {
    console.log("Error", err);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      timestamp: new Date().toISOString(),
      data: null,
    });
  }
}

export {
  index,
  setupPage,
  connect,
  callback,
  organization,
  webhookCallback,
  getContactByAccountNumber,
  CreateOverPayment,
  createInvoicePayment,
  cancelPayment,
  refundOverPayment,
};
