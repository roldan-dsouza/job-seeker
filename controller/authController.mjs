import Joi from "joi";
import { User } from "../model/user.mjs"; // Assuming your user model is correctly exported
import multer from "multer";
import path from "path"; // Import path module
import { fileURLToPath } from "url"; // Required for handling __dirname with ES modules

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
  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ error: "Error uploading file" });
    }

    const { username, password, confirmPassword, email, location, jobTitle } =
      req.body;

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Get the path of the saved file
      const filePath = req.file.path; // This will store the path to the uploaded PDF

      // Validate the request body against the user schema
      await userSchema.validateAsync({
        username,
        password,
        confirmPassword,
        email,
      });

      // Create a new user instance
      const newUser = new User({
        userName: username,
        pdfAddress: filePath, // Store the path of the uploaded file
        location,
        jobTitle,
        email,
        password,
      });

      // Save the new user to the database
      await newUser.save();
      return res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      // Handle validation errors
      if (error.isJoi) {
        return res.status(400).json({ error: error.details[0].message });
      }

      // Handle other errors (e.g., database errors)
      return res.status(500).json({ error: error.message });
    }
  });
};
