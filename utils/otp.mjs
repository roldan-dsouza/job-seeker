import crypto from "crypto";
import NodeCache from "node-cache";

// OTP cache with default TTL = 5 minutes
const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
});

export function createOtp(email) {
  try {
    const otp = crypto.randomInt(100000, 999999).toString();

    // Invalidate any existing OTP
    cache.del(email);

    // Store new OTP
    cache.set(email, otp);

    return otp;
  } catch (error) {
    throw new Error("OTP_GENERATION_FAILED");
  }
}

export function retrieveOtp(email) {
  return cache.get(email);
}

export function deleteOtp(email) {
  cache.del(email);
}

export function verifyOtp(email, otp) {
  const cachedOtp = retrieveOtp(email);

  if (!cachedOtp) {
    return {
      valid: false,
      message: "OTP expired or not found",
    };
  }

  if (cachedOtp === String(otp)) {
    deleteOtp(email);
    return {
      valid: true,
      message: "OTP verified successfully",
    };
  }

  return {
    valid: false,
    message: "Invalid OTP",
  };
}
