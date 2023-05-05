import * as dotenv from "dotenv";

dotenv.config();

const xeroScopes =
  "openid profile email accounting.settings accounting.reports.read accounting.journals.read accounting.contacts accounting.attachments accounting.transactions offline_access";

export default {
  xeroClientConf: {
    clientId: process.env.XERO_CLIENT_ID,
    clientSecret: process.env.XERO_CLIENT_SECRET,
    redirectUris: [process.env.XERO_REDIRECT_URI],
    scopes: xeroScopes.split(" "),
    state: "id=123",
  },
  redis_url: process.env.REDIS_URL,
};
