import sys
import json

# Kiểm tra các thư viện quan trọng trước khi chạy
try:
    import pandas
    import requests
    from vnstock import stock_historical_data
except ImportError as e:
    print(json.dumps({"error": f"Thiếu thư viện: {str(e)}. Hãy chạy 'pip install packaging lxml beautifulsoup4'"}))
    sys.exit(1)

def get_data(symbol):
    try:
        # Lấy dữ liệu 30 ngày gần đây
        from datetime import datetime, timedelta
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        
        df = stock_historical_data(symbol=symbol, 
                                   start_date=start_date, 
                                   end_date=end_date, 
                                   resolution='1D', 
                                   type='stock')

        if df is not None and not df.empty:
            # Chuyển đổi sang JSON để Node.js đọc
            result = df.to_json(orient='records', date_format='iso')
            print(result)
        else:
            print(json.dumps({"error": f"Không có dữ liệu cho mã {symbol}"}))
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else 'VIX'
    get_data(target)