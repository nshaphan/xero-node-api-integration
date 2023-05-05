import jwtDecode from "jwt-decode";
import {
  XeroIdToken,
  XeroAccessToken,
  TokenSetParameters,
  XeroClient,
} from "xero-node";
import getRedis from "./redis";
import config from "../config";

interface Tenant {
  id: string;
  authEventId: string;
  tenantId: string;
  tenantType: string;
  tenantName: string;
  createdDateUtc: string;
  updatedDateUtc: string;
}

export interface AuthData {
  decodedIdToken: XeroIdToken;
  tokenSet: TokenSetParameters;
  decodedAccessToken: XeroAccessToken;
  accessTokenExpires: string;
  allTenants: Tenant[];
  activeTenant: Tenant;
}



const timeSince = (token) => {
  if (token) {
    const timestamp = token["exp"];
    const myDate = new Date(timestamp * 1000);
    return myDate.toLocaleString();
  } else {
    return "";
  }
};

export const authenticationData = (
  tokenSet: TokenSetParameters,
  tenants: Tenant[],
  activeTenant: Tenant
): AuthData => {
  const decodedIdToken: XeroIdToken = jwtDecode(tokenSet.id_token);
  const decodedAccessToken: XeroAccessToken = jwtDecode(tokenSet.access_token);
  return {
    decodedIdToken,
    tokenSet: tokenSet,
    decodedAccessToken: jwtDecode(tokenSet.access_token),
    accessTokenExpires: timeSince(decodedAccessToken),
    allTenants: tenants,
    activeTenant: activeTenant,
  };
};

const authenticateXero = async () => {

  const xero = new XeroClient(config.xeroClientConf);

  const redis = await getRedis();
  let authData = await redis.get("authData");
  let authDataJSON: AuthData = JSON.parse(authData);

  if (authDataJSON.tokenSet) {
    xero.setTokenSet(authDataJSON.tokenSet);
  }

  const tokenSet = xero.readTokenSet();

  if (tokenSet.expired()) {
    console.log("tokenSet.expired()");

    const newTokenSet = await xero.refreshWithRefreshToken(
      xero.config.clientId,
      xero.config.clientSecret,
      tokenSet.refresh_token
    );

    await xero.updateTenants(false);

    const authData = authenticationData(
      newTokenSet,
      xero.tenants,
      xero.tenants[0]
    );

    await redis.set("authData", JSON.stringify(authData));
  } else {
    await xero.updateTenants(false);
  }

  return xero;
};

export default authenticateXero;
