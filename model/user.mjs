import mongoose, { Schema } from "mongoose";

const userschema = Schema({
  userName: { type: String, required: true },
  pdfAddress: { type: String, unique: true, required: false },
  location: { type: String, required: false },
  jobTitle: [{ type: String, required: false }],
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function (v) {
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
      },
      message: (props) => `${props.value} is not a valid email!`,
    },
  },
  password: { type: String, required: true },
  appliedJobs: { type: String, required: false },
});

export const User = mongoose.model("User", userschema);
