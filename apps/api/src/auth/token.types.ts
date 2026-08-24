export interface AccessTokenPayload {
  sub: string; // userId
  sid: string; // sessionId
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
}
