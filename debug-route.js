const express = require('express');
const router = express.Router();
const Project = require('./models/project');
const User = require('./models/user');

// Route debug để kiểm tra dữ liệu dự án
router.get('/debug/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ startDate: -1 });
    
    // Hiển thị thông tin người dùng đang đăng nhập
    const userInfo = req.isAuthenticated() ? {
      id: req.user._id,
      name: req.user.name,
      type: req.user.type,
      email: req.user.email
    } : { message: 'Chưa đăng nhập' };
    
    // Trả về JSON với thông tin chi tiết
    res.json({
      userInfo,
      projectCount: projects.length,
      projects: projects.map(p => ({
        id: p._id,
        title: p.title,
        type: p.type,
        status: p.status,
        employeeID: p.employeeID,
        startDate: p.startDate,
        endDate: p.endDate,
        description: p.description.substring(0, 50) + '...'
      }))
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

module.exports = router; 