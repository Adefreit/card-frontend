const TOKEN_KEY = "card_frontend_token";
const USER_ID_KEY = "card_frontend_user_id";

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  getUserId: () => localStorage.getItem(USER_ID_KEY),
  setUserId: (userId: string) => localStorage.setItem(USER_ID_KEY, userId),
  clearUserId: () => localStorage.removeItem(USER_ID_KEY),
};
