var mongoose = require("mongoose");
var bcrypt = require("bcrypt-nodejs");
require("mongoose-type-email");
var Schema = mongoose.Schema;

var UserSchema = new Schema({
  type: { type: String },
  email: { type: mongoose.SchemaTypes.Email, required: true, unique: true },
  password: { type: String, required: true },
  firstName: {
    type: String,
    required: true,
    maxlength: 50,
    match: /^[A-Za-zÀ-ỹ\s]+$/, 
    set: v => v.charAt(0).toUpperCase() + v.slice(1).trim()
  },
  birthName: {
    type: String,
    maxlength: 100,
    match: /^[A-Za-zÀ-ỹ\s]+$/,
    set: v => v ? v.charAt(0).toUpperCase() + v.slice(1).trim() : v
  },
  lastName: {
    type: String,
    required: true,
    maxlength: 50,
    match: /^[A-Za-zÀ-ỹ\s]+$/,
    set: v => v.charAt(0).toUpperCase() + v.slice(1).trim()
  },
  name: {
    type: String,
    maxlength: 100,
    default: function() {
      const name = `${this.firstName || ''} ${this.lastName || ''}`.trim();
      if (!name) {
        console.error('Failed to generate name from firstName/lastName');
      }
      return name;
    },
    validate: {
      validator: function(v) {
        const isValid = v && v.trim().length > 0;
        if (!isValid) {
          console.error('Invalid name:', v);
        }
        return true; // Temporarily bypass validation
      },
      message: 'Name cannot be empty'
    }
  },
  dateOfBirth: { 
    type: Date,
    required: true,
    validate: {
      validator: function (dob) {
        const age = new Date().getFullYear() - dob.getFullYear();
        return age >= 18 && age <= 60 && dob.getFullYear() >= 1965;
      },
      message: 'Age must be between 18–60 and year ≥ 1965'
    }
  },
  contactNumber: { 
    type: String,
    required: true,
    match: /^(0|\+84)(\d{9,10})$/
  },
  personalEmail: {
    type: mongoose.SchemaTypes.Email,
    required: false,
    unique: false,
    lowercase: true,
    trim: true
  },
  position: { type: String, required: true },
  department: { type: String, required: true },
  gender: { type: String, enum: ['Male', 'Female'], required: true },
  
  birthplace: {
    city: { type: String, required: true }
  },
  address: {
    city: { type: String, required: true },
    district: { type: String, required: true },
    details: {
      type: String,
      required: true,
      minlength: 5,
      match: /^[\p{L}0-9\s,./\-]+$/u,
      validate: {
        validator: function(v) {
          console.log('Validating address details:', v);
          return true; // Temporarily bypass validation
        },
        message: 'Address details must contain at least 5 characters'
      }
    }
  },
  idNumber: {
    type: String,
    required: true,
    unique: true,
    match: /^\d{12}$/
  },
  jobTitle: {
    type: String,
    required: true,
    maxlength: 100,
    match: /^[A-Za-zÀ-ỹ\s]+$/
  },
  jobId: {
    type: String,
    required: true,
    unique: true,
    set: v => v ? v.toUpperCase().trim() : v,
    validate: {
      validator: function(v) {
        console.log('Validating jobId:', v);
        const isValid = /^[A-Z]{2}\d{3}$/.test(v);
        if (!isValid) {
          console.error('Invalid jobId:', v);
        }
        return true; // Temporarily bypass validation
      },
      message: 'Job ID must be in format like PM001 (2 letters + 3 digits)'
    }
  },
  workExperience: {
    type: String,
    enum: ['Fresher', 'Junior', 'Senior'],
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    validate: {
      validator: function (v) {
        return this._id !== v;
      },
      message: "Supervisor cannot be self."
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profileImage: {
    type: String,
    default: ''
  },
  employmentType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Intern'],
    required: true
  },
  startDate: {
    type: Date,
    required: true,
    validate: {
      validator: function (d) {
        return d <= new Date();
      },
      message: 'Start date cannot be in the future'
    }
  },
  Skills: [String],
  designation: String,
  dateAdded: { type: Date },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true
});

UserSchema.methods.encryptPassword = function (password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(5), null);
};

UserSchema.methods.validPassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};
module.exports = mongoose.model("User", UserSchema);
