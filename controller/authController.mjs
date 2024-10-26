import Joi from "joi";
import { User } from "../model/user.mjs"; // Assuming your user model is correctly exported
import multer from "multer";
import path from "path"; // Import path module
import { fileURLToPath } from "url"; // Required for handling __dirname with ES modules
import { createAccessToken, createRefreashToken } from "../jwtToken.mjs";
import { createReadStream } from "fs";
import bcrypt from "bcrypt";
import fs from "fs";
import mongoose from "mongoose";

// To handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define user schema for validation
const userSchema = Joi.object({
  username: Joi.string().min(3).max(30).required().messages({
    "string.base": "Username must be a string",
    "string.empty": "Username cannot be empty",
    "string.min": "Username must be at least {#limit} characters long",
    "string.max": "Username must be at most {#limit} characters long",
    "any.required": "Username is required",
  }),

  email: Joi.string()
    .pattern(new RegExp("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"))
    .required()
    .messages({
      "string.base": "Email must be a string",
      "string.empty": "Email cannot be empty",
      "string.pattern.base": "Email must be a valid email format",
      "any.required": "Email is required",
    }),

  password: Joi.string()
    .pattern(new RegExp("^[a-zA-Z0-9]{3,30}$"))
    .required()
    .messages({
      "string.base": "Password must be a string",
      "string.empty": "Password cannot be empty",
      "string.pattern.base": "Password must be 3 to 30 alphanumeric characters",
      "any.required": "Password is required",
    }),

  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "string.base": "Confirm Password must be a string",
    "any.only": "Confirm Password must match the Password",
    "any.required": "Confirm Password is required",
  }),
});

// Set up Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public"));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = "PFP_" + uniqueName + path.extname(file.originalname);
    cb(null, newFilename);
  },
});

const upload = multer({ storage: storage }).single("pdfFile");

export const signup = async (req, res) => {
  // Ensure DB is connected
  if (mongoose.connection.readyState !== 1) {
    return res
      .status(500)
      .json({ error: "Database connection issue. Please try again later." });
  }

  upload(req, res, async (err) => {
    if (err) return res.status(500).json({ error: "Error uploading file" });

    const { username, password, confirmPassword, email, location, jobTitle } =
      req.body;

    try {
      // Validate request data
      await userSchema.validateAsync({
        username,
        password,
        confirmPassword,
        email,
      });

      // Hash the password
      const Hpassword = await bcrypt.hash(password, 10);

      // Define final upload path after validation succeeds
      const uploadDir = path.join(__dirname, "../public/uploads");
      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });

      const finalFilePath = path.join(uploadDir, req.file.filename);

      // Move file only if validation passes
      fs.rename(req.file.path, finalFilePath, (err) => {
        if (err) {
          console.error("File moving error:", err);
          return res.status(500).json({ error: "Error moving the file" });
        }
      });

      // Create new user instance
      const newUser = new User({
        userName: username,
        pdfAddress: finalFilePath,
        location,
        jobTitle,
        email,
        password: Hpassword,
      });

      // Save new user to the database
      let payload = await newUser.save();

      payload = {
        _id: payload._id,
        username: payload.userName,
      };

      const accessToken = await createAccessToken(payload);
      const refreshToken = await createRefreashToken(payload);

      res.cookie("access_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 15 * 60 * 1000 * 8,
      });

      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      // Delete the uploaded file if any error occurs
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      if (error.isJoi) {
        return res.status(400).json({ error: error.details[0].message });
      }
      return res.status(500).json({ error: error.message });
    }
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists with the provided email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Compare provided password with hashed password in database
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Create payload for tokens
    const payload = {
      _id: user._id,
      username: user.userName,
    };

    // Generate access and refresh tokens
    const accessToken = await createAccessToken(payload);
    const refreshToken = await createRefreashToken(payload);

    // Set tokens in cookies
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000 * 8,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ message: "Login successful" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

async function hashPassword(password) {
  //hash password
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
}
