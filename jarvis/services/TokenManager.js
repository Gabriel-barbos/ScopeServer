import getToken from './GetToken.js';

const TOKEN_LIFETIME_MS = 50 * 60 * 1000; // 50 minutos 

class TokenManager {
  constructor({ login, password }) {
    this.login = login;
    this.password = password;
    this.token = null;
    this.createdAt = null;
    this.refreshCount = 0;
  }

  isExpired() {
    if (!this.token || !this.createdAt) return true;
    return Date.now() - this.createdAt > TOKEN_LIFETIME_MS;
  }

  async getToken() {
    if (this.isExpired()) {
      console.log(`[TokenManager] ${this.token ? 'Renovando' : 'Gerando'} token...`);

      this.token = await getToken({
        login: this.login,
        password: this.password,
      });
      this.createdAt = Date.now();

      if (this.refreshCount > 0) {
        console.log(`[TokenManager] Token renovado (refresh #${this.refreshCount})`);
      }
      this.refreshCount++;
    }

    return this.token;
  }

  getStats() {
    return {
      refreshCount: this.refreshCount,
      tokenAge: this.createdAt ? Math.round((Date.now() - this.createdAt) / 1000 / 60) + ' min' : 'N/A',
      isExpired: this.isExpired(),
    };
  }
}

export default TokenManager;
