const TOKEN_KEY = "reach.token";
const USER_KEY  = "reach.user";

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser:  () => localStorage.getItem(USER_KEY),
  isAuthed: () => !!localStorage.getItem(TOKEN_KEY),
  setSession: (token, username) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY,  username);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
