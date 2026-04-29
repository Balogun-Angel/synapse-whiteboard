export const API_BASE_URL = "http://localhost:5000";
export const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
export const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";
const LEGACY_ACCESS_TOKEN_STORAGE_KEY = "synapse_access_token";
const LEGACY_REFRESH_TOKEN_STORAGE_KEY = "synapse_refresh_token";

export const isAuthenticated = () => {
  return Boolean(
    localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY),
  );
};

export const storeAuthTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  localStorage.setItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY, accessToken);
  localStorage.setItem(LEGACY_REFRESH_TOKEN_STORAGE_KEY, refreshToken);
};

export const clearStoredAuth = () => {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem("authUser");
};
