import axios from "axios";

const ALPHA_API_KEY = "XCHRXA73EI71XJHG";
const OPENAI_API_KEY = "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";
const TELEGRAM_BOT_TOKEN = "7512439040:AAExqGQaN-4vC6PnT0f12n6J_vlE3xYQp3k";
const TELEGRAM_CHAT_ID = "573040944";

let alertLog = [];
let alertsEnabled = true;
let currentDate = new Date().toDateString();
let latestAISummary = "";

const top30 = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B", "UNH", "JNJ",
  "XOM", "JPM", "V", "MA", "PG", "AVGO", "HD", "PFE", "MRK", "COST",
  "BAC", "WMT", "DIS", "TSM", "ORCL", "PEP", "KO", "ABBV", "NFLX", "AMD"
];

function logAlert(msg) {
  try {
    const now = new Date().toDateString();
    if (now !== currentDate) {
      alertLog = [];
      currentDate = now;
    }
    alertLog.unshift({ msg, time: new Date().toLocaleTimeString() });
    if (alertLog.length > 30) alertLog.pop();
  } catch (error) {
    console.error("Error logging alert:", error);
  }
}

async function fetchIntradayChange(symbol) {
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=60min&apikey=${ALPHA_API_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    
    if (!res.data || typeof res.data !== 'object') {
      throw new Error("Invalid response format");
    }
    
    const data = res.data["Time Series (60min)"];
    if (!data || typeof data !== 'object') {
      throw new Error("No intraday data available");
    }
    
    const times = Object.keys(data).sort().reverse();
    if (times.length === 0) {
      throw new Error("No time series data");
    }
    
    const latestTime = times[0];
    const oldTime = times[Math.min(4, times.length - 1)];
    
    if (!data[latestTime] || !data[oldTime]) {
      throw new Error("Missing price data");
    }
    
    const latest = parseFloat(data[latestTime]["4. close"]);
    const old = parseFloat(data[oldTime]["4. close"]);
    
    if (isNaN(latest) || isNaN(old) || old === 0) {
      throw new Error("Invalid price data");
    }
    
    const change = ((latest - old) / old * 100).toFixed(2);
    return { symbol, latest, old, change };
  } catch (error) {
    console.error(`Error fetching intraday data for ${symbol}:`, error.message);
    throw error;
  }
}

async function fetch72WeekDrop(symbol) {
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol=${symbol}&apikey=${ALPHA_API_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    
    if (!res.data || typeof res.data !== 'object') {
      throw new Error("Invalid response format");
    }
    
    const data = res.data["Weekly Adjusted Time Series"];
    if (!data || typeof data !== 'object') {
      throw new Error("No weekly data available");
    }
    
    const dates = Object.keys(data).slice(0, 104);
    if (dates.length === 0) {
      throw new Error("No weekly data points");
    }
    
    const recentDates = dates.slice(0, 8);
    if (recentDates.length === 0) {
      throw new Error("No recent data points");
    }
    
    const highs = dates.map(d => {
      const high = parseFloat(data[d]["2. high"]);
      return isNaN(high) ? 0 : high;
    }).filter(h => h > 0);
    
    if (highs.length === 0) {
      throw new Error("No valid high prices");
    }
    
    const high72 = Math.max(...highs);
    const latest = parseFloat(data[recentDates[0]]["4. close"]);
    
    if (isNaN(latest) || isNaN(high72) || high72 === 0) {
      throw new Error("Invalid price data");
    }
    
    const drop = ((latest - high72) / high72 * 100).toFixed(2);
    return { symbol, latest, high72, drop };
  } catch (error) {
    console.error(`Error fetching 72-week data for ${symbol}:`, error.message);
    throw error;
  }
}

async function sendTelegramAlert(text) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error("Invalid message text");
    }
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, { 
      chat_id: TELEGRAM_CHAT_ID, 
      text: text.slice(0, 4096) // Telegram message limit
    }, { timeout: 10000 });
  } catch (error) {
    console.error("Error sending Telegram alert:", error.message);
    // Don't throw error to prevent breaking the main flow
  }
}

function handleCommand(text) {
  try {
    if (!text || typeof text !== 'string') {
      return "Invalid command format.";
    }
    
    const command = text.trim().toLowerCase();
    
    if (command === "/status") {
      return alertLog.length
        ? alertLog.slice(0, 5).map(a => `[${a.time}] ${a.msg}`).join("\n")
        : "📭 No alerts yet today.";
    }
    
    if (command === "/summary") {
      return latestAISummary || "No AI summary yet.";
    }
    
    if (command === "/toggle") {
      alertsEnabled = !alertsEnabled;
      return `🚦 Alerts are now ${alertsEnabled ? "ENABLED" : "DISABLED"}`;
    }
    
    return "Unknown command. Available commands: /status, /summary, /toggle";
  } catch (error) {
    console.error("Error handling command:", error);
    return "Error processing command.";
  }
}

async function generateAISummary(topGainers, topLosers) {
  try {
    if (!Array.isArray(topGainers) || !Array.isArray(topLosers)) {
      throw new Error("Invalid input data");
    }
    
    const date = new Date().toLocaleDateString("en-US");
    const gainers = topGainers.length > 0 
      ? topGainers.map(s => `${s.symbol} (${s.change}%)`).join(", ")
      : "None";
    const losers = topLosers.length > 0 
      ? topLosers.map(s => `${s.symbol} (${s.change}%)`).join(", ")
      : "None";

    const prompt = `Today is ${date}. Top gainers: ${gainers}. Top losers: ${losers}. Write a 3-4 sentence market summary like a financial analyst.`;
    
    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a financial market analyst." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 200
    }, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      timeout: 15000
    });

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      throw new Error("Invalid OpenAI response");
    }

    const summary = response.data.choices[0].message.content.trim();
    latestAISummary = `🧠 AI Summary:\n${summary}`;
    return latestAISummary;
  } catch (error) {
    console.error("Error generating AI summary:", error.message);
    const fallbackSummary = `🧠 AI Summary:\nMarket activity detected with ${topGainers.length} gainers and ${topLosers.length} losers today. AI summary temporarily unavailable.`;
    latestAISummary = fallbackSummary;
    return fallbackSummary;
  }
}

export default async function handler(req, res) {
  try {
    // Handle Telegram commands
    if (req.method === "POST" && req.body?.message?.text?.startsWith("/")) {
      const reply = handleCommand(req.body.message.text.trim());
      await sendTelegramAlert(reply);
      return res.status(200).json({ ok: true });
    }

    let alerts = [], gainers = [], losers = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each stock with error handling
    for (const symbol of top30) {
      try {
        // Fetch intraday data
        const data = await fetchIntradayChange(symbol);
        const change = parseFloat(data.change);
        
        if (!isNaN(change)) {
          if (change >= 1) gainers.push({ symbol, change });
          if (change <= -1) losers.push({ symbol, change });

          if (alertsEnabled && change <= -3) {
            const msg = `${symbol} dropped ${change}% in 4 hrs! 💰 ${data.old} → ${data.latest}`;
            await sendTelegramAlert("⚠️ " + msg);
            logAlert(msg);
            alerts.push(msg);
          }
        }
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Intraday error for ${symbol}:`, error.message);
      }

      try {
        // Fetch 72-week data
        const dropData = await fetch72WeekDrop(symbol);
        const drop = parseFloat(dropData.drop);
        
        if (!isNaN(drop) && alertsEnabled && drop <= -35) {
          const msg = `${symbol} down ${drop}% from 72w high! 📉 ${dropData.high72} → ${dropData.latest}`;
          await sendTelegramAlert("🔻 " + msg);
          logAlert(msg);
          alerts.push(msg);
        }
      } catch (error) {
        console.error(`72-week error for ${symbol}:`, error.message);
      }
    }

    // Sort gainers and losers
    gainers.sort((a, b) => parseFloat(b.change) - parseFloat(a.change));
    losers.sort((a, b) => parseFloat(a.change) - parseFloat(b.change));

    // Generate and send AI summary
    const summary = await generateAISummary(gainers.slice(0, 3), losers.slice(0, 3));
    await sendTelegramAlert(summary);

    res.status(200).json({ 
      success: true, 
      alerts, 
      alertLog, 
      aiSummary: summary,
      stats: {
        successCount,
        errorCount,
        totalProcessed: top30.length,
        gainersCount: gainers.length,
        losersCount: losers.length
      }
    });

  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error",
      message: error.message 
    });
  }
}
