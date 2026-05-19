import express from "express";
import cors from "cors";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 5001; // Chạy ở cổng 5001 để không trùng với Frontend (5173)

// 1. Cấu hình Middleware
app.use(cors()); // Cho phép web-dashboard gọi API (CORS)
app.use(express.json());

// 2. Cấu hình Prisma 7 với Driver Adapter (Dùng chung DB URL với dự án)
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5433/smart_investor?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 3. Xử lý lỗi BigInt của Prisma khi chuyển sang JSON
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

// ==========================================
// API 1: LẤY DANH SÁCH CÁC MÃ CỔ PHIẾU ĐANG CÓ TRONG DB
// ==========================================
app.get("/api/stocks", async (req, res) => {
  try {
    // Gom nhóm theo symbol để biết trong DB đang lưu những mã nào
    const stocks = await prisma.stockPrice.groupBy({
      by: ["symbol"],
    });
    const symbols = stocks.map((s) => s.symbol);
    res.json({ success: true, data: symbols });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// API 2: LẤY CHI TIẾT NẾN GIÁ VÀ NHẬN ĐỊNH AI CỦA MỘT MÃ
// ==========================================
app.get("/api/stocks/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const upperSymbol = symbol.toUpperCase();

  try {
    // Chạy song song 2 câu lệnh lấy Dữ liệu nến và Nhận định AI gần nhất
    const [prices, analysis] = await Promise.all([
      prisma.stockPrice.findMany({
        where: { symbol: upperSymbol },
        orderBy: { time: "asc" }, // Sắp xếp từ cũ đến mới để vẽ Chart từ trái qua phải
      }),
      prisma.aiAnalysis.findFirst({
        where: { symbol: upperSymbol },
        orderBy: { createdAt: "desc" }, // Lấy bài nhận định mới nhất của Gemini
      }),
    ]);

    if (prices.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: `Không tìm thấy dữ liệu cho mã ${upperSymbol}`,
        });
    }

    res.json({
      success: true,
      data: {
        symbol: upperSymbol,
        analysis: analysis
          ? analysis.content
          : "Chưa có nhận định từ AI cho mã này.",
        prices: prices,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Khởi động Server
app.listen(port, () => {
  console.log(
    `📡 [api-engine] Server đang chạy mượt mà tại http://localhost:${port}`,
  );
});
