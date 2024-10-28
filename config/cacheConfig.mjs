const otpCache = new Map();

export const addOtpToCache = (email, otp) => {
  if (!otpCache.has(email)) {
    otpCache.set(email, []);
  }

  const userOtps = otpCache.get(email);

  // Limit the OTPs to the last 5
  if (userOtps.length >= 5) {
    userOtps.shift(); // Remove the oldest OTP if limit is reached
  }

  userOtps.push({ otp, expiration: Date.now() + 5 * 60 * 1000 }); // OTP expires in 5 mins
};

export const getOtpsForUser = (email) => {
  return otpCache.get(email) || [];
};

export const verifyAndRemoveOtp = (email, otp) => {
  const userOtps = otpCache.get(email) || [];
  const otpIndex = userOtps.findIndex(
    (item) => item.otp === otp && Date.now() < item.expiration
  );

  if (otpIndex !== -1) {
    userOtps.splice(otpIndex, 1); // Remove the OTP once verified
    return true;
  }

  return false;
};
