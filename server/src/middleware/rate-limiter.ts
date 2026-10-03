import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: {
      message: "Too many login attempts. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: {
      message: "Too many registration attempts. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: {
      message: "Too many refresh attempts. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const changePasswordLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: {
      message: "Too many password change attempts. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: {
      message: "Too many verification attempts. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const resendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: {
      message: "Too many resend attempts. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
