const express = require("express");
const router = express.Router();
const path = require("path");
const passport = require("passport");
const User = require("../models/user");
const Project = require("../models/project");
const config_passport = require("../config/passport.js");
const moment = require("moment");
const Leave = require("../models/leave");
const Attendance = require("../models/attendance");
const { isLoggedIn, isAdmin } = require("./middleware");
const multer = require("multer");
const fs = require("fs");

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
    res.redirect("/admin/edit-profile");
  }
});

router.use("/", isLoggedIn, isAdmin, function isAuthenticated(req, res, next) {
  // Make sure search query is available in all admin routes
  res.locals.searchQuery = req.query.search || '';
  next();
});

/**
 * Dashboard route for admin
 * This displays statistics about users, attendance, and other metrics
 */
router.get("/dashboard", async function viewDashboard(req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get system statistics
    const [
      totalEmployees,
      totalManagers,
      totalProjects,
      todayAttendance,
      pendingLeaves,
      totalLeaves
    ] = await Promise.all([
      // Count total employees
      User.countDocuments({ type: "employee" }),
      
      // Count total managers
      User.countDocuments({ 
        type: { $in: ["project_manager", "accounts_manager"] } 
      }),
      
      // Count total projects
      Project.countDocuments({}),
      
      // Get today's attendance count
      Attendance.countDocuments({
        date: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear()
      }),
      
      // Count pending leaves
      Leave.countDocuments({ adminResponse: "Pending" }),
      
      // Count total leaves
      Leave.countDocuments({})
    ]);

    res.render("Admin/dashboard", {
      title: "Admin Dashboard",
      csrfToken: req.csrfToken(),
      userName: req.user.name,
      totalEmployees,
      totalManagers,
      totalProjects,
      todayAttendance,
      pendingLeaves,
      totalLeaves,
      moment: moment
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).send("Error loading dashboard");
  }
});

// Displays home page to the admin
router.get("/", async function viewHome(req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get system statistics
    const [
      totalEmployees,
      totalManagers,
      totalProjects,
      todayAttendance,
      pendingLeaves,
      totalLeaves
    ] = await Promise.all([
      // Count total employees
      User.countDocuments({ type: "employee" }),
      
      // Count total managers
      User.countDocuments({ 
        type: { $in: ["project_manager", "accounts_manager"] } 
      }),
      
      // Count total projects
      Project.countDocuments({}),
      
      // Get today's attendance count
      Attendance.countDocuments({
        date: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear()
      }),
      
      // Count pending leaves
      Leave.countDocuments({ adminResponse: "Pending" }),
      
      // Count total leaves
      Leave.countDocuments({})
    ]);

    res.render("Admin/adminHome", {
      title: "Admin Home",
      csrfToken: req.csrfToken(),
      userName: req.user.name,
      totalEmployees,
      totalManagers,
      totalProjects,
      todayAttendance,
      pendingLeaves,
      totalLeaves,
      moment: moment
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).send("Error loading dashboard");
  }
});

/**
 * Sorts the list of employees in User Schema.
 * Such that latest records are shown first.
 * Then displays list of all employees to the admin.
 */
router.get("/view-all-employees", async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = {
      $or: [
        { type: "employee" },
        { type: "project_manager" },
        { type: "accounts_manager" },
      ],
    };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
        { contactNumber: { $regex: searchRegex } },
        { department: { $regex: searchRegex } },
        { designation: { $regex: searchRegex } }
      ];
    }

    const users = await User.find(query).sort({ _id: -1 });

    // Ensure searchQuery is always defined
    const searchQuery = typeof search !== 'undefined' ? search : '';
    
    return res.render("Admin/viewAllEmployee", {
      title: "All Employees",
      csrfToken: req.csrfToken(),
      users,
      userName: req.user.name,
      searchQuery: searchQuery
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving employees");
  }
});

// Displays profile of the employee with the help of the id of the employee from the parameters.
router.get("/employee-profile/:id", async (req, res, next) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    res.render("Admin/employeeProfile", {
      title: "Employee Profile",
      employee: user,
      csrfToken: req.csrfToken(),
      moment: moment,
      userName: req.user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving employee profile");
  }
});

// Displays the attendance sheet of the given employee to the admin.
router.get("/view-employee-attendance/:id", async (req, res, next) => {
  const { id } = req.params;
  try {
    const attendances = await Attendance.find({ employeeID: id }).sort({
      _id: -1,
    });
    const user = await User.findById(id);

    res.render("Admin/employeeAttendanceSheet", {
      title: "Employee Attendance Sheet",
      month: req.body.month,
      csrfToken: req.csrfToken(),
      found: attendances.length > 0 ? 1 : 0,
      attendance: attendances,
      moment: moment,
      userName: req.user.name,
      employee_name: user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving employee attendance");
  }
});

// Displays edit employee form to the admin.
router.get("/edit-employee/:id", async (req, res, next) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    res.render("Admin/editEmployee", {
      title: "Edit Employee",
      csrfToken: req.csrfToken(),
      employee: user,
      moment: moment,
      message: "",
      userName: req.user.name,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/admin/");
  }
});

// First it gets attributes of the logged in admin from the User Schema.
router.get("/view-profile", async (req, res, next) => {
  const { _id, name } = req.user;
  try {
    const user = await User.findById(_id);
    res.render("Admin/viewProfile", {
      title: "Profile",
      csrfToken: req.csrfToken(),
      employee: user,
      moment: moment,
      userName: name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving profile");
  }
});

// Displays add employee form to the admin.
router.get("/add-employee", (req, res, next) => {
  const { name } = req.user;
  const messages = req.flash("error");

  res.render("Admin/addEmployee", {
    title: "Add Employee",
    csrfToken: req.csrfToken(),
    user: config_passport.User,
    messages,
    hasErrors: messages.length > 0,
    userName: name,
  });
});

/**
 * First it gets the id of the given employee from the parameters.
 * Finds the project of the employee from Project Schema with the help of that id.
 * Then displays all the projects of the given employee.
 */
router.get("/all-employee-projects/:id", async (req, res, next) => {
  const { id } = req.params;
  try {
    const projects = await Project.find({ employeeID: id }).sort({ _id: -1 });
    const user = await User.findById(id);

    res.render("Admin/employeeAllProjects", {
      title: "List Of Employee Projects",
      hasProject: projects.length > 0 ? 1 : 0,
      projects,
      csrfToken: req.csrfToken(),
      user,
      userName: req.user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving employee projects");
  }
});

// Displays the list of all the leave applications applied by all employees.
router.get("/leave-applications", async (req, res, next) => {
  try {
    const leaves = await Leave.find({}).sort({ _id: -1 });
    const hasLeave = leaves.length > 0 ? 1 : 0;

    const employeeChunks = await Promise.all(
      leaves.map((leave) => User.findById(leave.applicantID))
    );

    res.render("Admin/allApplications", {
      title: "List Of Leave Applications",
      csrfToken: req.csrfToken(),
      hasLeave,
      leaves,
      employees: employeeChunks,
      moment: moment,
      userName: req.user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving leave applications");
  }
});

/**
 * Gets the leave id and employee id from the parameters.
 * Then shows the response application form of that leave of the employee to the admin.
 */
router.get(
  "/respond-application/:leave_id/:employee_id",
  async (req, res, next) => {
    const { leave_id: leaveID, employee_id: employeeID } = req.params;
    try {
      const leave = await Leave.findById(leaveID);
      const user = await User.findById(employeeID);

      res.render("Admin/applicationResponse", {
        title: "Respond Leave Application",
        csrfToken: req.csrfToken(),
        leave,
        employee: user,
        moment: moment,
        userName: req.user.name,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Error responding to application");
    }
  }
);
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
    
    res.render(path.join("Admin", "editProfile"), {
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
 * Gets id of the projet to be edit.
 * Displays the form of the edit project to th admin.
 */
router.get("/edit-employee-project/:id", async (req, res, next) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id);
    res.render("Admin/editProject", {
      title: "Edit Employee",
      csrfToken: req.csrfToken(),
      project,
      moment: moment,
      message: "",
      userName: req.user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving project");
  }
});

/**
 * Gets the id of the employee from parameters.
 * Displays the add employee project form to the admin.
 */
router.get("/add-employee-project/:id", async (req, res, next) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    res.render("Admin/addProject", {
      title: "Add Employee Project",
      csrfToken: req.csrfToken(),
      employee: user,
      moment: moment,
      message: "",
      userName: req.user.name,
    });
  } catch (err) {
    res.redirect("/admin/");
  }
});

router.get("/employee-project-info/:id", async (req, res, next) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id);
    const user = await User.findById(project.employeeID);
    res.render("Admin/projectInfo", {
      title: "Employee Project Information",
      project: project,
      employee: user,
      moment: moment,
      message: "",
      userName: req.user.name,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.log(err);
  }
});

router.get("/redirect-employee-profile", async (req, res, next) => {
  const { id } = req.user;
  try {
    const user = await User.findById(id);
    res.redirect(`/admin/employee-profile/${id}`);
  } catch (err) {
    console.log(err);
  }
});

// Displays the admin its own attendance sheet
router.post("/view-attendance", async (req, res, next) => {
  const { month, year } = req.body;
  const { _id, name } = req.user;
  try {
    const attendance = await Attendance.find({
      employeeID: _id,
      month,
      year,
    }).sort({ _id: -1 });
    const found = attendance.length > 0 ? 1 : 0;
    res.render("Admin/viewAttendanceSheet", {
      title: "Attendance Sheet",
      month,
      csrfToken: req.csrfToken(),
      found,
      attendance,
      userName: name,
      moment: moment,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error viewing attendance");
  }
});

/**
 * After marking attendance.
 * Shows current attendance to the admin.
 */
router.get("/view-attendance-current", async (req, res, next) => {
  const { _id, name } = req.user;
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  try {
    const attendance = await Attendance.find({
      employeeID: _id,
      month,
      year,
    }).sort({ _id: -1 });
    const found = attendance.length > 0 ? 1 : 0;
    res.render("Admin/viewAttendanceSheet", {
      title: "Attendance Sheet",
      month,
      csrfToken: req.csrfToken(),
      found,
      attendance,
      moment: moment,
      userName: name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error viewing current attendance");
  }
});

// Adds employee to the User Schema by getting attributes from the body of the post request.
// Then redirects admin to the profile information page of the added employee.
router.post(
  "/add-employee",
  passport.authenticate("local.add-employee", {
    successRedirect: "/admin/redirect-employee-profile",
    failureRedirect: "/admin/add-employee",
    failureFlash: true,
  })
);

// Gets the id of the leave from the body of the post request.
// Sets the response field of that leave according to response given by employee from body of the post request.
router.post("/respond-application", async (req, res) => {
  try {
    const leave = await Leave.findById(req.body.leave_id);
    leave.adminResponse = req.body.status;
    await leave.save();
    res.redirect("/admin/leave-applications");
  } catch (err) {
    console.log(err);
  }
});

// Gets the id of the employee from the parameters.
// Gets the edited fields of the project from body of the post request.
// Saves the update field to the project of the employee  in Project Schema.
// Edits the project of the employee.
router.post("/edit-employee/:id", async (req, res) => {
  const { id } = req.params;
  const { email, designation, name, DOB, number, department, skills } =
    req.body;
  const newUser = {
    email,
    type:
      designation === "Accounts Manager"
        ? "accounts_manager"
        : designation === "Project Manager"
        ? "project_manager"
        : "employee",
    name,
    dateOfBirth: new Date(DOB),
    contactNumber: number,
    department,
    Skills: skills,
    designation,
  };

  try {
    const user = await User.findById(id);
    if (user.email !== email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.render("Admin/editEmployee", {
          title: "Edit Employee",
          csrfToken: req.csrfToken(),
          employee: newUser,
          moment: moment,
          message: "Email is already in use",
          userName: req.user.name,
        });
      }
    }
    Object.assign(user, newUser);
    await user.save();
    res.redirect(`/admin/employee-profile/${id}`);
  } catch (err) {
    console.log(err);
    res.redirect("/admin/");
  }
});

router.post("/add-employee-project/:id", async (req, res) => {
  const { id } = req.params;
  const { title, type, start_date, end_date, description, status } = req.body;
  const newProject = new Project({
    employeeID: id,
    title,
    type,
    startDate: new Date(start_date),
    endDate: new Date(end_date),
    description,
    status,
  });

  try {
    await newProject.save();
    res.redirect(`/admin/employee-project-info/${newProject._id}`);
  } catch (err) {
    console.log(err);
  }
});

router.post("/edit-employee-project/:id", async (req, res) => {
  const { id } = req.params;
  const { title, type, start_date, end_date, description, status } = req.body;

  try {
    const project = await Project.findById(id);
    project.title = title;
    project.type = type;
    project.startDate = new Date(start_date);
    project.endDate = new Date(end_date);
    project.description = description;
    project.status = status;
    await project.save();
    res.redirect(`/admin/employee-project-info/${id}`);
  } catch (err) {
    console.log(err);
  }
});

router.post("/delete-employee/:id", async (req, res) => {
  const { id } = req.params;
  const { search } = req.body;

  try {
    await User.findByIdAndRemove(id);
    const redirectUrl = search 
      ? `/admin/view-all-employees?search=${encodeURIComponent(search)}`
      : '/admin/view-all-employees';
    res.redirect(redirectUrl);
  } catch (err) {
    console.log("unable to delete employee");
  }
});

// Handle profile updates for admin
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

router.post("/mark-attendance", async (req, res) => {
  const { _id } = req.user;
  const currentDate = new Date();
  const date = currentDate.getDate();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  try {
    const attendance = await Attendance.find({
      employeeID: _id,
      date,
      month,
      year,
    });

    if (attendance.length === 0) {
      const newAttendance = new Attendance({
        employeeID: _id,
        year,
        month,
        date,
        present: 1,
      });
      await newAttendance.save();
    }

    res.redirect("/admin/view-attendance-current");
  } catch (err) {
    console.log(err);
  }
});

/**
 * View pending attendance edit requests
 */
router.get('/attendance-edit-requests', async (req, res) => {
  try {
    // Find all attendance records with pending edit requests
    const records = await Attendance.find({
      'editRequest.requested': true,
      'editRequest.status': 'pending'
    })
    .populate('employeeID')
    .sort({year: -1, month: -1, date: -1});
    
    res.render('Admin/attendanceEditRequests', {
      title: 'Attendance Edit Requests',
      records: records,
      csrfToken: req.csrfToken(),
      userName: req.user.name,
      moment: moment
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send("Error fetching edit requests");
  }
});

/**
 * Process attendance edit request (approve/reject)
 */
router.post('/process-edit-request', async (req, res) => {
  const { attendanceId, action, managerNotes } = req.body;
  
  if (!attendanceId || !action) {
    return res.status(400).send("Missing required information");
  }
  
  try {
    const attendance = await Attendance.findById(attendanceId);
    
    if (!attendance) {
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
    
    await attendance.save();
    return res.redirect('/admin/attendance-edit-requests');
  } catch (err) {
    console.log(err);
    return res.status(500).send("Error processing request");
  }
});

module.exports = router;
