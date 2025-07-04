import React, { useEffect, useState } from "react";

const TICKERS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B", "UNH", "JNJ",
  "XOM", "JPM", "V", "MA", "PG", "AVGO", "HD", "PFE", "MRK", "COST",
  "BAC", "WMT", "DIS", "TSM", "ORCL", "PEP", "KO", "ABBV", "NFLX", "AMD"
];

function TradingViewWidget({ symbol }) {
  const widgetId = `tv-${symbol.replace('.', '-')}`;

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: `NASDAQ:${symbol}`,
      width: "100%",
      height: "100",
      locale: "en",
      dateRange: "1D",
      colorTheme: "light",
      isTransparent: false,
      autosize: true
    });

    const container = document.getElementById(widgetId);
    if (container) {
      container.innerHTML = "";
      container.appendChild(script);
    }
  }, [symbol]);

  return (
    <div id={widgetId} className="w-full h-[100px] border p-1 bg-white rounded shadow" />
  );
}

export default function App() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">📈 Top 30 US Stocks Monitor</h1>
      <p className="text-sm text-center mb-4 text-gray-600">Auto-refreshing every 10 minutes | Last refreshed: {time.toLocaleTimeString()}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {TICKERS.map(ticker => (
          <div key={ticker} className="rounded shadow p-2 bg-white">
            <div className="text-sm font-semibold mb-2">{ticker}</div>
            <TradingViewWidget symbol={ticker} />
          </div>
        ))}
      </div>
    </div>
  );
}
