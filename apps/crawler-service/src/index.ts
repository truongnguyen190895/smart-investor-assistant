import { exec, ExecException } from "child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client"; // Import Client vừa generate xong
import * as dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function fetchStockData(symbol: string): Promise<any> {
  return new Promise((resolve, reject) => {
    exec(`./venv/bin/python3 crawler.py ${symbol}`, (error, stdout) => {
      if (error) return reject(error);
      try {
        const startIndex = stdout.indexOf("[");
        if (startIndex === -1) throw new Error("Không có JSON");
        resolve(JSON.parse(stdout.substring(startIndex)));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function main() {
  try {
    const symbol = "VIX";
    console.log(`--- Quy trình phân tích & lưu trữ mã ${symbol} ---`);

    // Bước 1: Cào dữ liệu
    const data = await fetchStockData(symbol);

    // Bước 2: AI phân tích
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Phân tích dữ liệu mã ${symbol}: ${JSON.stringify(data.slice(0, 10))}. Nhận định ngắn gọn.`;

    console.log("🤖 Gemini đang xử lý...");
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    console.log("\n✅ AI TRẢ LỜI:", aiResponse);

    // BƯỚC 3: LƯU VÀO DATABASE
    console.log("\n💾 Đang lưu nhận định vào PostgreSQL...");
    const savedData = await prisma.aiAnalysis.create({
      data: {
        symbol: symbol,
        content: aiResponse,
      },
    });

    console.log(`🚀 Thành công! ID bản ghi: ${savedData.id}`);
  } catch (err) {
    console.error("❌ Lỗi hệ thống:", err);
  } finally {
    await prisma.$disconnect(); // Ngắt kết nối DB khi xong
  }
}

main();
