const TOKEN_KEY = "card_frontend_token";
const USER_ID_KEY = "card_frontend_user_id";
const AUTH_NOTICE_KEY = "card_frontend_auth_notice";
const ACCOUNT_SUBSCRIPTION_UNTIL_KEY =
  "card_frontend_account_subscription_until";

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  getUserId: () => localStorage.getItem(USER_ID_KEY),
  setUserId: (userId: string) => localStorage.setItem(USER_ID_KEY, userId),
  clearUserId: () => localStorage.removeItem(USER_ID_KEY),
  getAccountSubscriptionUntil: () =>
    localStorage.getItem(ACCOUNT_SUBSCRIPTION_UNTIL_KEY),
  setAccountSubscriptionUntil: (value: string | null) => {
    if (value === null) {
      localStorage.removeItem(ACCOUNT_SUBSCRIPTION_UNTIL_KEY);
      return;
    }

    localStorage.setItem(ACCOUNT_SUBSCRIPTION_UNTIL_KEY, value);
  },
  clearAccountSubscriptionUntil: () =>
    localStorage.removeItem(ACCOUNT_SUBSCRIPTION_UNTIL_KEY),
  getAuthNotice: () => sessionStorage.getItem(AUTH_NOTICE_KEY),
  setAuthNotice: (message: string) =>
    sessionStorage.setItem(AUTH_NOTICE_KEY, message),
  clearAuthNotice: () => sessionStorage.removeItem(AUTH_NOTICE_KEY),
};
