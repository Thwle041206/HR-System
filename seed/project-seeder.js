/**
 * Script seeder này tạo dữ liệu mẫu cho collection Project trong cơ sở dữ liệu MongoDB.
 * 
 * Mỗi document Project có các trường:
 * - employeeID: ID của nhân viên/manager phụ trách dự án (tham chiếu đến User)
 * - title: Tiêu đề dự án
 * - type: Loại dự án (Website, Application, Mobile App, Design)
 * - status: Trạng thái dự án (Not started, Ongoing, Finished)
 * - description: Mô tả dự án
 * - startDate: Ngày bắt đầu
 * - endDate: Ngày kết thúc
 */

const Project = require("../models/project");
const User = require("../models/user");
const mongoose = require("mongoose");
const db = require("../db");

db.connect()
  .then(() => console.log("Database connected"))
  .catch((err) => console.error("Database connection error", err));
function getDescription(type) {
  const descriptions = {
    "Website": "Dự án phát triển website với các tính năng responsive design, tối ưu hóa SEO và tích hợp hệ thống quản lý nội dung. Sử dụng công nghệ HTML5, CSS3, JavaScript và ReactJS cho front-end, NodeJS và Express cho back-end.",
    "Application": "Dự án phát triển ứng dụng desktop với giao diện thân thiện, tương tác thời gian thực và tích hợp cơ sở dữ liệu. Sử dụng công nghệ Electron, ReactJS và SQLite cho việc phát triển ứng dụng.",
    "Mobile App": "Dự án phát triển ứng dụng di động đa nền tảng với các tính năng thông báo đẩy, đồng bộ hóa dữ liệu và chế độ ngoại tuyến. Sử dụng React Native và Firebase cho phát triển ứng dụng.",
    "Design": "Dự án thiết kế UI/UX cho các sản phẩm số, bao gồm nghiên cứu người dùng, wireframing, prototyping và thiết kế giao diện. Sử dụng Figma, Adobe XD và Sketch cho quá trình thiết kế."
  };
  return descriptions[type] || "Dự án đang trong quá trình phát triển với các yêu cầu và mục tiêu cụ thể.";
}

(async function seedProjects() {
  try {
    const projectManager = await User.findOne({ type: "project_manager" });
    const employees = await User.find({ type: "employee" });
    
    if (!projectManager || employees.length === 0) {
      console.error("Không tìm thấy project manager hoặc employee. Vui lòng chạy user-seeder trước.");
      exit();
      return;
    }

    await Project.deleteMany({});
    const projects = [
      // Dự án cho Project Manager
      new Project({
        employeeID: projectManager._id,
        title: "HR System Enhancement",
        type: "Application",
        status: "Ongoing",
        description: getDescription("Application") + " Dự án nâng cấp hệ thống HR để thêm tính năng quản lý dự án, đánh giá hiệu suất và báo cáo.",
        startDate: new Date("2025-01-15"),
        endDate: new Date("2026-04-20")
      }),
      new Project({
        employeeID: projectManager._id,
        title: "Corporate Website Redesign",
        type: "Website",
        status: "Not started",
        description: getDescription("Website") + " Dự án thiết kế lại website công ty với giao diện hiện đại và tối ưu trải nghiệm người dùng.",
        startDate: new Date("2025-04-20"),
        endDate: new Date("2026-04-20")
      }),
      new Project({
        employeeID: projectManager._id,
        title: "Mobile App Development",
        type: "Mobile App",
        status: "Ongoing",
        description: getDescription("Mobile App") + " Phát triển ứng dụng di động cho khách hàng để quản lý và theo dõi đơn hàng.",
        startDate: new Date("2025-04-01"),
        endDate: new Date("2026-04-20")
      }),
      new Project({
        employeeID: projectManager._id,
        title: "Brand Identity Design",
        type: "Design",
        status: "Finished",
        description: getDescription("Design") + " Dự án thiết kế bộ nhận diện thương hiệu mới cho công ty, bao gồm logo, bảng màu và tài liệu tiếp thị.",
        startDate: new Date("2021-04-20"),
        endDate: new Date("2022-04-20")
      }),
      
      // Dự án cho Employee 1
      new Project({
        employeeID: employees[0]._id,
        title: "E-commerce Platform",
        type: "Website",
        status: "Not started",
        description: getDescription("Website") + " Xây dựng nền tảng thương mại điện tử với tính năng thanh toán trực tuyến, quản lý sản phẩm và phân tích dữ liệu.",
        startDate: new Date("2025-04-20"),
        endDate: new Date("2026-04-20")
      }),
      new Project({
        employeeID: employees[0]._id,
        title: "CRM System Integration",
        type: "Application",
        status: "Ongoing",
        description: getDescription("Application") + " Tích hợp hệ thống CRM với các ứng dụng hiện có để cải thiện quản lý khách hàng và bán hàng.",
        startDate: new Date("2025-04-01"),
        endDate: new Date("2026-04-20")
      }),
      
      // Dự án cho Employee 2
      new Project({
        employeeID: employees[1]._id,
        title: "Analytics Dashboard",
        type: "Website",
        status: "Ongoing",
        description: getDescription("Website") + " Phát triển dashboard phân tích dữ liệu với biểu đồ trực quan và báo cáo tùy chỉnh.",
        startDate: new Date("2025-04-01"),
        endDate: new Date("2026-04-20")
      }),
      new Project({
        employeeID: employees[1]._id,
        title: "Mobile Game Development",
        type: "Mobile App",
        status: "Finished",
        description: getDescription("Mobile App") + " Phát triển trò chơi di động 2D với đồ họa bắt mắt và cơ chế gameplay sáng tạo.",
        startDate: new Date("2021-04-20"),
        endDate: new Date("2022-04-20")
      })
    ];
    
    for (const project of projects) {
      await project.save();
      console.log(`Đã thêm dự án: ${project.title}`);
    }
    
    console.log(`Đã thêm ${projects.length} dự án thành công.`);
    exit();
  } catch (error) {
    console.error("Lỗi khi thêm dữ liệu mẫu:", error);
    exit();
  }
})();

function exit() {
  mongoose.disconnect();
  console.log("Kết thúc seeding dữ liệu dự án");
} 