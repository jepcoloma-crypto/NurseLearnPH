import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { createChildLogger } from "../utils/logger.js";
import { UnauthorizedError } from "../middleware/error-handler.js";

const logger = createChildLogger("jwt");

export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

function parseExpiresIn(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60;
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case "s":
      return num;
    case "m":
      return num * 60;
    case "h":
      return num * 3600;
    case "d":
      return num * 86400;
    default:
      return 15 * 60;
  }
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload as object, config.JWT_SECRET, {
    expiresIn: parseExpiresIn(config.JWT_EXPIRES_IN),
  });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload as object, config.JWT_REFRESH_SECRET, {
    expiresIn: parseExpiresIn(config.JWT_REFRESH_EXPIRES_IN),
  });
}

export function generateTokenPair(payload: JwtPayload): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    expiresIn: config.JWT_EXPIRES_IN,
  };
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (err) {
    logger.debug({ err }, "Invalid access token");
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET) as JwtPayload;
    return decoded;
  } catch (err) {
    logger.debug({ err }, "Invalid refresh token");
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
}

export function getRefreshTokenExpiry(): Date {
  const seconds = parseExpiresIn(config.JWT_REFRESH_EXPIRES_IN);
  return new Date(Date.now() + seconds * 1000);
}
