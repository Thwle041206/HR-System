var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var AttendanceSchema = new Schema({
  employeeID: { type: Schema.Types.ObjectId, ref: "User", required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  date: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['present', 'late', 'halfDay', 'remote', 'overtime', 'absent'],
    default: 'present'
  },
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  workHours: { type: Number, default: 0 },
  overtime: { type: Number, default: 0 },
  notes: { type: String },
  edited: { type: Boolean, default: false },
  editRequest: {
    requested: { type: Boolean, default: false },
    reason: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Attendance", AttendanceSchema);
