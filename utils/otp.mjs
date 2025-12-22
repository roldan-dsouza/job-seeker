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
    return { status: true, msg: "Error generating OTP:" };
  }
}
