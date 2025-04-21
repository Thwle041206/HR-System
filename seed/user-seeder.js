/**
 * This script seeds the User collection in the MongoDB database.
 *
 * It first connects to the MongoDB database using Mongoose.
 * Then, it creates an array of new User instances with predefined data.
 * Each User instance represents a document that will be inserted into the User collection.
 *
 * Each User document has the following fields:
 * - type: The role of the user (e.g., "project_manager", "accounts_manager", "employee").
 * - email: The email address of the user.
 * - password: The hashed password of the user. The password is hashed using bcrypt.
 * - name: The name of the user.
 * - dateOfBirth: The date of birth of the user.
 * - contactNumber: The contact number of the user.
 *
 */

let User = require("../models/user");
let bcrypt = require("bcrypt-nodejs");
let mongoose = require("mongoose");

const db = require("../db");

db.connect()
  .then(() => console.log("Database connected"))
  .catch((err) => console.error("Database connection error", err));

let users = [
  new User({
    type: "project_manager",
    email: "pm@pm.com",
    password: bcrypt.hashSync("pm1234", bcrypt.genSaltSync(5), null),
    firstName: "Nguyen",
    lastName: "Van PM",
    gender: "Male",
    name: "Nguyen Van PM",
    birthName: "Nguyen Van A",
    profileImage: "/images/default-avatar.png",
    supervisor: null, // Will be set after admin is created
    dateOfBirth: new Date("1990-05-20"),
    contactNumber: "03331234567", // nên sửa format để match regex /^(0|\+84)(\d{9,10})$/
    personalEmail: "pm.personal@email.com",
    department: "IT",
    position: "Backend Developer",
    jobTitle: "Backend Developer",
    jobId: "PM001", // phải duy nhất cho mỗi user
    idNumber: "012345678901", // 12 số duy nhất
    startDate: new Date("2023-01-01"),
    employmentType: "Full-time",
    address: {
      details: "123 Đường ABC, gần trường XYZ",
      district: "Đống Đa",
      city: "Hà Nội"
    },
    birthplace: {
      city: "Hà Nội"
    },
    workExperience: "Senior", // optional nhưng nếu có sẽ tốt hơn
    Skills: ["NodeJS", "MongoDB"],
    isActive: true,
    profileImage: "",
    designation: "Leader",
    dateAdded: new Date()
  }),  

  new User({
    type: "admin",
    email: "admin@admin.com",
    password: bcrypt.hashSync("admin123", bcrypt.genSaltSync(5), null),
    firstName: "Nguyen",
    lastName: "Van PM",
    gender: "Male",
    name: "Nguyen Van PM",
    birthName: "Nguyen Van B",
    profileImage: "/images/default-avatar.png",
    supervisor: null, // Will be set after admin is created
    dateOfBirth: new Date("1990-05-20"),
    contactNumber: "03331234567", // nên sửa format để match regex /^(0|\+84)(\d{9,10})$/
    personalEmail: "pm.personal@email.com",
    department: "IT",
    position: "Backend Developer",
    jobTitle: "Backend Developer",
    jobId: "A001", // phải duy nhất cho mỗi user
    idNumber: "012345678902", // 12 số duy nhất
    startDate: new Date("2023-01-01"),
    employmentType: "Full-time",
    address: {
      details: "123 Đường ABC, gần trường XYZ",
      district: "Đống Đa",
      city: "Hà Nội"
    },
    birthplace: {
      city: "Hà Nội"
    },
    workExperience: "Senior", // optional nhưng nếu có sẽ tốt hơn
    Skills: ["NodeJS", "MongoDB"],
    isActive: true,
    profileImage: "",
    designation: "Leader",
    dateAdded: new Date()
  }),  

  new User({
    type: "accounts_manager",
    email: "am@am.com",
    password: bcrypt.hashSync("am1234", bcrypt.genSaltSync(5), null),
    firstName: "Nguyen",
    lastName: "Van PM",
    gender: "Male",
    name: "Nguyen Van PM",
    birthName: "Nguyen Van C",
    profileImage: "/images/default-avatar.png",
    supervisor: null, // Will be set after admin is created
    dateOfBirth: new Date("1990-05-20"),
    contactNumber: "03331234567", // nên sửa format để match regex /^(0|\+84)(\d{9,10})$/
    personalEmail: "pm.personal@email.com",
    department: "IT",
    position: "Backend Developer",
    jobTitle: "Backend Developer",
    jobId: "AM001", // phải duy nhất cho mỗi user
    idNumber: "012345678903", // 12 số duy nhất
    startDate: new Date("2023-01-01"),
    employmentType: "Full-time",
    address: {
      details: "123 Đường ABC, gần trường XYZ",
      district: "Đống Đa",
      city: "Hà Nội"
    },
    birthplace: {
      city: "Hà Nội"
    },
    workExperience: "Senior", // optional nhưng nếu có sẽ tốt hơn
    Skills: ["NodeJS", "MongoDB"],
    isActive: true,
    profileImage: "",
    designation: "Leader",
    dateAdded: new Date()
  }),  

  new User({
    type: "employee",
    email: "employee1@employee.com",
    password: bcrypt.hashSync("123456", bcrypt.genSaltSync(5), null),
    firstName: "Nguyen",
    lastName: "Van PM",
    gender: "Male",
    name: "Nguyen Van PM",
    birthName: "Nguyen Van D",
    profileImage: "/images/default-avatar.png",
    supervisor: null, // Will be set after admin is created
    dateOfBirth: new Date("1990-05-20"),
    contactNumber: "03331234567", // nên sửa format để match regex /^(0|\+84)(\d{9,10})$/
    personalEmail: "pm.personal@email.com",
    department: "IT",
    position: "Backend Developer",
    jobTitle: "Backend Developer",
    jobId: "EM001", // phải duy nhất cho mỗi user
    idNumber: "012345678904", // 12 số duy nhất
    startDate: new Date("2023-01-01"),
    employmentType: "Full-time",
    address: {
      details: "123 Đường ABC, gần trường XYZ",
      district: "Đống Đa",
      city: "Hà Nội"
    },
    birthplace: {
      city: "Hà Nội"
    },
    workExperience: "Senior", // optional nhưng nếu có sẽ tốt hơn
    Skills: ["NodeJS", "MongoDB"],
    isActive: true,
    profileImage: "",
    designation: "Leader",
    dateAdded: new Date()
  }),  

    new User({
      type: "employee",
      email: "employee2@employee.com",
      password: bcrypt.hashSync("123456", bcrypt.genSaltSync(5), null),
    firstName: "Nguyen",
    lastName: "Van PM",
    gender: "Male",
    name: "Nguyen Van PM",
    birthName: "Nguyen Van E",
    profileImage: "/images/default-avatar.png",
    supervisor: null, // Will be set after admin is created
    dateOfBirth: new Date("1990-05-20"),
    contactNumber: "03331234567", // nên sửa format để match regex /^(0|\+84)(\d{9,10})$/
    personalEmail: "pm.personal@email.com",
    department: "IT",
    position: "Backend Developer",
    jobTitle: "Backend Developer",
    jobId: "EM002", // phải duy nhất cho mỗi user
    idNumber: "012345678905", // 12 số duy nhất
    startDate: new Date("2023-01-01"),
    employmentType: "Full-time",
    address: {
      details: "123 Đường ABC, gần trường XYZ",
      district: "Đống Đa",
      city: "Hà Nội"
    },
    birthplace: {
      city: "Hà Nội"
    },
    workExperience: "Senior", // optional nhưng nếu có sẽ tốt hơn
    Skills: ["NodeJS", "MongoDB"],
    isActive: true,
    profileImage: "",
    designation: "Leader",
    dateAdded: new Date()
  }),  
];

(async function () {
  // First create all users
  for (let user of users) {
    let existingUser = await User.findOne({ email: user.email });
    if (existingUser) {
      console.log(`User with email ${user.email} already exists.`);
      break;
    } else {
      await user.save();
    }
  }

  // Get admin user to be supervisor
  const admin = await User.findOne({ type: 'admin' });
  
  // Update all non-admin users to have admin as supervisor
  await User.updateMany(
    { type: { $ne: 'admin' } },
    { supervisor: admin._id }
  );

  exit();
})();

function exit() {
  mongoose.disconnect();
  console.log("Users Added...")
}
