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

    // lấy thông báo hiện tại
    const thongBaoResult = await pool.request()
      .input("id", sql.Int, id)
      .query(`
                SELECT *
                FROM ThongBao
                WHERE id = @id
            `);

    if (thongBaoResult.recordset.length === 0) {

      return res.status(404).json({
        message: "Không tìm thấy thông báo"
      });
    }

    const thongBao =
      thongBaoResult.recordset[0];

    // cập nhật đã đọc
    await pool.request()
      .input("id", sql.Int, id)
      .query(`
                UPDATE ThongBao_Read
                SET
                    DaDoc = 1,
                    ThoiGianDoc = GETDATE()
                WHERE ThongBaoId = @id
            `);

    // lấy nhân viên đã đọc
    const nhanVienResult = await pool.request()
      .input("nhanVienId", sql.Int, thongBao.nhanVienId)
      .query(`
                SELECT ten
                FROM NhanVien
                WHERE id = @nhanVienId
            `);

    const tenNhanVien =
      nhanVienResult.recordset[0]?.ten ||
      "Nhân viên";

    // tìm admin
    const adminResult = await pool.request()
      .query(`
                SELECT id
                FROM NhanVien
                WHERE role = 'admin'
            `);

    // tạo thông báo cho admin
    for (const admin of adminResult.recordset) {

      await pool.request()
        .input(
          "noiDung",
          sql.NVarChar,
          `${tenNhanVien} đã đọc thông báo: "${thongBao.noiDung}"`
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

    console.error(error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
});


app.post("/login", async (req, res) => {
  try {
    const { email, matkhau } = req.body;
    const pool = await connectDB();

    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("matkhau", sql.NVarChar, matkhau)
      .query(`
        SELECT id, ten, email, role
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
    const { ten, email, matkhau, role } = req.body;
    const pool = await connectDB();

    const check = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT * FROM NhanVien WHERE email = @email");

    if (check.recordset.length > 0) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    await pool
      .request()
      .input("ten", sql.NVarChar, ten)
      .input("email", sql.NVarChar, email)
      .input("matkhau", sql.NVarChar, matkhau)
      .input("role", sql.NVarChar, role || "staff")
      .query(`
        INSERT INTO NhanVien (ten, email, matkhau, role)
        VALUES (@ten, @email, @matkhau, @role)
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
      matkhau,
      role
    } = req.body;

    const pool = await connectDB();

    const check = await pool
      .request()
      .input("email", sql.NVarChar, email)
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
      .input("ten", sql.NVarChar, ten)
      .input("email", sql.NVarChar, email)
      .input("matkhau", sql.NVarChar, matkhau)
      .input("role", sql.NVarChar, role)
      .query(`
        UPDATE NhanVien
        SET
          ten = @ten,
          email = @email,
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

app.put("/thongbao/dadoc/:id", async (req, res) => {

  try {

    const { id } = req.params;

    const pool = await connectDB();

    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        UPDATE ThongBao
        SET daDoc = 1
        WHERE id = @id
      `);

    res.json({
      message: "Đã cập nhật thông báo"
    });

  } catch (error) {

    console.error(
      "Lỗi PUT /thongbao/dadoc/:id:",
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
    const { tieuDe, moTa, trangThai, han, nhanVienId } = req.body;
    const pool = await connectDB();
    const oldTask = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
          SELECT *
          FROM CongViec
          WHERE id = @id
        `)
    const cvCu = oldTask.recordset[0];
    let noiDungThongBao = "";

    // đổi tên công việc
    if (cvCu.tieuDe !== tieuDe) {

      noiDungThongBao =
        `Tên công việc đã đổi từ "${cvCu.tieuDe}" thành "${tieuDe}"`;
    }

    // đổi trạng thái
    else if (cvCu.trangThai !== trangThai) {

      noiDungThongBao =
        `Công việc "${tieuDe}" đã cập nhật trạng thái: ${trangThai}`;
    }

    // đổi hạn
    else if (
      String(cvCu.han).split("T")[0] !==
      String(han).split("T")[0]
    ) {

      noiDungThongBao =
        `Công việc "${tieuDe}" đã đổi hạn sang ${han}`;
    }

    // đổi nhân viên
    else if (cvCu.nhanVienId != nhanVienId) {

      noiDungThongBao =
        `Bạn được giao công việc mới: "${tieuDe}"`;
    }
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("tieuDe", sql.NVarChar, tieuDe)
      .input("moTa", sql.NVarChar, moTa)
      .input("trangThai", sql.NVarChar, trangThai)
      .input("han", sql.NVarChar, han)
      .input("nhanVienId", sql.Int, nhanVienId)
      .query(`
        UPDATE CongViec
        SET tieuDe = @tieuDe,
            moTa = @moTa,
            trangThai = @trangThai,
            han = @han,
            nhanVienId = @nhanVienId
        WHERE id = @id
      `);

    if (noiDungThongBao !== "") {

      await pool
        .request()
        .input("noiDung", sql.NVarChar, noiDungThongBao)
        .input("nhanVienId", sql.Int, nhanVienId)
        .query(`
        INSERT INTO ThongBao (noiDung, nhanVienId)
        VALUES (@noiDung, @nhanVienId)
      `);
    }

    res.json({ message: "Cập nhật công việc thành công" });
  } catch (error) {
    console.error("Lỗi PUT /congviec/:id:", error.message);
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
    const { tieuDe, moTa, trangThai, han, nhanVienId } = req.body;
    const pool = await connectDB();

    await pool
      .request()
      .input("tieuDe", sql.NVarChar, tieuDe)
      .input("moTa", sql.NVarChar, moTa)
      .input("trangThai", sql.NVarChar, trangThai)
      .input("han", sql.NVarChar, han)
      .input("nhanVienId", sql.Int, nhanVienId)
      .query(`
        INSERT INTO CongViec (tieuDe, moTa, trangThai, han, nhanVienId)
        VALUES (@tieuDe, @moTa, @trangThai, @han, @nhanVienId)
      `);
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
        SELECT ten, email
        FROM NhanVien
        WHERE role = 'staff'
        ORDER BY id DESC
      `);

      if (result.recordset.length === 0) {
        return res.json({ reply: "Hiện chưa có nhân viên nào." });
      }

      const ds = result.recordset
        .map((item, index) => `${index + 1}. ${item.ten} - ${item.email}`)
        .join("\n");

      return res.json({
        reply: `Danh sách nhân viên:\n${ds}`
      });
    }


    if (text.includes("liệt kê công việc") || text.includes("danh sách công việc")) {
      const result = await pool.request().query(`
        SELECT TOP 10 cv.tieuDe, cv.trangThai, nv.ten AS tenNhanVien
        FROM CongViec cv
        LEFT JOIN NhanVien nv ON cv.nhanVienId = nv.id
        ORDER BY cv.id DESC
      `);

      if (result.recordset.length === 0) {
        return res.json({ reply: "Hiện chưa có công việc nào." });
      }

      const ds = result.recordset
        .map((item, index) => `${index + 1}. ${item.tieuDe} - ${item.trangThai} - ${item.tenNhanVien || "Chưa gán"}`)
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
          SELECT cv.tieuDe, cv.trangThai, cv.han, nv.ten AS tenNhanVien
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
        .map((item, index) => `${index + 1}. ${item.tieuDe} - ${item.trangThai} - hạn: ${item.han ? new Date(item.han).toISOString().split("T")[0] : ""}`)
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
                    role
                FROM NhanVien
                ORDER BY id DESC
            `),

      pool.request().query(`
                SELECT TOP 3
                    cv.tieuDe,
                    cv.moTa,
                    cv.trangThai,
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