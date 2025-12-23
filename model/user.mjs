import mongoose, { Schema } from "mongoose";

const userschema = Schema({
  userName: { type: String, required: false, sparse: true },
  pdfAddress: { type: String, required: false, sparse: true },
  formattedText: { type: String, sparse: true },
  location: { type: String, required: false, sparse: true },
  jobTitle: { type: String, required: false, sparse: true },
  skills: [{ type: String, sparse: true }],
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
  appliedJobs: { type: String, required: false, sparse: true },
  experience: { type: String, required: false, sparse: true },
});

export const User = mongoose.model("User", userschema);
