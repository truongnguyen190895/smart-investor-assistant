import { exec, ExecException } from 'child_process';

function fetchStockData(symbol: string): Promise<any> {
    return new Promise((resolve, reject) => {
        exec(`./venv/bin/python3 crawler.py ${symbol}`, (error: ExecException | null, stdout: string, stderr: string) => {
            if (error) {
                reject(error);
                return;
            }

            try {
                const startIndex = stdout.indexOf('[');
                if (startIndex === -1) {
                    throw new Error("Không tìm thấy dữ liệu JSON từ Python");
                }
                const jsonData = stdout.substring(startIndex);
                resolve(JSON.parse(jsonData));
            } catch (parseError) {
                reject(`Lỗi parse JSON: ${parseError}`);
            }
        });
    });
}

async function main() {
    try {
        console.log("--- Khởi chạy Bridge Python-Node.js ---");
        const dataVIX = await fetchStockData('VIX');
        console.log("✅ Dữ liệu nhận được từ Python cho mã VIX:");
        console.log(dataVIX.slice(0, 2));
    } catch (err) {
        console.error("❌ Có lỗi xảy ra:", err);
    }
}

main();