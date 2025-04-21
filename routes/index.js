const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../models/user");
const { isLoggedIn } = require("./middleware");
const csrf = require("csurf");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const csrfProtection = csrf();
router.use(csrfProtection);

// Cấu hình nodemailer (thay thế bằng cấu hình thực tế của bạn)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your_email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your_email_password'
  }
});

router.get("/", function viewLoginPage(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/check-type");
  }

  const messages = req.flash("error");
  const successMsg = req.flash("success");

  res.render("login", {
    title: "Log In",
    csrfToken: req.csrfToken(),
    messages: messages,
    hasErrors: messages.length > 0,
    successMsg: successMsg,
    hasSuccess: successMsg.length > 0
  });
});

router.post(
  "/login",
  passport.authenticate("local.signin", {
    successRedirect: "/check-type",
    failureRedirect: "/",
    failureFlash: true,
  })
);

router.get("/check-type", function checkTypeOfLoggedInUser(req, res, next) {
  req.session.user = req.user;
  switch (req.user.type) {
    case "project_manager":
    case "accounts_manager":
      res.redirect("/manager/");
      break;
    case "employee":
      res.redirect("/employee/");
      break;
    default:
      res.redirect("/admin/");
  }
});

router.get("/logout", isLoggedIn, function logoutUser(req, res, next) {
  req.logout();
  res.redirect("/");
});

router.get("/signup", function signUp(req, res, next) {
  const messages = req.flash("error");
  res.render("signup", {
    csrfToken: req.csrfToken(),
    messages: messages,
    hasErrors: messages.length > 0,
  });
});

router.get("/forgot-password", function forgotPassword(req, res, next) {
  const messages = req.flash("error");
  res.render("forgot-password", {
    title: "Forgot Password",
    csrfToken: req.csrfToken(),
    messages: messages,
    hasErrors: messages.length > 0,
  });
});

router.post("/forgot-password", async function handleForgotPassword(req, res, next) {
  try {
    const email = req.body.email;
    
    const user = await User.findOne({ email: email });
    
    if (!user) {
      req.flash("error", "No account with that email address exists.");
      return res.redirect("/forgot-password");
    }
    
    const resetToken = crypto.randomBytes(20).toString("hex");
    
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 giờ
    
    await user.save();
    
    const resetUrl = req.protocol + '://' + req.get('host') + '/reset/' + resetToken;
    

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER || 'your_email@gmail.com',
      subject: 'Password Reset',
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
        Please click on the following link, or paste this into your browser to complete the process:\n\n
        ${resetUrl}\n\n
        If you did not request this, please ignore this email and your password will remain unchanged.\n`,
      html: `
        <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
        <p>Please click on the following link, or paste this into your browser to complete the process:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      `
    };
    
    // Trong môi trường thực tế, bỏ comment dòng dưới để gửi email
    // await transporter.sendMail(mailOptions);
    
    console.log('Reset URL:', resetUrl);
    
    res.render("reset-confirmation", {
      title: "Reset Password",
      email: email,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    console.error('Error in forgot password:', error);
    req.flash("error", "An error occurred. Please try again later.");
    res.redirect("/forgot-password");
  }
});

router.post("/resend-reset", async function resendResetEmail(req, res, next) {
  try {
    const email = req.body.email;
    
    // Kiểm tra lại email
    const user = await User.findOne({ email: email });
    
    if (!user) {
      req.flash("error", "No account with that email address exists.");
      return res.redirect("/forgot-password");
    }

    let resetToken = user.resetPasswordToken;

    if (!resetToken || user.resetPasswordExpires < Date.now()) {
      resetToken = crypto.randomBytes(20).toString("hex");
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 360000;
      await user.save();
    }
    
    const resetUrl = req.protocol + '://' + req.get('host') + '/reset/' + resetToken;
    
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER || 'your_email@gmail.com',
      subject: 'Password Reset (Resent)',
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
        Please click on the following link, or paste this into your browser to complete the process:\n\n
        ${resetUrl}\n\n
        If you did not request this, please ignore this email and your password will remain unchanged.\n`,
      html: `
        <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
        <p>Please click on the following link, or paste this into your browser to complete the process:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      `
    };
    
    // Trong môi trường thực tế, bỏ comment dòng dưới để gửi email
    // await transporter.sendMail(mailOptions);
    
    console.log('Reset URL (Resent):', resetUrl);
    
    req.flash("success", "Email has been resent!");
    res.render("reset-confirmation", {
      title: "Reset Password",
      email: email,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    console.error('Error in resend reset:', error);
    req.flash("error", "An error occurred. Please try again later.");
    res.redirect("/forgot-password");
  }
});

// Route để render form đặt lại mật khẩu khi người dùng nhấp vào link trong email
router.get("/reset/:token", async function renderResetForm(req, res, next) {
  try {
    // Tìm người dùng bằng token và kiểm tra thời hạn
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired.");
      return res.redirect("/forgot-password");
    }
    
    // Render form đặt lại mật khẩu
    res.render("reset-password", {
      title: "Reset Password",
      token: req.params.token,
      csrfToken: req.csrfToken(),
      messages: req.flash("error"),
      hasErrors: req.flash("error").length > 0
    });
  } catch (error) {
    console.error('Error in reset form:', error);
    req.flash("error", "An error occurred. Please try again later.");
    res.redirect("/forgot-password");
  }
});

router.post("/reset/:token", async function handleResetPassword(req, res, next) {
  try {
    req.check("password", "Password must be at least 4 characters long").isLength({ min: 4 });
    req.check("confirm", "Passwords do not match").equals(req.body.password);
    
    const errors = req.validationErrors();
    if (errors) {
      req.flash("error", errors.map(err => err.msg));
      return res.redirect('/reset/' + req.params.token);
    }
    
    // Tìm người dùng bằng token và kiểm tra thời hạn
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired.");
      return res.redirect("/forgot-password");
    }
    
    // Cập nhật mật khẩu và xóa token
    user.password = user.encryptPassword(req.body.password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();
    
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER || 'your_email@gmail.com',
      subject: 'Your password has been changed',
      text: `Hello,\n\nThis is a confirmation that the password for your account ${user.email} has just been changed.\n`,
      html: `
        <p>Hello,</p>
        <p>This is a confirmation that the password for your account ${user.email} has just been changed.</p>
      `
    };
    
    // Trong môi trường thực tế, bỏ comment dòng dưới để gửi email
    // await transporter.sendMail(mailOptions);
    
    // Chuyển hướng về trang đăng nhập với thông báo thành công
    req.flash("success", "Success! Your password has been changed.");
    res.redirect("/");
  } catch (error) {
    console.error('Error in reset password:', error);
    req.flash("error", "An error occurred. Please try again later.");
    res.redirect("/forgot-password");
  }
});

router.post(
  "/signup",
  passport.authenticate("local.signup", {
    successRedirect: "/signup",
    failureRedirect: "/signup",
    failureFlash: true,
  })
);

router.get("/dummy", async function (req, res, next) {
  try {
    const users = await User.find({ type: "employee" });
    res.render("dummy", { title: "Dummy", users });
  } catch (err) {
    console.log(err);
  }
});

module.exports = router;
