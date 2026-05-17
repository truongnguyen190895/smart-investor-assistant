import { exec } from "child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

// Khởi tạo Database Adapter & AI Client
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Hàm gọi Python cào dữ liệu (Giữ nguyên)
function fetchStockData(symbol: string): Promise<any> {
  return new Promise((resolve, reject) => {
    exec(`./venv/bin/python3 crawler.py ${symbol}`, (error, stdout) => {
      if (error) return reject(error);
      try {
        const startIndex = stdout.indexOf("[");
        if (startIndex === -1) throw new Error("Không tìm thấy dữ liệu JSON");
        resolve(JSON.parse(stdout.substring(startIndex)));
      } catch (e) {
        reject(e);
      }
    });
  });
}

// HÀM XỬ LÝ CHO TỪNG MÃ CỔ PHIẾU (TÁCH RA TỪ MAIN)
async function processStock(symbol: string) {
  try {
    console.log(`\n🔍 [${symbol}] Bắt đầu quy trình kiểm tra...`);

    // 1. Cào dữ liệu
    const data = await fetchStockData(symbol);

    // 2. Kiểm tra Cache trong ngày hôm nay
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existingAnalysis = await prisma.aiAnalysis.findFirst({
      where: {
        symbol: symbol,
        createdAt: { gte: todayStart },
      },
      orderBy: { createdAt: "desc" },
    });

    let aiResponse = "";

    if (existingAnalysis) {
      console.log(`⚡ [${symbol}] Cache Hit! Đã có nhận định hôm nay.`);
      aiResponse = existingAnalysis.content;
    } else {
      console.log(`🌐 [${symbol}] Cache Miss! Đang hỏi Gemini AI...`);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      // NÂNG CẤP PROMPT & TRUYỀN TOÀN BỘ DỮ LIỆU (Bỏ .slice)
      const prompt = `
        Bạn là một chuyên gia phân tích kỹ thuật chứng khoán cấp cao.
        Hãy phân tích toàn bộ dữ liệu lịch sử giá sau đây của mã cổ phiếu ${symbol}:
        ${JSON.stringify(data)}

        Yêu cầu bài viết nhận định:
        1. Xu hướng giá (Ngắn hạn và Trung hạn dựa trên toàn bộ chuỗi dữ liệu).
        2. Phân tích Khối lượng giao dịch (Tìm những ngày có khối lượng đột biến và ý nghĩa của nó).
        3. Đưa ra Nhận định ngắn gọn/Khuyến nghị hành động (Mua, Bán, hay Theo dõi).
        
        Viết ngắn gọn, súc tích, xuống dòng rõ ràng bằng các gạch đầu dòng.
    `;

      const result = await model.generateContent(prompt);
      aiResponse = result.response.text();

      // Lưu nhận định mới
      await prisma.aiAnalysis.create({
        data: { symbol, content: aiResponse },
      });
      console.log(`💾 [${symbol}] Đã lưu nhận định mới vào DB.`);
    }

    // 3. Đồng bộ dữ liệu nến (OHLC)
    const formattedPrices = data.map((item: any) => {
      const localTimeStr = item.time.includes("T")
        ? item.time
        : `${item.time}T00:00:00+07:00`;
      return {
        symbol: symbol,
        time: new Date(localTimeStr),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: BigInt(item.volume),
      };
    });

    const savedPrices = await prisma.stockPrice.createMany({
      data: formattedPrices,
      skipDuplicates: true,
    });
    console.log(
      `📈 [${symbol}] Đã đồng bộ ${savedPrices.count} dòng dữ liệu nến.`,
    );
  } catch (error) {
    console.error(`❌ [${symbol}] Gặp lỗi trong quá trình xử lý:`, error);
  }
}

// HÀM MAIN: ĐIỀU PHỐI DANH MỤC WATCHLIST
async function main() {
  // Bạn có thể thêm bất kỳ mã nào bạn muốn theo dõi vào đây
  const watchlist = ["VIX", "SHB", "SSI", "FPT"];

  console.log(
    `🚀 KHỞI CHẠY HỆ THỐNG PHÂN TÍCH DANH MỤC: ${watchlist.join(", ")}`,
  );
  const startTime = Date.now();

  // Kích hoạt chạy song song tất cả các mã cùng một lúc
  await Promise.all(watchlist.map((symbol) => processStock(symbol)));

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 TẤT CẢ CÁC MÃ ĐÃ ĐƯỢC XỬ LÝ XONG TRONG ${duration} GIÂY!`);

  await prisma.$disconnect();
  pool.end(); // Đóng bể kết nối của pg
}

main();
