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

export const getStoredAccessToken = () => {
  return (
    localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ||
    localStorage.getItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY)
  );
};

export const getStoredRefreshToken = () => {
  return (
    localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) ||
    localStorage.getItem(LEGACY_REFRESH_TOKEN_STORAGE_KEY)
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

export const ensureValidAccessToken = async () => {
  const currentAccessToken = getStoredAccessToken();
  if (!currentAccessToken) {
    return false;
  }

  try {
    const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${currentAccessToken}` },
    });
    if (meResponse.ok) {
      return true;
    }
  } catch {
    // Fall through to refresh flow.
  }

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearStoredAuth();
    return false;
  }

  try {
    const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!refreshResponse.ok) {
      clearStoredAuth();
      return false;
    }

    const refreshData = (await refreshResponse.json()) as { accessToken?: string };
    if (!refreshData.accessToken) {
      clearStoredAuth();
      return false;
    }

    storeAuthTokens(refreshData.accessToken, refreshToken);

    const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${refreshData.accessToken}` },
    });
    if (meResponse.ok) {
      const meData = (await meResponse.json()) as { user?: unknown };
      if (meData.user) {
        localStorage.setItem("authUser", JSON.stringify(meData.user));
      }
      return true;
    }
  } catch {
    // Clear stale session on any refresh flow error.
  }

  clearStoredAuth();
  return false;
};
