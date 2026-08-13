import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email?: string;
  username?: string;
  passwordHash: string;
  name: string;
  signupRole?: "creator" | "seeker";
  isVerified: boolean;
  githubId?: string;
  googleId?: string;
  phoneNumber?: string;
  phoneId?: string;
  verificationToken?: string;
  verificationTokenExpiry?: Date;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: false,
      unique: true,
      lowercase: true,
      trim: true,
      sparse: true,
      index: true,
    },
    username: {
      type: String,
      required: false,
      unique: true,
      lowercase: true,
      trim: true,
      sparse: true,
      index: true,
    },
    passwordHash: { type: String, default: "" },
    name:         { type: String, default: "" },
    signupRole:   { type: String, enum: ["creator", "seeker"] },
    isVerified:   { type: Boolean, default: false },
    githubId:     { type: String, index: true, sparse: true },
    googleId:     { type: String, index: true, sparse: true },
    phoneNumber:  { type: String, index: true, sparse: true, unique: true },
    phoneId:      { type: String, index: true, sparse: true },
    verificationToken:       { type: String, index: true, sparse: true },
    verificationTokenExpiry: { type: Date },
    resetToken:              { type: String, index: true, sparse: true },
    resetTokenExpiry:        { type: Date },
  },
  { timestamps: true }
);

export const User =
  mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema);
