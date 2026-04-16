import { exec } from 'child_process';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function main() {
    try {
        const symbol = 'SHB';
        console.log(`🚀 Đang lấy dữ liệu mã ${symbol} từ Python...`);
        const stockData = await new Promise((resolve, reject) => {
            exec(`./venv/bin/python3 crawler.py ${symbol}`, (error, stdout) => {
                if (error) return reject(error);
                const startIndex = stdout.indexOf('[');
                resolve(JSON.parse(stdout.substring(startIndex)));
            });
        });
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `Bạn là chuyên gia chứng khoán. Đây là dữ liệu mã ${symbol}: ${JSON.stringify(stockData)}. Nhận định ngắn gọn xu hướng giá.`;

        console.log(`🤖 Gemini đang phân tích với Key mới...`);

        const result = await model.generateContent(prompt);
        console.log("\n✅ AI TRẢ LỜI:");
        console.log(result.response.text());

    } catch (err: any) {
        console.error("❌ Lỗi:");
        console.error(err.message);
        if (err.message.includes("404")) {
            console.log("💡 Mẹo: Thử đổi model thành 'gemini-1.5-pro' hoặc 'gemini-pro'");
        }
    }
}

async function checkAvailableModels() {
    const apiKey = process.env.GEMINI_API_KEY!;
    try {
        console.log("--- Đang truy vấn danh sách Model từ Google API ---");
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        const data: any = await response.json();

        if (data.models) {
            console.log("✅ Các model Key của bạn có thể sử dụng:");
            data.models.forEach((m: any) => {
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ID: ${m.name.replace('models/', '')} | (${m.displayName})`);
                }
            });
        } else {
            console.error("❌ Không lấy được danh sách model. Kiểm tra lại API Key!");
            console.log("Phản hồi từ server:", data);
        }
    } catch (error) {
        console.error("❌ Lỗi kết nối:", error);
    }
}

main();
