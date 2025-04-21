var express = require("express");
var router = express.Router();
var Leave = require("../models/leave");
var Attendance = require("../models/attendance");
var Project = require("../models/project");
var moment = require("moment");
var User = require("../models/user");
const csrf = require("csurf");
const { isLoggedIn, isEmployee } = require("./middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
// Cấu hình CSRF protection
const csrfProtection = csrf();
router.use(csrfProtection);

// Áp dụng middleware xác thực cho tất cả các route
router.use(isLoggedIn);
router.use(isEmployee);

/**
 * Displays home page to the employee.
 */
router.get("/", async function viewHome(req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get employee's statistics
    const [
      totalProjects,
      totalLeaves,
      pendingLeaves,
      todayAttendance,
      monthAttendance
    ] = await Promise.all([
      // Count total projects assigned to employee
      Project.countDocuments({ employeeID: req.user._id }),
      
      // Count total leaves
      Leave.countDocuments({ applicantID: req.user._id }),
      
      // Count pending leaves
      Leave.countDocuments({ 
        applicantID: req.user._id,
        adminResponse: "Pending"
      }),
      
      // Check today's attendance
      Attendance.findOne({
        employeeID: req.user._id,
        date: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear()
      }),
      
      // Get current month attendance
      Attendance.countDocuments({
        employeeID: req.user._id,
        month: today.getMonth() + 1,
        year: today.getFullYear()
      })
    ]);

    res.render("Employee/employeeHome", {
      title: "Home",
      userName: req.user.name,
      csrfToken: req.csrfToken(),
      totalProjects,
      totalLeaves,
      pendingLeaves,
      todayAttendance: todayAttendance ? "Present" : "Absent",
      monthAttendance,
      moment: moment
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).send("Error loading dashboard");
  }
});

/**
 * Dashboard route for employee
 * This displays statistics about attendance, leaves, projects and other metrics
 */
router.get("/dashboard", async function viewDashboard(req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get employee's statistics
    const [
      totalProjects,
      totalLeaves,
      pendingLeaves,
      todayAttendance,
      monthAttendance
    ] = await Promise.all([
      // Count total projects assigned to employee
      Project.countDocuments({ employeeID: req.user._id }),
      
      // Count total leaves
      Leave.countDocuments({ applicantID: req.user._id }),
      
      // Count pending leaves
      Leave.countDocuments({ 
        applicantID: req.user._id,
        adminResponse: "Pending"
      }),
      
      // Check today's attendance
      Attendance.findOne({
        employeeID: req.user._id,
        date: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear()
      }),
      
      // Get current month attendance
      Attendance.countDocuments({
        employeeID: req.user._id,
        month: today.getMonth() + 1,
        year: today.getFullYear()
      })
    ]);

    res.render("Employee/dashboard", {
      title: "Dashboard",
      csrfToken: req.csrfToken(),
      userName: req.user.name,
      totalProjects,
      totalLeaves,
      pendingLeaves,
      todayAttendance: todayAttendance ? "Present" : "Absent",
      monthAttendance,
      moment: moment
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).send("Error loading dashboard");
  }
});

/**
 * Displays leave application form to the user.
 */

router.get("/apply-for-leave", function applyForLeave(req, res, next) {
  res.render("Employee/applyForLeave", {
    title: "Apply for Leave",
    csrfToken: req.csrfToken(),
    userName: req.user.name,
  });
});

/**
 * Displays the list of all applied laves of the user.
 */

router.get("/applied-leaves", function viewAppliedLeaves(req, res, next) {
  var leaveChunks = [];

  //find is asynchronous function
  Leave.find({ applicantID: req.user._id })
    .sort({ _id: -1 })
    .exec(function getLeaves(err, docs) {
      var hasLeave = 0;
      if (docs.length > 0) {
        hasLeave = 1;
      }
      for (var i = 0; i < docs.length; i++) {
        leaveChunks.push(docs[i]);
      }

      res.render("Employee/appliedLeaves", {
        title: "List Of Applied Leaves",
        csrfToken: req.csrfToken(),
        hasLeave: hasLeave,
        leaves: leaveChunks,
        userName: req.user.name,
      });
    });
});

/**
 * Displays the attendance to the user.
 */

router.post("/view-attendance", function viewAttendanceSheet(req, res, next) {
  // Validate month and year data
  let month = parseInt(req.body.month);
  let year = parseInt(req.body.year);
  
  // Default to current month/year if values are invalid
  if (isNaN(month) || month < 1 || month > 12) {
    month = new Date().getMonth() + 1;
  }
  
  if (isNaN(year) || year < 1900 || year > 2100) {
    year = new Date().getFullYear();
  }
  
  var attendanceChunks = [];
  Attendance.find({
    employeeID: req.user._id,
    month: month,
    year: year,
  })
    .sort({ date: 1 })
    .exec(function getAttendance(err, docs) {
      if (err) {
        console.log(err);
        return res.status(500).send("Error fetching attendance data");
      }
      
      var found = 0;
      if (docs.length > 0) {
        found = 1;
      }
      
      // Calculate summary statistics
      let totalWorkHours = 0;
      let totalOvertimeHours = 0;
      let statusCounts = {
        present: 0,
        late: 0,
        halfDay: 0,
        overtime: 0,
        remote: 0,
        absent: 0
      };
      
      docs.forEach(doc => {
        attendanceChunks.push(doc);
        if (doc.workHours !== undefined && doc.workHours !== null && !isNaN(doc.workHours)) {
          totalWorkHours += parseFloat(doc.workHours);
        }
        if (doc.overtime !== undefined && doc.overtime !== null && !isNaN(doc.overtime)) {
          totalOvertimeHours += parseFloat(doc.overtime);
        }
        if (doc.status) statusCounts[doc.status]++;
      });
      
      // Calculate working days in the month
      const workingDays = getWorkingDaysInMonth(year, month - 1); // JS months are 0-indexed
      
      res.render("Employee/viewAttendance", {
        title: "Attendance Sheet",
        month: month,
        year: year,
        csrfToken: req.csrfToken(),
        found: found,
        attendance: attendanceChunks,
        moment: moment,
        userName: req.user.name,
        stats: {
          totalWorkHours: totalWorkHours.toFixed(2),
          totalOvertimeHours: totalOvertimeHours.toFixed(2),
          statusCounts: statusCounts,
          presentDays: statusCounts.present + statusCounts.overtime + statusCounts.late + statusCounts.halfDay + statusCounts.remote,
          absentDays: statusCounts.absent,
          workingDays: workingDays,
          attendance: ((statusCounts.present + statusCounts.overtime + statusCounts.late + statusCounts.halfDay + statusCounts.remote) / workingDays * 100).toFixed(1)
        }
      });
    });
});

/**
 * Display currently marked attendance to the user.
 */

router.get(
  "/view-attendance-current",
  function viewCurrentlyMarkedAttendance(req, res, next) {
    var attendanceChunks = [];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Ensure we have valid date values
    if (isNaN(currentMonth) || isNaN(currentYear)) {
      console.log("Invalid date values detected in view-attendance-current");
      return res.status(500).send("Error processing date values");
    }

    Attendance.find({
      employeeID: req.user._id,
      month: currentMonth,
      year: currentYear,
    })
      .sort({ date: 1 })
      .exec(function getAttendanceSheet(err, docs) {
        if (err) {
          console.log(err);
          return res.status(500).send("Error fetching attendance data");
        }
        
        var found = 0;
        if (docs.length > 0) {
          found = 1;
        }
        
        // Calculate summary statistics
        let totalWorkHours = 0;
        let totalOvertimeHours = 0;
        let statusCounts = {
          present: 0,
          late: 0,
          halfDay: 0,
          overtime: 0,
          remote: 0,
          absent: 0
        };
        
        docs.forEach(doc => {
          attendanceChunks.push(doc);
          if (doc.workHours !== undefined && doc.workHours !== null && !isNaN(doc.workHours)) {
            totalWorkHours += parseFloat(doc.workHours);
          }
          if (doc.overtime !== undefined && doc.overtime !== null && !isNaN(doc.overtime)) {
            totalOvertimeHours += parseFloat(doc.overtime);
          }
          if (doc.status) statusCounts[doc.status]++;
        });
        
        // Calculate working days in the month
        const workingDays = getWorkingDaysInMonth(currentYear, currentMonth - 1); // JS months are 0-indexed
        
        res.render("Employee/viewAttendance", {
          title: "Attendance Sheet",
          month: currentMonth,
          year: currentYear,
          csrfToken: req.csrfToken(),
          found: found,
          attendance: attendanceChunks,
          moment: moment,
          userName: req.user.name,
          stats: {
            totalWorkHours: totalWorkHours.toFixed(2),
            totalOvertimeHours: totalOvertimeHours.toFixed(2),
            statusCounts: statusCounts,
            presentDays: statusCounts.present + statusCounts.overtime + statusCounts.late + statusCounts.halfDay + statusCounts.remote,
            absentDays: statusCounts.absent,
            workingDays: workingDays,
            attendance: ((statusCounts.present + statusCounts.overtime + statusCounts.late + statusCounts.halfDay + statusCounts.remote) / workingDays * 100).toFixed(1)
          }
        });
      });
  }
);

/**
 * Displays employee his/her profile.
 */

router.get("/view-profile", function viewProfile(req, res, next) {
  User.findById(req.user._id, function getUser(err, user) {
    if (err) {
      console.log(err);
    }
    res.render("Employee/viewProfile", {
      title: "Profile",
      csrfToken: req.csrfToken(),
      employee: user,
      moment: moment,
      userName: req.user.name,
    });
  });
});

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/images/profile');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.user._id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

console.log('Multer upload configured with:');
console.log('Storage:', storage);
console.log('File filter:', fileFilter);
console.log('Upload directory:', path.join(__dirname, '../public/images/profile'));

// Handle profile updates with optional photo upload
router.post("/update-profile", upload.single('profilePhoto'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Handle file upload
    if (req.file) {
      // Delete old profile image if exists
      if (user.profileImage && user.profileImage !== '') {
        const oldImagePath = path.join(__dirname, '../public', user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Update user's profile image path
      const imagePath = '/images/profile/' + req.file.filename;
      user.profileImage = imagePath;
      await user.save();
      
      return res.json({
        success: true,
        imagePath: imagePath,
        message: 'Profile image updated successfully'
      });
    }

    console.log('Form submission received with workExperience:', req.body.workExperience);
    // Handle regular form submission
    const updates = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      birthName: req.body.birthName,
      dateOfBirth: new Date(req.body.dateOfBirth),
      gender: req.body.gender,
      personalEmail: req.body.personalEmail,
      contactNumber: req.body.contactNumber,
      idNumber: req.body.idNumber,
      position: req.body.position,
      jobId: req.body.jobId,
      department: req.body.department,
      workExperience: req.body.workExperience || null,
      startDate: req.body.startDate ? new Date(req.body.startDate) : null,
      birthplace: {
        city: req.body.birthplace?.city || req.body['birthplace[city]']
      },
      address: {
        city: req.body.address?.city || req.body['address[city]'],
        district: req.body.address?.district || req.body['address[district]'],
        details: req.body.address?.details || req.body['address[details]']
      }
    };

    // Update supervisor if provided
    if (req.body.supervisor) {
      updates.supervisor = req.body.supervisor;
    }

    // Update name field
    updates.name = `${updates.firstName} ${updates.lastName}`;

    Object.assign(user, updates);
    await user.save();
    
    return res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    req.flash('error', 'Failed to update profile');
    res.redirect("/employee/edit-profile");
  }
});
/**
 * Displays employee profile edit form
 */
// Enhanced Vietnam provinces API endpoints
router.get("/api/provinces", async (req, res) => {
  try {
    console.log("Fetching provinces from API...");
    const response = await fetch('https://provinces.open-api.vn/api/?depth=2');
    
    if (!response.ok) {
      console.error(`API response not OK: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Fetched ${data.length} provinces`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching provinces:', error);
    // Fallback data if API fails
    const fallback = [
      { name: 'Hà Nội', code: '01' },
      { name: 'Hồ Chí Minh', code: '79' }, 
      { name: 'Đà Nẵng', code: '48' }
    ];
    console.log('Using fallback provinces data');
    res.json(fallback);
  }
});

// Get districts for a province
router.get("/api/provinces/:code/districts", async (req, res) => {
  const { code } = req.params;
  console.log(`Fetching districts for province code: ${code}`);
  
  try {
    const response = await fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`);
    
    if (!response.ok) {
      console.error(`API response not OK: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.districts) {
      console.log(`Fetched ${data.districts.length} districts`);
      res.json(data.districts);
    } else {
      console.warn('No districts data found in response');
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching districts:', error);
    res.json([]);
  }
});

router.get("/edit-profile", async function editProfile(req, res, next) {
  try {
    const [employee, supervisors] = await Promise.all([
      User.findById(req.user._id),
      User.find({
        type: { $in: ["project_manager", "accounts_manager"] },
        _id: { $ne: req.user._id } // Exclude current user
      }).sort({ name: 1 })
    ]);
    
    res.render(path.join("Employee", "editProfile"), {
      title: "Edit Profile",
      csrfToken: req.csrfToken(),
      employee: employee,
      supervisors: supervisors,
      moment: moment,
      userName: req.user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading edit profile");
  }
});

/**
 * Displays the list of all the projects to the Project Schema.
 */

router.get("/view-all-projects", function viewAllProjects(req, res, next) {
  var projectChunks = [];
  Project.find({ employeeID: req.user._id })
    .sort({ _id: -1 })
    .exec(function getProjects(err, docs) {
      var hasProject = 0;
      if (docs.length > 0) {
        hasProject = 1;
      }
      for (var i = 0; i < docs.length; i++) {
        projectChunks.push(docs[i]);
      }
      res.render("Employee/viewPersonalProjects", {
        title: "List Of Projects",
        hasProject: hasProject,
        projects: projectChunks,
        csrfToken: req.csrfToken(),
        userName: req.user.name,
      });
    });
});

/**
 * Displays the employee his/her project infomation by
 * getting project id from the request parameters.
 */

router.get("/view-project/:project_id", function viewProject(req, res, next) {
  var projectId = req.params.project_id;
  Project.findById(projectId, function getProject(err, project) {
    if (err) {
      console.log(err);
      return res.status(500).send("Lỗi khi tải dự án");
    }
    
    if (!project) {
      return res.status(404).send("Không tìm thấy dự án");
    }
    
    res.render("Employee/viewProject", {
      title: "Project Details",
      project: project,
      csrfToken: req.csrfToken(),
      moment: moment,
      userName: req.user.name,
    });
  });
});

/**
 * Saves the applied leave application form in Leave Schema.
 */

router.post("/apply-for-leave", function applyForLeave(req, res, next) {
  var newLeave = new Leave();
  newLeave.applicantID = req.user._id;
  newLeave.title = req.body.title;
  newLeave.type = req.body.type;
  newLeave.startDate = new Date(req.body.start_date);
  newLeave.endDate = new Date(req.body.end_date);
  newLeave.period = req.body.period;
  newLeave.reason = req.body.reason;
  newLeave.appliedDate = new Date();
  newLeave.adminResponse = "Pending";
  newLeave.save(function saveLeave(err) {
    if (err) {
      console.log(err);
    }
    res.redirect("/employee/applied-leaves");
  });
});

/**
 * Marks the attendance of the employee in Attendance Schema
 */

router.post(
  "/mark-employee-attendance",
  function markEmployeeAttendance(req, res, next) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    
    // Determine status based on time
    let status = 'present';
    // If check-in after 9:30 AM, mark as late
    if (currentHour > 9 || (currentHour === 9 && currentMin > 30)) {
      status = 'late';
    }
    
    Attendance.findOne(
      {
        employeeID: req.user._id,
        month: now.getMonth() + 1,
        date: now.getDate(),
        year: now.getFullYear(),
      },
      function getAttendanceSheet(err, attendance) {
        if (err) {
          console.log(err);
          return res.status(500).send("Error processing attendance");
        }
        
        if (!attendance) {
          // First check-in of the day
          var newAttendance = new Attendance();
          newAttendance.employeeID = req.user._id;
          newAttendance.year = now.getFullYear();
          newAttendance.month = now.getMonth() + 1;
          newAttendance.date = now.getDate();
          newAttendance.status = status;
          newAttendance.checkInTime = now;
          newAttendance.workHours = 0; // Initialize with 0
          newAttendance.overtime = 0;  // Initialize with 0
          
          newAttendance.save(function saveAttendance(err) {
            if (err) {
              console.log(err);
              return res.status(500).send("Error saving attendance");
            }
            return res.redirect("/employee/view-attendance-current");
          });
        } else if (!attendance.checkOutTime) {
          // Check-out
          
          // Ensure we have a valid check-in time record
          if (!attendance.checkInTime) {
            console.log("Missing check-in time for user:", req.user._id);
            // Update record with check-in and check-out at the same time
            attendance.checkInTime = new Date(now.getTime() - (10 * 60 * 1000)); // Set check-in to 10 minutes ago
            attendance.checkOutTime = now;
            attendance.workHours = 0.17; // 10 minutes = 0.17 hours
            attendance.overtime = 0;
            attendance.status = status;
            
            attendance.save(function (err) {
              if (err) {
                console.log("Error saving attendance with default check-in time:", err);
                return res.status(500).send("Error updating attendance");
              }
              return res.redirect("/employee/view-attendance-current");
            });
            return;
          }
          
          const checkIn = new Date(attendance.checkInTime);
          const checkOut = now;
          
          // Validate dates before calculation
          if (!checkIn || isNaN(checkIn.getTime())) {
            console.log("Invalid check-in time:", attendance.checkInTime);
            
            // Fix the check-in time and continue instead of erroring out
            const fixedCheckIn = new Date(now.getTime() - (10 * 60 * 1000)); // Set to 10 minutes ago as fallback
            
            attendance.checkInTime = fixedCheckIn;
            attendance.checkOutTime = now;
            attendance.workHours = 0.17; // 10 minutes = 0.17 hours
            attendance.overtime = 0;
            
            attendance.save(function (err) {
              if (err) {
                console.log("Error saving attendance with fixed check-in time:", err);
                return res.status(500).send("Error updating attendance");
              }
              return res.redirect("/employee/view-attendance-current");
            });
            return;
          }
          
          // Calculate work hours (in decimals, e.g. 7.5 for 7 hours and 30 minutes)
          const diffMs = checkOut.getTime() - checkIn.getTime();
          
          // Ensure the time difference is positive and valid
          if (diffMs < 0) {
            console.log("Negative time difference between check-in and check-out");
            
            // Fix by setting check-out later than check-in
            attendance.checkOutTime = new Date(checkIn.getTime() + (10 * 60 * 1000)); // 10 minutes after check-in
            attendance.workHours = 0.17; // 10 minutes
            attendance.overtime = 0;
            
            attendance.save(function (err) {
              if (err) {
                console.log("Error saving attendance with fixed negative time:", err);
                return res.status(500).send("Error updating attendance");
              }
              return res.redirect("/employee/view-attendance-current");
            });
            return;
          }
          
          const diffHrs = diffMs / (1000 * 60 * 60);
          let workHours = parseFloat(diffHrs.toFixed(2));
          
          // Double-check that workHours is a valid number
          if (isNaN(workHours) || !isFinite(workHours)) {
            console.log("Invalid work hours calculation. Using default value 0.");
            workHours = 0;
          }
          
          // Calculate overtime (anything over 8 hours)
          let overtime = 0;
          if (workHours > 8 && isFinite(workHours)) {
            overtime = parseFloat((workHours - 8).toFixed(2));
            // Safety check for overtime
            if (isNaN(overtime) || !isFinite(overtime)) {
              overtime = 0;
            }
          }
          
          // Update status if needed
          let newStatus = attendance.status;
          if (workHours >= 4 && workHours < 8 && attendance.status !== 'late') {
            newStatus = 'halfDay';
          } else if (workHours >= 8 && overtime > 0) {
            newStatus = 'overtime';
          }
          
          // Update attendance record
          attendance.checkOutTime = checkOut;
          attendance.workHours = workHours;
          attendance.overtime = overtime;
          attendance.status = newStatus;
          
          attendance.save(function (err) {
            if (err) {
              console.log("Error saving attendance:", err);
              return res.status(500).send("Error updating attendance");
            }
            return res.redirect("/employee/view-attendance-current");
          });
        } else {
          // Already checked out for the day
          return res.render("Employee/attendanceMessage", {
            title: "Attendance Already Marked",
            message: "You have already completed your attendance for today.",
            userName: req.user.name,
            csrfToken: req.csrfToken()
          });
        }
      }
    );
  }
);

/**
 * Request to edit an attendance record
 */
router.post('/request-edit-attendance', function(req, res) {
  const { attendanceId, reason } = req.body;
  
  if (!attendanceId || !reason) {
    return res.status(400).send("Missing required information");
  }
  
  Attendance.findById(attendanceId, function(err, attendance) {
    if (err || !attendance) {
      return res.status(404).send("Attendance record not found");
    }
    
    // Check if this is the employee's own record
    if (attendance.employeeID.toString() !== req.user._id.toString()) {
      return res.status(403).send("Unauthorized to edit this record");
    }
    
    attendance.editRequest.requested = true;
    attendance.editRequest.reason = reason;
    attendance.editRequest.status = 'pending';
    
    attendance.save(function(err) {
      if (err) {
        console.log(err);
        return res.status(500).send("Error saving edit request");
      }
      
      return res.redirect('/employee/view-attendance-current');
    });
  });
});

/**
 * Helper function to get working days in a month (excluding weekends)
 */
function getWorkingDaysInMonth(year, month) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  let workingDays = 0;
  
  for (let day = startDate; day <= endDate; day.setDate(day.getDate() + 1)) {
    const dayOfWeek = day.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  
  return workingDays;
}
// Vietnam provinces API endpoints
router.get("/api/provinces", async (req, res) => {
  try {
    const provinces = [
      { name: 'Hà Nội', code: '01' },
      { name: 'Hồ Chí Minh', code: '79' },
      { name: 'Đà Nẵng', code: '48' },
      { name: 'Hải Phòng', code: '31' },
      { name: 'Cần Thơ', code: '92' }
    ];
    res.json(provinces);
  } catch (error) {
    console.error('Error fetching provinces:', error);
    res.status(500).json([]);
  }
});

// Get districts for a province
router.get("/api/provinces/:code/districts", async (req, res) => {
  try {
    const { code } = req.params;
    const districts = {
      '01': [
        { name: 'Ba Đình' },
        { name: 'Hoàn Kiếm' },
        { name: 'Hai Bà Trưng' }
      ],
      '79': [
        { name: 'Quận 1' },
        { name: 'Quận 2' },
        { name: 'Quận 3' }
      ],
      '48': [
        { name: 'Hải Châu' },
        { name: 'Thanh Khê' },
        { name: 'Sơn Trà' }
      ],
      '31': [
        { name: 'Hồng Bàng' },
        { name: 'Lê Chân' },
        { name: 'Ngô Quyền' }
      ],
      '92': [
        { name: 'Ninh Kiều' },
        { name: 'Bình Thủy' },
        { name: 'Cái Răng' }
      ]
    };
    res.json(districts[code] || []);
  } catch (error) {
    console.error('Error fetching districts:', error);
    res.status(500).json([]);
  }
});

// Handle profile updates for employee
router.post("/update-profile", async (req, res) => {
    try {
      // 1. Get current user
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // 2. Parse nested fields
      const parsedBody = {};
      for (const key in req.body) {
        if (key.includes('[')) {
          const [parent, child] = key.replace(']', '').split('[');
          parsedBody[parent] = parsedBody[parent] || {};
          parsedBody[parent][child] = req.body[key]?.trim();
        } else {
          parsedBody[key] = req.body[key]?.trim();
        }
      }

      // 3. Validate required fields
      const requiredFields = [
        'firstName', 'lastName', 'dateOfBirth', 'gender',
        'contactNumber', 'idNumber', 'jobId', 'position',
        'department', 'birthplace[city]'
      ];
      
      const missingFields = requiredFields.filter(field => {
        if (field.includes('[')) {
          const [parent, child] = field.replace(']', '').split('[');
          return !parsedBody[parent]?.[child];
        }
        return !parsedBody[field];
      });

      if (missingFields.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields',
          missingFields: missingFields.map(f => f.replace(/\[.*\]/, ''))
        });
      }

      // 4. Handle file upload if present
      if (req.file) {
        // Delete old profile image if exists
        if (user.profileImage && user.profileImage !== '') {
          const oldImagePath = path.join(__dirname, '../public', user.profileImage);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        parsedBody.profileImage = '/images/profile/' + req.file.filename;
      }

      // 5. Prepare update data
      const updateData = {
        firstName: parsedBody.firstName,
        lastName: parsedBody.lastName,
        birthName: parsedBody.birthName,
        name: `${parsedBody.firstName} ${parsedBody.lastName}`,
        dateOfBirth: new Date(parsedBody.dateOfBirth),
        gender: parsedBody.gender,
        contactNumber: parsedBody.contactNumber,
        idNumber: parsedBody.idNumber,
        jobId: parsedBody.jobId,
        position: parsedBody.position,
        department: parsedBody.department,
        birthplace: parsedBody.birthplace || {},
        address: parsedBody.address || {},
        personalEmail: parsedBody.personalEmail?.trim() || null
      };

      if (parsedBody.profileImage) {
        updateData.profileImage = parsedBody.profileImage;
      }

      // 6. Apply updates and save
      Object.assign(user, updateData);
      await user.save();
      
      return res.json({
        success: true,
        message: 'Profile updated successfully',
        profileImage: user.profileImage
      });
    } catch (err) {
      console.error("Error updating profile:", err);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to update profile',
        error: err.message 
      });
  }
});
// Vietnam provinces API endpoints
router.get("/api/provinces", async (req, res) => {
  try {
    console.log("Fetching provinces from API...");
    const response = await fetch('https://provinces.open-api.vn/api/?depth=2');
    
    if (!response.ok) {
      console.error(`API response not OK: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Fetched ${data.length} provinces`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching provinces:', error);
    // Fallback data if API fails
    const fallback = [
      { name: 'Hà Nội', code: '01' },
      { name: 'Hồ Chí Minh', code: '79' }, 
      { name: 'Đà Nẵng', code: '48' }
    ];
    console.log('Using fallback provinces data');
    res.json(fallback);
  }
});

// Get districts for a province
router.get("/api/provinces/:code/districts", async (req, res) => {
  const { code } = req.params;
  console.log(`Fetching districts for province code: ${code}`);
  
  try {
    const response = await fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`);
    
    if (!response.ok) {
      console.error(`API response not OK: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.districts) {
      console.log(`Fetched ${data.districts.length} districts`);
      res.json(data.districts);
    } else {
      console.warn('No districts data found in response');
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching districts:', error);
    res.json([]);
  }
});

module.exports = router;
