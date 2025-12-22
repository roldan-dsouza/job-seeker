import crypto from "crypto";
import NodeCache from "node-cache";

const cache = new NodeCache();

export function createOtp(email) {
  try {
    const otp = crypto.randomInt(100000, 999999).toString();
    deleteOtp(email);
    cache.set(email, otp, 300);
    return otp;
  } catch (err) {
    return { status: false, msg: "Error generating OTP:" };
  }
}

// Helper to retrieve OTP (used in verifyOtp)
export function retrieveOtp(email) {
  return cache.get(email);
}

// Helper to delete OTP (also used in verifyOtp after successful or failed validation)
export function deleteOtp(email) {
  cache.del(email);
}

export async function verifyOtp(email, otp) {
  // Retrieve OTP from cache
  const cachedOtp = retrieveOtp(email);
  console.log(cachedOtp);
  if (!cachedOtp) {
    return { valid: false, message: "OTP expired or not found" };
  }

  if (cachedOtp === otp) {
    // OTP is valid; delete it after successful verification
    deleteOtp(email);
    return { valid: true, message: "OTP verified successfully" };
  } else {
    // OTP invalid
    return { valid: false, message: "Invalid OTP" };
  }
}
