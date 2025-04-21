module.exports = router;
var express = require("express");
var router = express.Router();
var mongoose = require("mongoose");
var db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
// Ensure mongoose connection is ready
router.use(async (req, res, next) => {
  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      await db.connect();
    }
    next();
  } catch (err) {
    console.error("Database connection error:", err);
    res.status(500).send("Database connection error");
  }
});
var User = require("../models/user");
var UserSalary = require("../models/user_salary");
var PaySlip = require("../models/payslip");
var Leave = require("../models/leave");
var Attendance = require("../models/attendance");
var moment = require("moment");
var Project = require("../models/project");
var PerformanceAppraisal = require("../models/performance_appraisal");
const { isLoggedIn, isManager, isProjectManager, isAccountsManager } = require("./middleware");

// Middleware chung cho tất cả các route manager
router.use("/", isLoggedIn, isManager, function checkAuthentication(req, res, next) {
  next();
});

/**
 * Displays home to the manager
 */
router.get("/", async function viewHomePage(req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get manager's department
    const manager = await User.findById(req.user._id);
    
    // Get system statistics
    const [
      teamMembers,
      activeProjects,
      completedProjects,
      inProgressProjects,
      pendingLeaves,
      todayAttendance
    ] = await Promise.all([
      // Count team members in same department
      User.countDocuments({ 
        department: manager.department,
        type: "employee"
      }),
      
      // Count all active projects (all projects except completed ones)
      Project.countDocuments({ 
        status: { $ne: "Finished" }
      }),

      // Count completed projects
      Project.countDocuments({
        status: "Finished"
      }),

      // Count in progress projects specifically
      Project.countDocuments({
        status: "Ongoing"
      }),
      
      // Count pending leaves for team
      Leave.countDocuments({ 
        adminResponse: "Pending",
        department: manager.department
      }),
      
      // Get today's attendance count for team
      Attendance.countDocuments({
        date: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear(),
        department: manager.department
      })
    ]);

    // Debugging log
    console.log(`Dashboard Statistics: Active: ${activeProjects}, Completed: ${completedProjects}, In Progress: ${inProgressProjects}`);

    res.render("Manager/managerHome", {
      title: "Manager Home",
      csrfToken: req.csrfToken(),
      userName: req.user.name,
      teamMembers,
      activeProjects,
      completedProjects,
      inProgressProjects,
      pendingLeaves,
      todayAttendance,
      moment: moment
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).send("Error loading dashboard");
  }
});

/**
 * Dashboard route for Sprint 1
 * This displays statistics about users, attendance, and other metrics
 */
router.get("/dashboard", function viewDashboard(req, res, next) {
  const today = new Date();
  
  // Promise-based approach to get all counts in parallel
  Promise.all([
    User.countDocuments({ type: "admin" }),
    User.countDocuments({ type: { $in: ["project_manager", "accounts_manager"] } }),
    User.countDocuments({ type: "employee" }),
    // For attendance counts, we need to filter by date
    Attendance.countDocuments({ 
      date: { 
        $gte: new Date(today.setHours(0, 0, 0, 0)), 
        $lt: new Date(today.setHours(23, 59, 59, 999)) 
      },
      status: "Present"
    }),
    Attendance.countDocuments({ 
      date: { 
        $gte: new Date(today.setHours(0, 0, 0, 0)), 
        $lt: new Date(today.setHours(23, 59, 59, 999)) 
      },
      status: "Late"
    }),
    // Total employee count for calculating absent
    User.countDocuments({ type: { $in: ["employee", "project_manager", "accounts_manager"] } }),
    // Count active projects
    Project.countDocuments({ 
      status: "Ongoing",
      employeeID: req.user._id
    }),
    // Count completed projects
    Project.countDocuments({
      status: "Finished",
      employeeID: req.user._id
    })
  ])
  .then(results => {
    const [adminCount, managerCount, employeeCount, attendanceCount, lateCount, totalEmployeeCount, activeProjects, completedProjects] = results;
    
    // Calculate absent as total employees minus those present or late
    const absentCount = totalEmployeeCount - (attendanceCount + lateCount);
    
    res.render("Manager/dashboard", {
      title: "Dashboard",
      csrfToken: req.csrfToken(),
      userName: req.user.name,
      adminCount: adminCount,
      managerCount: managerCount,
      employeeCount: employeeCount,
      attendanceCount: attendanceCount,
      lateCount: lateCount,
      absentCount: absentCount,
      activeProjects: activeProjects,
      completedProjects: completedProjects
    });
  })
  .catch(err => {
    console.error("Error fetching dashboard data:", err);
    res.status(500).send("Error loading dashboard");
  });
});

// Route chỉ dành cho Project Manager
router.get("/view-employees", isProjectManager, function viewEmployees(req, res) {
  var userChunks = [];
  User.find({ type: "employee" })
    .sort({ _id: -1 })
    .exec(function getUser(err, docs) {
      for (var i = 0; i < docs.length; i++) {
        userChunks.push(docs[i]);
      }
      res.render("Manager/viewemp_project", {
        title: "List Of Employees",
        csrfToken: req.csrfToken(),
        users: userChunks,
        errors: 0,
        userName: req.user.name,
      });
    });
});

/**
 * Displays All the skills of the employee to the project manager.
 */

router.get(
  "/all-employee-skills/:id",
  function viewAllEmployeeSkills(req, res, next) {
    var employeeId = req.params.id;
    User.findById(employeeId, function getUser(err, user) {
      if (err) {
        console.log(err);
      }
      res.render("Manager/employeeSkills", {
        title: "List Of Employee Skills",
        employee: user,
        moment: moment,
        csrfToken: req.csrfToken(),
        userName: req.user.name,
      });
    });
  }
);

/**
 * Displays all the projects of the employee to the project manager
 */

router.get(
  "/all-employee-projects/:id",
  function viewAllEmployeeProjects(req, res, next) {
    var employeeId = req.params.id;
    var projectChunks = [];

    //find is asynchronous function
    Project.find({ employeeID: employeeId })
      .sort({ _id: -1 })
      .exec(function getProject(err, docs) {
        var hasProject = 0;
        if (docs.length > 0) {
          hasProject = 1;
        }
        for (var i = 0; i < docs.length; i++) {
          projectChunks.push(docs[i]);
        }
        User.findById(employeeId, function getUser(err, user) {
          if (err) {
            console.log(err);
          }
          res.render("Manager/employeeAllProjects", {
            title: "List Of Employee Projects",
            hasProject: hasProject,
            projects: projectChunks,
            csrfToken: req.csrfToken(),
            user: user,
            userName: req.user.name,
          });
        });
      });
  }
);

// Route chỉ dành cho Project Manager
router.get("/employee-project-info/:id", isProjectManager, function viewEmployeeProjectInfo(req, res, next) {
  var projectId = req.params.id;
  Project.findById(projectId, function getProject(err, project) {
    if (err) {
      console.log(err);
    }
    User.findById(project.employeeID, function getUser(err, user) {
      if (err) {
        console.log(err);
      }
      res.render("Manager/projectInfo", {
        title: "Employee Project Information",
        project: project,
        employee: user,
        moment: moment,
        csrfToken: req.csrfToken(),
        message: "",
        userName: req.user.name,
      });
    });
  });
});

// Route chỉ dành cho Project Manager
router.get("/provide-performance-appraisal/:id", isProjectManager, function providePerformanceAppraisal(req, res, next) {
  var employeeId = req.params.id;
  var userChunks = [];
  PerformanceAppraisal.find(
    { employeeID: employeeId },
    function getPerformanceAppraisal(err, pa) {
      if (pa.length > 0) {
        User.find({ type: "employee" }, function getUser(err, docs) {
          for (var i = 0; i < docs.length; i++) {
            userChunks.push(docs[i]);
          }
          res.render("Manager/viewemp_project", {
            title: "List Of Employees",
            csrfToken: req.csrfToken(),
            users: userChunks,
            errors: 1,
            userName: req.user.name,
          });
        });
      } else {
        User.findById(employeeId, function getUser(err, user) {
          if (err) {
            console.log(err);
          }
          res.render("Manager/performance_appraisal", {
            title: "Provide Performance Appraisal",
            csrfToken: req.csrfToken(),
            employee: user,
            moment: moment,
            message: "",
            userName: req.user.name,
          });
        });
      }
    }
  );
});

/**
 * Description:
 * Displays currently marked attendance to the manager.
 *
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
 */

router.get(
  "/view-attendance-current",
  function viewCurrentMarkedAttendance(req, res, next) {
    var attendanceChunks = [];

    Attendance.find({
      employeeID: req.user._id,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    })
      .sort({ _id: -1 })
      .exec(function getAttendanceSheet(err, docs) {
        var found = 0;
        if (docs.length > 0) {
          found = 1;
        }
        for (var i = 0; i < docs.length; i++) {
          attendanceChunks.push(docs[i]);
        }
        res.render("Manager/viewAttendance", {
          title: "Attendance Sheet",
          month: new Date().getMonth() + 1,
          csrfToken: req.csrfToken(),
          found: found,
          attendance: attendanceChunks,
          moment: moment,
          userName: req.user.name,
        });
      });
  }
);

/**
 * Description:
 * Displays leave application form for the manager to apply for leave
 *
 
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
 */

router.get("/apply-for-leave", function applyForLeave(req, res, next) {
  res.render("Manager/managerApplyForLeave", {
    title: "Apply for Leave",
    csrfToken: req.csrfToken(),
    userName: req.user.name,
  });
});

/**
 * Description:
 * Manager gets the list of all his/her applied leaves.
 *
 
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
 */

router.get("/applied-leaves", function appliedLeaves(req, res, next) {
  var leaveChunks = [];

  //find is asynchronous function
  Leave.find({ applicantID: req.user._id })
    .sort({ _id: -1 })
    .exec(function getLeave(err, docs) {
      var hasLeave = 0;
      if (docs.length > 0) {
        hasLeave = 1;
      }
      for (var i = 0; i < docs.length; i++) {
        leaveChunks.push(docs[i]);
      }

      res.render("Manager/managerAppliedLeaves", {
        title: "List Of Applied Leaves",
        csrfToken: req.csrfToken(),
        hasLeave: hasLeave,
        leaves: leaveChunks,
        userName: req.user.name,
      });
    });
});

/**
 * Description:
 * Displays logged in manager his/her profile.
 *
 * Author: Hassan Qureshi
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
 */


// View profile
router.get("/view-profile", async function(req, res) {
    try {
      const user = await User.findById(req.user._id);
      res.render("Manager/viewManagerProfile", {
        title: "Profile",
        csrfToken: req.csrfToken(),
        employee: user,
        moment: moment,
        userName: req.user.name
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Error loading profile");
    }
  });
  


/**
 * Description:
 * Gets the id of the project to be shown form request parameters.
 * Displays the project to the project manager.
 *
 * Author: Hassan Qureshi
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
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
    
    res.render("Manager/viewManagerProject", {
      title: "Project Details",
      project: project,
      csrfToken: req.csrfToken(),
      moment: moment,
      userName: req.user.name,
    });
  });
});

/**
 * Description:
 * Displays list of all the project managers project.
 *
 * Author: Hassan Qureshi
 *
 * Last Updated: 30th November, 2016 Salman Nizam
 *
 * Known Bugs: None
 */

router.get(
  "/view-all-personal-projects",
  function viewAllPersonalProjects(req, res, next) {
    var projectChunks = [];
    Project.find({ employeeID: req.user._id })
      .sort({ _id: -1 })
      .exec(function getProject(err, docs) {
        var hasProject = 0;
        if (docs.length > 0) {
          hasProject = 1;
        }
        for (var i = 0; i < docs.length; i++) {
          projectChunks.push(docs[i]);
        }
        res.render("Manager/viewManagerPersonalProjects", {
          title: "List Of Projects",
          hasProject: hasProject,
          projects: projectChunks,
          csrfToken: req.csrfToken(),
          userName: req.user.name,
        });
      });
  }
);

/**
 * Route hiển thị tất cả các dự án của manager
 */
router.get("/view-projects", function viewProjects(req, res, next) {
  // Lấy tham số sắp xếp và lọc từ query
  const sort = req.query.sort || 'startDate';
  const statusFilter = req.query.status;
  
  // Định nghĩa cách sắp xếp
  let sortOptions = {};
  
  switch(sort) {
    case 'title':
      sortOptions = { title: 1 }; // Sắp xếp theo tiêu đề tăng dần
      break;
    case 'type':
      sortOptions = { type: 1 }; // Sắp xếp theo loại tăng dần
      break;
    case 'status':
      sortOptions = { status: 1 }; // Sắp xếp theo trạng thái tăng dần
      break;
    case 'endDate':
      sortOptions = { endDate: -1 }; // Sắp xếp theo ngày kết thúc giảm dần
      break;
    default:
      sortOptions = { startDate: -1 }; // Mặc định sắp xếp theo ngày bắt đầu giảm dần
  }
  
  // Xây dựng điều kiện lọc
  let query = {};
  
  // Lọc theo trạng thái nếu được chỉ định
  if (statusFilter) {
    if (statusFilter === 'completed') {
      query.status = 'Finished';
    } else if (statusFilter === 'in-progress') {
      query.status = 'Ongoing';
    } else if (statusFilter === 'not-started') {
      query.status = 'Not started';
    }
  }
  
  console.log("Đang truy vấn dự án...", "Lọc:", query);
  
  // Truy vấn dự án với điều kiện lọc
  Project.find(query)
    .sort(sortOptions)
    .exec(function(err, projects) {
      if (err) {
        console.error("Error fetching projects:", err);
        return res.status(500).send("Lỗi khi tải dự án");
      }
      
      console.log(`Tìm thấy ${projects.length} dự án`);
      
      // Render template với dữ liệu
      res.render("Manager/viewProjects", {
        title: "Danh sách Dự án",
        projects: projects,
        csrfToken: req.csrfToken(),
        userName: req.user.name,
        moment: moment,
        currentSort: sort,
        statusFilter: statusFilter
      });
    });
});

/**
 * Description:
 * Checks if pay slip has already been generated.
 * If yes then fills the field of the form with current attributes.
 * Then displays the pay slip form for the employee to the project manager.
 *
 * Author: Hassan Qureshi
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
 */

router.get(
  "/generate-pay-slip/:employee_id",
  function generatePaySlip(req, res, next) {
    var employeeId = req.params.employee_id;
    User.findById(employeeId, function getUser(err, user) {
      if (err) {
        console.log(err);
      }
      PaySlip.find({ employeeID: employeeId }, function getPaySlip(err, docs) {
        var pay_slip;
        var hasPaySlip = 0;
        if (docs.length > 0) {
          hasPaySlip = 1;
          pay_slip = docs[0];
        } else {
          var newPS = new PaySlip();
          newPS.accountManagerID = req.user._id;
          newPS.employeeID = employeeId;
          newPS.bankName = "abc";
          newPS.branchAddress = "abc";
          newPS.basicPay = 0;
          newPS.overtime = 0;
          newPS.conveyanceAllowance = 0;

          newPS.save(function savePaySlip(err) {
            if (err) {
              console.log(err);
            }
            pay_slip = newPS;
          });
        }

        setTimeout(render_view, 900);
        function render_view() {
          res.render("Manager/generatePaySlip", {
            title: "Generate Pay Slip",
            csrfToken: req.csrfToken(),
            employee: user,
            pay_slip: pay_slip,
            moment: moment,
            hasPaySlip: hasPaySlip,
            userName: req.user.name,
          });
        }
      });
    });
  }
);

/**
 * Description:
 * Reads the parameters from the body of the post request.
 * Then saves the applied leave to the leave schema.
 *
 
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
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
    res.redirect("/manager/applied-leaves");
  });
});

/**
 * Description:
 * Sets the bonus of the selected employee in UserSalary Schema
 *
 
 *
 * Last Updated: 30th Novemebr, 2016
 *
 * Known Bugs: None
 */

router.post("/set-bonus", function setBonus(req, res) {
  UserSalary.findOne(
    { employeeID: req.body.employee_bonus },
    function getUser(err, us) {
      if (err) {
        console.log(err);
      }
      us.bonus = req.body.bonus;
      us.reason = req.body.reason;
      us.save(function saveUserSalary(err) {
        if (err) {
          console.log(err);
        }
        res.redirect("/manager/view-employees");
      });
    }
  );
});

/**
 * Description:
 * Sets the salary of the selected employee in UserSalary Schema
 *
 
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
 */

router.post("/set-salary", function setSalary(req, res) {
  var employee_id = req.body.employee_salary;
  UserSalary.findOne({ employeeID: employee_id }, function (err, us) {
    if (err) {
      console.log(err);
    }
    console.log(us);
    us.salary = Number(req.body.salary);
    us.save(function setUserSalary(err) {
      if (err) {
        console.log(err);
      }
      res.redirect("/manager/view-employees");
    });
  });
});

/**
 * Description:
 * Sets the Incremented salary of the selected employee in UserSalary Schema
 *
 * Author: Hassan Qureshi
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
 */

router.post("/increment-salary", function incrementSalary(req, res) {
  UserSalary.findOne(
    { employeeID: req.body.employee_increment },
    function getUserSalary(err, us) {
      if (err) {
        console.log(err);
      }
      us.salary =
        Number(req.body.current_salary) + Number(req.body.amount_increment);
      us.save(function saveUserSalary(err) {
        if (err) {
          console.log(err);
        }
        res.redirect("/manager/view-employees");
      });
    }
  );
});

/**
 * Description:
 * Saves the performance appraisal of the employee against the employeeID in the PaySlip Schema.
 *
 * Author: Hassan Qureshi
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
 */

router.post(
  "/provide-performance-appraisal",
  function providePerformanceAppraisal(req, res) {
    var employeeId = req.body.employee_id;
    var newPerformanceAppraisal = new PerformanceAppraisal();
    newPerformanceAppraisal.employeeID = employeeId;
    newPerformanceAppraisal.projectManagerID = req.user._id;
    newPerformanceAppraisal.rating = req.body.performance_rating;
    newPerformanceAppraisal.positionExpertise = req.body.expertise;
    newPerformanceAppraisal.approachTowardsQualityOfWork =
      req.body.approach_quality;
    newPerformanceAppraisal.approachTowardsQuantityOfWork =
      req.body.approach_quantity;
    newPerformanceAppraisal.leadershipManagementSkills = req.body.lead_manage;
    newPerformanceAppraisal.communicationSkills = req.body.skills_com;
    newPerformanceAppraisal.commentsOnOverallPerformance = req.body.comments;
    newPerformanceAppraisal.save(function savePerformanceAppraisal(err) {
      if (err) {
        console.log(err);
      }
      res.redirect("/manager/view-employees");
    });
  }
);

/**
 * Description:
 * Stores the Pay Slip of employee in PaySlip schema if  not already stored
 *
 
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
 */

router.post("/generate-pay-slip", function generatePaySlip(req, res) {
  var employeeId = req.body.employee_id;
  PaySlip.find({ employeeID: employeeId }, function getPaySlip(err, docs) {
    if (err) {
      console.log(err);
    }
    docs[0].bankName = req.body.bname;
    docs[0].branchAddress = req.body.baddress;
    docs[0].basicPay = req.body.pay;
    docs[0].overtime = req.body.otime;
    docs[0].conveyanceAllowance = req.body.allowance;
    docs[0].save(function savePaySlip(err) {
      if (err) {
        console.log(err);
      }
      res.redirect("/manager/view-employees");
    });
  });
});

/**
 * Description:
 * Displays attendance to the manager for the given year and month.
 *
 * Author: Hassan Qureshi
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
 */

router.post("/view-attendance", function viewAttendance(req, res, next) {
  var attendanceChunks = [];
  Attendance.find({
    employeeID: req.user._id,
    month: req.body.month,
    year: req.body.year,
  })
    .sort({ _id: -1 })
    .exec(function getAttendanceSheet(err, docs) {
      var found = 0;
      if (docs.length > 0) {
        found = 1;
      }
      for (var i = 0; i < docs.length; i++) {
        attendanceChunks.push(docs[i]);
      }
      res.render("Manager/viewAttendance", {
        title: "Attendance Sheet",
        month: req.body.month,
        csrfToken: req.csrfToken(),
        found: found,
        attendance: attendanceChunks,
        moment: moment,
        userName: req.user.name,
      });
    });
});

/**
 * Description:
 * Marks the attendance of the manager in current date
 *
 
 *
 * Last Updated: 30th November, 2016
 *
 * Known Bugs: None
 */

// Handle profile updates for manager
// Configure multer storage
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
    res.redirect("/manager/edit-profile");
  }
});

router.use("/", isLoggedIn, isManager, function isAuthenticated(req, res, next) {
  // Make sure search query is available in all manager routes
  res.locals.searchQuery = req.query.search || '';
  next();
});
/**
 * Displays manager profile edit form
 */
router.get("/edit-profile", async function editProfile(req, res, next) {
  try {
    const [employee, supervisors] = await Promise.all([
      User.findById(req.user._id),
      User.find({
        type: { $in: ["project_manager", "accounts_manager"] },
        _id: { $ne: req.user._id } // Exclude current user
      }).sort({ name: 1 })
    ]);
    
    res.render(path.join("Manager", "editProfile"), {
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

// Handle profile updates for manager 
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
        personalEmail: parsedBody.personalEmail?.trim() || null,
        supervisor: parsedBody.supervisor === 'None' || parsedBody.supervisor === '' ? null : parsedBody.supervisor
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

router.post(
  "/mark-manager-attendance",
  function markAttendance(req, res, next) {
    Attendance.find(
      {
        employeeID: req.user._id,
        date: new Date().getDate(),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      },
      function getAttendance(err, docs) {
        var found = 0;
        if (docs.length > 0) {
          found = 1;
        } else {
          var newAttendance = new Attendance();
          newAttendance.employeeID = req.user._id;
          newAttendance.year = new Date().getFullYear();
          newAttendance.month = new Date().getMonth() + 1;
          newAttendance.date = new Date().getDate();
          newAttendance.present = 1;
          newAttendance.save(function saveAttendance(err) {
            if (err) {
              console.log(err);
            }
          });
        }
        res.redirect("/manager/view-attendance-current");
      }
    );
  }
);

// Route chỉ dành cho Accounts Manager
router.get("/view-employee-salaries", isAccountsManager, function viewEmployeeSalaries(req, res) {
  // Code xử lý xem lương nhân viên
});

// Route chỉ dành cho Accounts Manager
router.get("/generate-payslip/:id", isAccountsManager, function generatePayslip(req, res) {
  // Code xử lý tạo phiếu lương
});

/**
 * Route để thêm mới dự án
 */
router.post("/add-project", function(req, res, next) {
  const { title, type, status, startDate, endDate, description } = req.body;
  
  const newProject = new Project({
    employeeID: req.user._id,
    title,
    type,
    status,
    description,
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  });
  
  newProject.save(function(err) {
    if (err) {
      console.error("Error saving project:", err);
      req.flash("error", "Lỗi khi lưu dự án. Vui lòng thử lại.");
      return res.redirect("/manager/view-projects");
    }
    
    req.flash("success", "Dự án đã được tạo thành công");
    res.redirect("/manager/view-projects");
  });
});

/**
 * Route để xóa dự án
 */
router.post("/delete-project", function(req, res, next) {
  const { projectId } = req.body;
  
  if (!projectId) {
    req.flash("error", "ID dự án không hợp lệ");
    return res.redirect("/manager/view-projects");
  }
  
  Project.findByIdAndRemove(projectId, function(err) {
    if (err) {
      console.error("Error deleting project:", err);
      req.flash("error", "Lỗi khi xóa dự án. Vui lòng thử lại.");
      return res.redirect("/manager/view-projects");
    }
    
    req.flash("success", "Dự án đã được xóa thành công");
    res.redirect("/manager/view-projects");
  });
});

/**
 * Route để mở form edit dự án
 */
router.get("/edit-project/:id", function(req, res, next) {
  const projectId = req.params.id;
  
  Project.findById(projectId, function(err, project) {
    if (err || !project) {
      console.error("Error finding project:", err);
      req.flash("error", "Không tìm thấy dự án");
      return res.redirect("/manager/view-projects");
    }
    
    res.render("Manager/editProject", {
      title: "Edit Project",
      project: project,
      moment: moment,
      csrfToken: req.csrfToken(),
      userName: req.user.name
    });
  });
});

/**
 * Route để cập nhật dự án
 */
router.post("/update-project/:id", function(req, res, next) {
  const projectId = req.params.id;
  const { title, type, status, startDate, endDate, description } = req.body;
  
  Project.findById(projectId, function(err, project) {
    if (err || !project) {
      console.error("Error finding project:", err);
      req.flash("error", "Không tìm thấy dự án");
      return res.redirect("/manager/view-projects");
    }
    
    project.title = title;
    project.type = type;
    project.status = status;
    project.description = description;
    project.startDate = new Date(startDate);
    project.endDate = new Date(endDate);
    
    project.save(function(err) {
      if (err) {
        console.error("Error updating project:", err);
        req.flash("error", "Lỗi khi cập nhật dự án. Vui lòng thử lại.");
        return res.redirect(`/manager/edit-project/${projectId}`);
      }
      
      req.flash("success", "Dự án đã được cập nhật thành công");
      res.redirect("/manager/view-projects");
    });
  });
});

/**
 * View pending attendance edit requests
 */
router.get('/attendance-edit-requests', function(req, res) {
  // Find all attendance records with pending edit requests
  Attendance.find({
    'editRequest.requested': true,
    'editRequest.status': 'pending'
  })
  .populate('employeeID')
  .sort({year: -1, month: -1, date: -1})
  .exec(function(err, records) {
    if (err) {
      console.log(err);
      return res.status(500).send("Error fetching edit requests");
    }
    
    res.render('Manager/attendanceEditRequests', {
      title: 'Attendance Edit Requests',
      records: records,
      csrfToken: req.csrfToken(),
      userName: req.user.name,
      moment: moment
    });
  });
});

/**
 * Process attendance edit request (approve/reject)
 */
router.post('/process-edit-request', function(req, res) {
  const { attendanceId, action, managerNotes } = req.body;
  
  if (!attendanceId || !action) {
    return res.status(400).send("Missing required information");
  }
  
  Attendance.findById(attendanceId, function(err, attendance) {
    if (err || !attendance) {
      return res.status(404).send("Attendance record not found");
    }
    
    if (action === 'approve') {
      attendance.editRequest.status = 'approved';
      attendance.edited = true;
      
      // If additional fields to edit were provided
      if (req.body.checkInTime) {
        attendance.checkInTime = new Date(req.body.checkInTime);
      }
      
      if (req.body.checkOutTime) {
        attendance.checkOutTime = new Date(req.body.checkOutTime);
        
        // Recalculate work hours if both times are present
        if (attendance.checkInTime) {
          const checkIn = new Date(attendance.checkInTime);
          const checkOut = new Date(attendance.checkOutTime);
          
          // Calculate work hours
          const diffMs = checkOut - checkIn;
          const diffHrs = diffMs / (1000 * 60 * 60);
          attendance.workHours = parseFloat(diffHrs.toFixed(2));
          
          // Calculate overtime
          if (attendance.workHours > 8) {
            attendance.overtime = parseFloat((attendance.workHours - 8).toFixed(2));
          } else {
            attendance.overtime = 0;
          }
          
          // Update status if needed
          if (attendance.workHours >= 4 && attendance.workHours < 8) {
            attendance.status = 'halfDay';
          } else if (attendance.workHours >= 8 && attendance.overtime > 0) {
            attendance.status = 'overtime';
          }
        }
      }
      
      if (req.body.status) {
        attendance.status = req.body.status;
      }
      
      if (managerNotes) {
        attendance.notes = managerNotes;
      }
      
      attendance.editRequest.approvedBy = req.user._id;
    } else if (action === 'reject') {
      attendance.editRequest.status = 'rejected';
      if (managerNotes) {
        attendance.notes = managerNotes;
      }
    }
    
    attendance.save(function(err) {
      if (err) {
        console.log(err);
        return res.status(500).send("Error processing request");
      }
      
      return res.redirect('/manager/attendance-edit-requests');
    });
  });
});

module.exports = router;
