const mongoose = require('mongoose');
const db = require('./db');
const Project = require('./models/project');

// Kết nối đến cơ sở dữ liệu
db.connect()
  .then(() => console.log('Đã kết nối đến cơ sở dữ liệu'))
  .catch(err => {
    console.error('Lỗi kết nối cơ sở dữ liệu:', err);
    process.exit(1);
  });

// Kiểm tra dữ liệu project
async function checkProjects() {
  try {
    const projects = await Project.find();
    console.log(`Tổng số dự án: ${projects.length}`);
    
    if (projects.length === 0) {
      console.log('Không tìm thấy dự án nào trong cơ sở dữ liệu');
    } else {
      console.log('Danh sách dự án:');
      projects.forEach((project, index) => {
        console.log(`${index + 1}. ${project.title} (${project.type}) - Trạng thái: ${project.status}`);
        console.log(`   ID: ${project._id}`);
        console.log(`   EmployeeID: ${project.employeeID}`);
        console.log(`   Mô tả: ${project.description.substring(0, 50)}...`);
        console.log(`   Ngày bắt đầu: ${project.startDate}`);
        console.log(`   Ngày kết thúc: ${project.endDate}`);
        console.log('-------------------------------------------');
      });
    }
    
    // Đóng kết nối
    mongoose.disconnect();
  } catch (error) {
    console.error('Lỗi khi truy vấn dữ liệu:', error);
    mongoose.disconnect();
  }
}

// Chạy hàm kiểm tra
checkProjects(); 