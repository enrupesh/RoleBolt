import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  isVerified: boolean;
  githubId?: string;
  googleId?: string;
  microsoftId?: string;
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
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, default: "" },
    name:         { type: String, default: "" },
    isVerified:   { type: Boolean, default: false },
    githubId:     { type: String, index: true, sparse: true },
    googleId:     { type: String, index: true, sparse: true },
    microsoftId:  { type: String, index: true, sparse: true },
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
