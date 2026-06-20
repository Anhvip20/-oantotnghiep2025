const { sql, connectDB } = require("./db");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const app = express();
app.use(cors());
app.use(express.json());

async function ghiLichSuCongViec(pool, congViecId, nhanVienId, hanhDong, noiDung) {
  await pool
    .request()
    .input("congViecId", sql.Int, congViecId)
    .input("nhanVienId", sql.Int, nhanVienId || null)
    .input("hanhDong", sql.NVarChar, hanhDong)
    .input("noiDung", sql.NVarChar, noiDung)
    .query(`
      INSERT INTO LichSuCongViec (
        congViecId,
        nhanVienId,
        hanhDong,
        noiDung
      )
      VALUES (
        @congViecId,
        @nhanVienId,
        @hanhDong,
        @noiDung
      )
    `);
}

function isValidEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  const allowedTlds = new Set([
    "com",
    "vn",
    "com.vn",
    "edu.vn",
    "gov.vn",
    "net",
    "org",
    "info",
    "io",
    "co",
    "me",
    "dev",
    "ai",
    "app"
  ]);

  if (!/^[a-z0-9._%+-]+@([a-z0-9-]+\.)+[a-z]{2,}$/.test(value)) {
    return false;
  }

  const [local, domain] = value.split("@");

  if (!local || !domain || local.includes("..") || domain.includes("..")) {
    return false;
  }

  const labels = domain.split(".");

  if (labels.some(label =>
    !label
    || label.startsWith("-")
    || label.endsWith("-")
  )) {
    return false;
  }

  const lastTwoLabels = labels.slice(-2).join(".");
  const lastLabel = labels[labels.length - 1];

  return allowedTlds.has(lastTwoLabels) || allowedTlds.has(lastLabel);
}

function isValidName(name) {
  const normalizedName = String(name || "").trim().replace(/\s+/g, " ");

  return normalizedName.length >= 2
    && normalizedName.length <= 80
    && /^[A-Za-zÀ-ỹ\s'-]+$/.test(normalizedName);
}

function isValidPhone(phone) {
  const value = String(phone || "").trim();

  return /^(03|05|07|08|09)\d{8}$/.test(value);
}

app.get("/", (req, res) => {
  res.send("Server đang chạy ");
});


app.get("/nhanvien", async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT * FROM NhanVien
      WHERE role = 'staff'
      ORDER BY id DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error("Lỗi /nhanvien:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/congviec", async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT cv.*, nv.ten AS tenNhanVien
      FROM CongViec cv
      LEFT JOIN NhanVien nv ON cv.nhanVienId = nv.id
      ORDER BY cv.id DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error("Lỗi /congviec:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/thongke", async (req, res) => {
  try {
    const pool = await connectDB();

    const staffResult = await pool.request().query(`
      SELECT COUNT(*) AS tongNhanVien
      FROM NhanVien
      WHERE role = 'staff'
    `);

    const taskResult = await pool.request().query(`
      SELECT COUNT(*) AS tongCongViec
      FROM CongViec
    `);

    const doingResult = await pool.request().query(`
      SELECT COUNT(*) AS dangLam
      FROM CongViec
      WHERE trangThai = N'Đang làm'
    `);

    res.json({
      tongNhanVien: staffResult.recordset[0].tongNhanVien,
      tongCongViec: taskResult.recordset[0].tongCongViec,
      dangLam: doingResult.recordset[0].dangLam
    });
  } catch (error) {
    console.error("Lỗi /thongke:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/thongbao/:nhanVienId", async (req, res) => {
  try {
    const { nhanVienId } = req.params;
    const pool = await connectDB();

    const result = await pool
      .request()
      .input("nhanVienId", sql.Int, nhanVienId)
      .query(`
        SELECT
          id,
          noiDung,
          daDoc,
          thoiGian
          FROM ThongBao
          WHERE nhanVienId = @nhanVienId
          ORDER BY thoiGian DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Lỗi /thongbao:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put("/thongbao/dadoc/:id", async (req, res) => {

  try {

    const { id } = req.params;

    const pool = await connectDB();

    const thongBaoResult = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT
          tb.*,
          nv.ten AS tenNhanVien
        FROM ThongBao tb
        LEFT JOIN NhanVien nv
          ON tb.nhanVienId = nv.id
        WHERE tb.id = @id
      `);

    if (thongBaoResult.recordset.length === 0) {

      return res.status(404).json({
        message: "Không tìm thấy thông báo"
      });
    }

    const thongBao =
      thongBaoResult.recordset[0];

    await pool.request()
      .input("id", sql.Int, id)
      .query(`
        UPDATE ThongBao
        SET daDoc = 1
        WHERE id = @id
      `);

    const adminResult =
      await pool.request().query(`
        SELECT id
        FROM NhanVien
        WHERE role = 'admin'
      `);

    if (
      thongBao.noiDung.includes("đã đọc thông báo")
    ) {

      return res.json({
        message: "Đã đánh dấu đã đọc"
      });
    }
    for (const admin of adminResult.recordset) {

      await pool.request()
        .input(
          "noiDung",
          sql.NVarChar,
          `${thongBao.tenNhanVien || "Nhân viên"} đã đọc thông báo: "${thongBao.noiDung}"`
        )
        .input(
          "nhanVienId",
          sql.Int,
          admin.id
        )
        .query(`
          INSERT INTO ThongBao (
            noiDung,
            nhanVienId
          )
          VALUES (
            @noiDung,
            @nhanVienId
          )
        `);
    }

    res.json({
      message: "Đã đánh dấu đã đọc"
    });

  } catch (error) {

    console.error(
      "Lỗi PUT /thongbao/dadoc/:id:",
      error.message
    );

    res.status(500).json({
      message: "Lỗi server"
    });
  }
});


app.post("/login", async (req, res) => {
  try {
    const { email, matkhau } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Email không đúng định dạng"
      });
    }

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("matkhau", sql.NVarChar, matkhau)
      .query(`
        SELECT id, ten, email, soDienThoai, gioiTinh, role
        FROM NhanVien
        WHERE email = @email AND matkhau = @matkhau
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
    }

    res.json({
      message: "Đăng nhập thành công",
      user: result.recordset[0]
    });
  } catch (error) {
    console.error("Lỗi /login:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/nhanvien", async (req, res) => {
  try {
    const { ten, email, soDienThoai, gioiTinh, matkhau, role } = req.body;
    const cleanTen = String(ten || "").trim().replace(/\s+/g, " ");
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(soDienThoai || "").trim();
    const cleanGender = String(gioiTinh || "").trim();

    if (!isValidName(cleanTen)) {
      return res.status(400).json({
        message: "Tên nhân viên chỉ được chứa chữ cái, khoảng trắng, dấu gạch nối hoặc dấu nháy"
      });
    }

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({
        message: "Email không đúng định dạng"
      });
    }

    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({
        message: "Số điện thoại phải có 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09"
      });
    }

    if (!["Nam", "Nữ"].includes(cleanGender)) {
      return res.status(400).json({
        message: "Giới tính không hợp lệ"
      });
    }

    const pool = await connectDB();

    const check = await pool
      .request()
      .input("email", sql.NVarChar, cleanEmail)
      .query("SELECT * FROM NhanVien WHERE email = @email");

    if (check.recordset.length > 0) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    await pool
      .request()
      .input("ten", sql.NVarChar, cleanTen)
      .input("email", sql.NVarChar, cleanEmail)
      .input("soDienThoai", sql.NVarChar, cleanPhone)
      .input("gioiTinh", sql.NVarChar, cleanGender)
      .input("matkhau", sql.NVarChar, matkhau)
      .input("role", sql.NVarChar, role || "staff")
      .query(`
        INSERT INTO NhanVien (ten, email, soDienThoai, gioiTinh, matkhau, role)
        VALUES (@ten, @email, @soDienThoai, @gioiTinh, @matkhau, @role)
      `);

    res.json({ message: "Thêm nhân viên thành công" });
  } catch (error) {
    console.error("Lỗi POST /nhanvien:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put("/nhanvien/:id", async (req, res) => {

  try {

    const { id } = req.params;

    const {
      ten,
      email,
      soDienThoai,
      gioiTinh,
      matkhau,
      role
    } = req.body;

    const cleanTen = String(ten || "").trim().replace(/\s+/g, " ");
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(soDienThoai || "").trim();
    const cleanGender = String(gioiTinh || "").trim();

    if (!isValidName(cleanTen)) {
      return res.status(400).json({
        message: "Tên nhân viên chỉ được chứa chữ cái, khoảng trắng, dấu gạch nối hoặc dấu nháy"
      });
    }

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({
        message: "Email không đúng định dạng"
      });
    }

    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({
        message: "Số điện thoại phải có 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09"
      });
    }

    if (!["Nam", "Nữ"].includes(cleanGender)) {
      return res.status(400).json({
        message: "Giới tính không hợp lệ"
      });
    }

    const pool = await connectDB();

    const check = await pool
      .request()
      .input("email", sql.NVarChar, cleanEmail)
      .input("id", sql.Int, id)
      .query(`
        SELECT *
        FROM NhanVien
        WHERE email = @email
        AND id <> @id
      `);

    if (check.recordset.length > 0) {

      return res.status(400).json({
        message: "Email đã tồn tại"
      });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("ten", sql.NVarChar, cleanTen)
      .input("email", sql.NVarChar, cleanEmail)
      .input("soDienThoai", sql.NVarChar, cleanPhone)
      .input("gioiTinh", sql.NVarChar, cleanGender)
      .input("matkhau", sql.NVarChar, matkhau)
      .input("role", sql.NVarChar, role)
      .query(`
        UPDATE NhanVien
        SET
          ten = @ten,
          email = @email,
          soDienThoai = @soDienThoai,
          gioiTinh = @gioiTinh,
          matkhau = @matkhau,
          role = @role
        WHERE id = @id
      `);

    res.json({
      message: "Cập nhật nhân viên thành công"
    });

  } catch (error) {

    console.error(
      "Lỗi PUT /nhanvien/:id:",
      error.message
    );

    res.status(500).json({
      error: error.message
    });
  }
});



app.delete("/nhanvien/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await connectDB();

    const taskCheck = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS total
        FROM CongViec
        WHERE nhanVienId = @id
      `);

    if (taskCheck.recordset[0].total > 0) {
      return res.status(400).json({
        message: "Không thể xóa nhân viên vì đang được gán công việc"
      });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM NhanVien WHERE id = @id");

    res.json({ message: "Xóa nhân viên thành công" });
  } catch (error) {
    console.error("Lỗi DELETE /nhanvien/:id:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put("/congviec/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tieuDe, moTa, trangThai, ngayGiao, han, nhanVienId, nguoiThucHienId } = req.body;

    const pool = await connectDB();

    const oldTask = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT *
        FROM CongViec
        WHERE id = @id
      `);

    if (oldTask.recordset.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy công việc"
      });
    }

    const cvCu = oldTask.recordset[0];

    const oldNhanVienId = cvCu.nhanVienId;
    const newNhanVienId = nhanVienId;

    const thongBaoList = [];
    const lichSuList = [];

    if (cvCu.tieuDe !== tieuDe) {
      thongBaoList.push(
        `Tên công việc đã đổi từ "${cvCu.tieuDe}" thành "${tieuDe}"`
      );
      lichSuList.push(
        `Đổi tiêu đề từ "${cvCu.tieuDe}" thành "${tieuDe}"`
      );
    }

    if ((cvCu.moTa || "") !== (moTa || "")) {
      thongBaoList.push(
        `Mô tả công việc "${tieuDe}" đã được cập nhật`
      );
      lichSuList.push(
        `Cập nhật mô tả công việc "${tieuDe}"`
      );
    }

    if (cvCu.trangThai !== trangThai) {
      thongBaoList.push(
        `Công việc "${tieuDe}" đã cập nhật trạng thái: ${trangThai}`
      );
      lichSuList.push(
        `Đổi trạng thái từ "${cvCu.trangThai}" sang "${trangThai}"`
      );
    }

    if (
      String(cvCu.ngayGiao || "").split("T")[0] !==
      String(ngayGiao || "").split("T")[0]
    ) {
      lichSuList.push(
        `Đổi ngày giao từ ${cvCu.ngayGiao ? new Date(cvCu.ngayGiao).toISOString().split("T")[0] : "chưa có"} sang ${ngayGiao}`
      );
    }

    if (
      String(cvCu.han || "").split("T")[0] !==
      String(han || "").split("T")[0]
    ) {
      thongBaoList.push(
        `Công việc "${tieuDe}" đã đổi hạn từ ${cvCu.han || "chưa có"} sang ${han}`
      );
      lichSuList.push(
        `Đổi hạn từ ${cvCu.han ? new Date(cvCu.han).toISOString().split("T")[0] : "chưa có"} sang ${han}`
      );
    }

    if (oldNhanVienId != newNhanVienId) {
      thongBaoList.push(
        `Bạn được giao công việc: "${tieuDe}"`
      );
      lichSuList.push(
        `Đổi nhân viên phụ trách từ ID ${oldNhanVienId || "chưa có"} sang ID ${newNhanVienId}`
      );
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("tieuDe", sql.NVarChar, tieuDe)
      .input("moTa", sql.NVarChar, moTa)
      .input("trangThai", sql.NVarChar, trangThai)
      .input("ngayGiao", sql.Date, ngayGiao)
      .input("han", sql.Date, han)
      .input("nhanVienId", sql.Int, nhanVienId)
      .query(`
        UPDATE CongViec
        SET
          tieuDe = @tieuDe,
          moTa = @moTa,
          trangThai = @trangThai,
          ngayGiao = @ngayGiao,
          han = @han,
          nhanVienId = @nhanVienId
        WHERE id = @id
      `);

    if (thongBaoList.length > 0) {
      for (const noiDung of thongBaoList) {
        await pool
          .request()
          .input("noiDung", sql.NVarChar, noiDung)
          .input("nhanVienId", sql.Int, newNhanVienId)
          .query(`
            INSERT INTO ThongBao (noiDung, nhanVienId)
            VALUES (@noiDung, @nhanVienId)
          `);
      }
    }

    for (const noiDung of lichSuList) {
      await ghiLichSuCongViec(
        pool,
        id,
        nguoiThucHienId || null,
        "Sửa công việc",
        noiDung
      );
    }

    res.json({
      message: "Cập nhật công việc thành công"
    });

  } catch (error) {
    console.error("Lỗi PUT /congviec/:id:", error.message);

    res.status(500).json({
      error: error.message
    });
  }
});

app.get("/congviec/:id/lichsu", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await connectDB();

    const result = await pool
      .request()
      .input("congViecId", sql.Int, id)
      .query(`
        SELECT
          ls.id,
          ls.congViecId,
          ls.nhanVienId,
          ls.hanhDong,
          ls.noiDung,
          ls.thoiGian,
          nv.ten AS tenNhanVien
        FROM LichSuCongViec ls
        LEFT JOIN NhanVien nv
          ON ls.nhanVienId = nv.id
        WHERE ls.congViecId = @congViecId
        ORDER BY ls.thoiGian DESC, ls.id DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Lỗi GET /congviec/:id/lichsu:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put("/congviec/:id/trangthai", async (req, res) => {
  try {
    const { id } = req.params;
    const { trangThai, nhanVienId } = req.body;

    const trangThaiHopLe = ["Chưa làm", "Đang làm", "Chờ duyệt"];

    if (!trangThaiHopLe.includes(trangThai)) {
      return res.status(400).json({
        message: "Trạng thái công việc không hợp lệ"
      });
    }

    const pool = await connectDB();

    const taskResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT id, tieuDe, trangThai, han, nhanVienId
        FROM CongViec
        WHERE id = @id
      `);

    if (taskResult.recordset.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy công việc"
      });
    }

    const task = taskResult.recordset[0];

    if (String(task.nhanVienId) !== String(nhanVienId)) {
      return res.status(403).json({
        message: "Bạn không có quyền cập nhật công việc này"
      });
    }

    if (task.han && task.trangThai !== "Hoàn thành") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const deadline = new Date(task.han);
      deadline.setHours(0, 0, 0, 0);

      if (deadline < today) {
        return res.status(403).json({
          message: "Công việc đã quá hạn, nhân viên không thể cập nhật trạng thái"
        });
      }
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("trangThai", sql.NVarChar, trangThai)
      .query(`
        UPDATE CongViec
        SET trangThai = @trangThai
        WHERE id = @id
      `);

    await ghiLichSuCongViec(
      pool,
      id,
      nhanVienId,
      "Cập nhật trạng thái",
      `Đổi trạng thái từ "${task.trangThai}" sang "${trangThai}"`
    );

    await pool
      .request()
      .input(
        "noiDung",
        sql.NVarChar,
        `Nhân viên đã cập nhật trạng thái công việc "${task.tieuDe}" thành: ${trangThai}`
      )
      .input("nhanVienId", sql.Int, nhanVienId)
      .query(`
        INSERT INTO ThongBao (noiDung, nhanVienId)
        VALUES (@noiDung, @nhanVienId)
      `);

    if (trangThai === "Chờ duyệt") {
      const adminResult = await pool
        .request()
        .query(`
          SELECT id
          FROM NhanVien
          WHERE role = 'admin'
        `);

      for (const admin of adminResult.recordset) {
        await pool
          .request()
          .input(
            "noiDung",
            sql.NVarChar,
            `Công việc "${task.tieuDe}" đang chờ quản lý duyệt hoàn thành`
          )
          .input("nhanVienId", sql.Int, admin.id)
          .query(`
            INSERT INTO ThongBao (noiDung, nhanVienId)
            VALUES (@noiDung, @nhanVienId)
          `);
      }
    }

    res.json({
      message: "Cập nhật trạng thái công việc thành công"
    });
  } catch (error) {
    console.error("Lỗi PUT /congviec/:id/trangthai:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/congviec/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await connectDB();

    await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM CongViec WHERE id = @id");

    res.json({ message: "Xóa công việc thành công" });
  } catch (error) {
    console.error("Lỗi DELETE /congviec/:id:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/congviec", async (req, res) => {
  try {
    const { tieuDe, moTa, trangThai, ngayGiao, han, nhanVienId, nguoiThucHienId } = req.body;
    const pool = await connectDB();

    const insertResult = await pool
      .request()
      .input("tieuDe", sql.NVarChar, tieuDe)
      .input("moTa", sql.NVarChar, moTa)
      .input("trangThai", sql.NVarChar, trangThai)
      .input("ngayGiao", sql.Date, ngayGiao)
      .input("han", sql.Date, han)
      .input("nhanVienId", sql.Int, nhanVienId)
      .query(`
        INSERT INTO CongViec (tieuDe, moTa, trangThai, ngayGiao, han, nhanVienId)
        OUTPUT INSERTED.id
        VALUES (@tieuDe, @moTa, @trangThai, @ngayGiao, @han, @nhanVienId)
      `);

    const congViecId = insertResult.recordset[0].id;

    await ghiLichSuCongViec(
      pool,
      congViecId,
      nguoiThucHienId || null,
      "Tạo công việc",
      `Tạo công việc "${tieuDe}" giao ngày ${ngayGiao}, hạn ${han}, cho nhân viên ID ${nhanVienId}`
    );

    await pool
      .request()
      .input(
        "noiDung",
        sql.NVarChar,
        `Bạn được giao công việc mới: ${tieuDe}`
      )
      .input("nhanVienId", sql.Int, nhanVienId)
      .query(`
    INSERT INTO ThongBao (noiDung, nhanVienId)
    VALUES (@noiDung, @nhanVienId)
  `);

    res.json({ message: "Thêm công việc thành công" });
  } catch (error) {
    console.error("Lỗi POST /congviec:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const text = (message || "").toLowerCase().trim();
    const pool = await connectDB();

    if (!text) {
      return res.json({ reply: "Bạn hãy nhập câu hỏi." });
    }


    if (text.includes("bao nhiêu nhân viên") || text.includes("tổng nhân viên")) {
      const result = await pool.request().query(`
        SELECT COUNT(*) AS tongNhanVien
        FROM NhanVien
        WHERE role = 'staff'
      `);

      return res.json({
        reply: `Hiện có ${result.recordset[0].tongNhanVien} nhân viên trong hệ thống.`
      });
    }


    if (text.includes("bao nhiêu công việc") || text.includes("tổng công việc")) {
      const result = await pool.request().query(`
        SELECT COUNT(*) AS tongCongViec
        FROM CongViec
      `);

      return res.json({
        reply: `Hiện có ${result.recordset[0].tongCongViec} công việc trong hệ thống.`
      });
    }


    if (text.includes("đang làm")) {
      const result = await pool.request().query(`
        SELECT COUNT(*) AS dangLam
        FROM CongViec
        WHERE trangThai = N'Đang làm'
      `);

      return res.json({
        reply: `Hiện có ${result.recordset[0].dangLam} công việc đang làm.`
      });
    }


    if (text.includes("hoàn thành")) {
      const result = await pool.request().query(`
        SELECT COUNT(*) AS hoanThanh
        FROM CongViec
        WHERE trangThai = N'Hoàn thành'
      `);

      return res.json({
        reply: `Hiện có ${result.recordset[0].hoanThanh} công việc đã hoàn thành.`
      });
    }


    if (text.includes("liệt kê nhân viên") || text.includes("danh sách nhân viên")) {
      const result = await pool.request().query(`
        SELECT ten, email, soDienThoai, gioiTinh
        FROM NhanVien
        WHERE role = 'staff'
        ORDER BY id DESC
      `);

      if (result.recordset.length === 0) {
        return res.json({ reply: "Hiện chưa có nhân viên nào." });
      }

      const ds = result.recordset
        .map((item, index) =>
          `${index + 1}. ${item.ten} - ${item.email} - ${item.soDienThoai || "chưa có số điện thoại"}`
        )
        .join("\n");

      return res.json({
        reply: `Danh sách nhân viên:\n${ds}`
      });
    }


    if (text.includes("liệt kê công việc") || text.includes("danh sách công việc")) {
      const result = await pool.request().query(`
        SELECT TOP 10 cv.tieuDe, cv.trangThai, cv.ngayGiao, cv.han, nv.ten AS tenNhanVien
        FROM CongViec cv
        LEFT JOIN NhanVien nv ON cv.nhanVienId = nv.id
        ORDER BY cv.id DESC
      `);

      if (result.recordset.length === 0) {
        return res.json({ reply: "Hiện chưa có công việc nào." });
      }

      const ds = result.recordset
        .map((item, index) => `${index + 1}. ${item.tieuDe} - ${item.trangThai} - giao: ${item.ngayGiao ? new Date(item.ngayGiao).toISOString().split("T")[0] : ""} - hạn: ${item.han ? new Date(item.han).toISOString().split("T")[0] : ""} - ${item.tenNhanVien || "Chưa gán"}`)
        .join("\n");

      return res.json({
        reply: `Danh sách công việc:\n${ds}`
      });
    }


    if (text.startsWith("công việc của ")) {
      const tenNhanVien = message.substring("công việc của ".length).trim();

      const result = await pool
        .request()
        .input("ten", sql.NVarChar, `%${tenNhanVien}%`)
        .query(`
          SELECT cv.tieuDe, cv.trangThai, cv.ngayGiao, cv.han, nv.ten AS tenNhanVien
          FROM CongViec cv
          LEFT JOIN NhanVien nv ON cv.nhanVienId = nv.id
          WHERE nv.ten LIKE @ten
          ORDER BY cv.id DESC
        `);

      if (result.recordset.length === 0) {
        return res.json({
          reply: `Không tìm thấy công việc nào của ${tenNhanVien}.`
        });
      }

      const ds = result.recordset
        .map((item, index) => `${index + 1}. ${item.tieuDe} - ${item.trangThai} - giao: ${item.ngayGiao ? new Date(item.ngayGiao).toISOString().split("T")[0] : ""} - hạn: ${item.han ? new Date(item.han).toISOString().split("T")[0] : ""}`)
        .join("\n");

      return res.json({
        reply: `Công việc của ${result.recordset[0].tenNhanVien}:\n${ds}`
      });
    }


    return res.json({
      reply: "tôi chưa hiểu câu đó. bạn có thể hỏi những câu hỏi liên quan đến công việc giúp mình."
    });
  } catch (error) {
    console.error("Lỗi /chat:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/chat-ai", async (req, res) => {

  try {

    const { message } = req.body;

    if (!message || !message.trim()) {

      return res.status(400).json({
        reply: "Hãy nhập câu hỏi."
      });
    }

    const pool = await connectDB();

    const [staffResult, taskResult, thongKeResult] = await Promise.all([

      pool.request().query(`
        SELECT
            ten,
            email,
            soDienThoai,
            gioiTinh,
            role
        FROM NhanVien
                ORDER BY id DESC
            `),

      pool.request().query(`
                SELECT TOP 3
                    cv.tieuDe,
                    cv.moTa,
                    cv.trangThai,
                    cv.ngayGiao,
                    cv.han,
                    nv.ten AS tenNhanVien
                FROM CongViec cv
                LEFT JOIN NhanVien nv
                    ON cv.nhanVienId = nv.id
                ORDER BY cv.id DESC
            `),

      pool.request().query(`
                SELECT
                    (SELECT COUNT(*) FROM NhanVien WHERE role = 'staff') AS tongNhanVien,
                    (SELECT COUNT(*) FROM CongViec) AS tongCongViec,
                    (SELECT COUNT(*) FROM CongViec WHERE trangThai = N'Đang làm') AS dangLam,
                    (SELECT COUNT(*) FROM CongViec WHERE trangThai = N'Hoàn thành') AS hoanThanh
            `)

    ]);

    const thongKe = thongKeResult.recordset[0];
    const nhanVien = staffResult.recordset;
    const congViec = taskResult.recordset;


    const prompt = `
Bạn là AI trợ lý quản lý công việc văn phòng.

- Trò chuyện tự nhiên như ChatGPT.
- Trả lời bằng tiếng Việt.
- Có thể chào hỏi và nói chuyện bình thường.
- Nếu liên quan công việc thì dùng dữ liệu hệ thống.
- Trả lời ngắn gọn, dễ hiểu.

THỐNG KÊ:
- Tổng nhân viên: ${thongKe.tongNhanVien}
- Tổng công việc: ${thongKe.tongCongViec}
- Đang làm: ${thongKe.dangLam}
- Hoàn thành: ${thongKe.hoanThanh}

NHÂN VIÊN:
${JSON.stringify(nhanVien)}

CÔNG VIỆC:
${JSON.stringify(congViec)}

TIN NHẮN:
${message}
`;

    const response = await genAI.models.generateContent({


      model: "gemini-2.5-flash",

      contents: prompt

    });

    const aiText =
      response.text ||
      response.candidates?.[0]?.content?.parts?.[0]?.text ||
      "AI không phản hồi.";

    res.json({
      reply: aiText
    });

  } catch (error) {

    console.error("Lỗi /chat-ai:", error);

    res.status(500).json({
      reply: "Chatbot Gemini đang lỗi kết nối hoặc cấu hình."
    });
  }
});
const server = app.listen(3000, () => {
  console.log("Server chạy tại http://localhost:3000");
});

server.on("error", (err) => {
  console.error("Listen error:", err);
});

process.on("exit", (code) => {
  console.log("Process exit với code:", code);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
