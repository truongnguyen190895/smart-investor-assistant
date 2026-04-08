import { exec } from 'child_process';

function fetchStockData(symbol: string): Promise<any> {
    return new Promise((resolve, reject) => {
        exec(`python crawer.py ${symbol}`, (error, stdout stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(JSON.parse(stdout))
        })
    })
}

async function main() {
    console.log("--- Khởi chạy Bridge Python-Node.js ---");
    const dataVIX = await fetchStockData('VIX');
    console.log("Dữ liệu nhận được từ Python:", dataVIX.slice(0, 2));
}

main()