import axios from "axios";

const ALPHA_API_KEY = "XCHRXA73EI71XJHG";
const TELEGRAM_BOT_TOKEN = "7512439040:AAExqGQaN-4vC6PnT0f12n6J_vlE3xYQp3k";
const TELEGRAM_CHAT_ID = "573040944";
const MAX_LOG_SIZE = 20;

let alertLog = [];
let alertsEnabled = true;
let currentDate = new Date().toDateString();

const top30 = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B", "UNH", "JNJ",
  "XOM", "JPM", "V", "MA", "PG", "AVGO", "HD", "PFE", "MRK", "COST",
  "BAC", "WMT", "DIS", "TSM", "ORCL", "PEP", "KO", "ABBV", "NFLX", "AMD"
];

function logAlert(msg) {
  const now = new Date().toDateString();
  if (now !== currentDate) {
    alertLog = [];
    currentDate = now;
  }
  alertLog.unshift({ msg, time: new Date().toLocaleTimeString() });
  if (alertLog.length > MAX_LOG_SIZE) alertLog.pop();
}

async function fetchIntradayChange(symbol) {
  const url = \`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=\${symbol}&interval=60min&apikey=\${ALPHA_API_KEY}\`;
  const res = await axios.get(url);
  const data = res.data["Time Series (60min)"];
  if (!data) throw new Error("No intraday data");
  const times = Object.keys(data).sort().reverse();
  const latest = parseFloat(data[times[0]]["4. close"]);
  const old = parseFloat(data[times[Math.min(4, times.length - 1)]]["4. close"]);
  const change = ((latest - old) / old * 100).toFixed(2);
  return { symbol, latest, old, change };
}

async function fetch72WeekDrop(symbol) {
  const url = \`https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol=\${symbol}&apikey=\${ALPHA_API_KEY}\`;
  const res = await axios.get(url);
  const data = res.data["Weekly Adjusted Time Series"];
  if (!data) throw new Error("No weekly data");
  const dates = Object.keys(data).slice(0, 104);
  const recentDates = dates.slice(0, 8);
  const high72 = Math.max(...dates.map(d => parseFloat(data[d]["2. high"])));
  const latest = parseFloat(data[recentDates[0]]["4. close"]);
  const drop = ((latest - high72) / high72 * 100).toFixed(2);
  return { symbol, latest, high72, drop };
}

async function sendTelegramAlert(message) {
  const url = \`https://api.telegram.org/bot\${TELEGRAM_BOT_TOKEN}/sendMessage\`;
  await axios.post(url, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message
  });
}

function handleTelegramCommands(text) {
  if (text === "/status") {
    return alertLog.length
      ? alertLog.slice(0, 5).map(a => \`[\${a.time}] \${a.msg}\`).join("\n")
      : "📭 No alerts today.";
  }
  if (text === "/summary") {
    return "✅ Monitoring top 30 stocks every 10 minutes. Alerts enabled.";
  }
  if (text === "/toggle") {
    alertsEnabled = !alertsEnabled;
    return \`Alerts are now \${alertsEnabled ? "ENABLED" : "DISABLED"} 🚦\`;
  }
  return "Unknown command.";
}

export default async function handler(req, res) {
  if (req.method === "POST" && req.body?.message?.text?.startsWith("/")) {
    const response = handleTelegramCommands(req.body.message.text.trim());
    await sendTelegramAlert(response);
    return res.status(200).json({ ok: true });
  }

  let alerts = [];
  for (const symbol of top30) {
    try {
      const data = await fetchIntradayChange(symbol);
      const drop = parseFloat(data.change);
      if (alertsEnabled && drop <= -3) {
        const msg = \`\${symbol} dropped \${drop}% in 4 hrs! 💰\${data.old} → \${data.latest}\`;
        await sendTelegramAlert("⚠️ " + msg);
        logAlert(msg);
        alerts.push(msg);
      }
    } catch {}

    try {
      const dropData = await fetch72WeekDrop(symbol);
      const drop = parseFloat(dropData.drop);
      if (alertsEnabled && drop <= -35) {
        const msg = \`\${symbol} down \${drop}% from 72w high! 📉 \${dropData.high72} → \${dropData.latest}\`;
        await sendTelegramAlert("🔻 " + msg);
        logAlert(msg);
        alerts.push(msg);
      }
    } catch {}
  }

  res.status(200).json({ success: true, alerts, alertLog });
}
