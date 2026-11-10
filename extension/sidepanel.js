/**
 * LeadSniper Pro — Side Panel Controller
 * Manages real-time Google Maps scraping, website funnel vulnerability enrichment,
 * 1-Click Client Pitch Audit PDF generation, CSV export, and Whop License verification.
 */

let allLeads = [];
let isPro = false;
const FREE_LIMIT = 15;

const LEAK_LABELS = {
  NO_WEBSITE: { text: "❌ NO WEBSITE", cls: "critical" },
  SITE_UNREACHABLE: { text: "⚠️ SITE BROKEN", cls: "critical" },
  NO_SSL: { text: "🔓 NO SSL (HTTP)", cls: "critical" },
  NO_FB_PIXEL: { text: "📉 NO META PIXEL", cls: "warn" },
  NO_CHAT_WIDGET: { text: "💬 NO AI CHAT / BOOKING", cls: "warn" },
  NO_ANALYTICS: { text: "📊 NO GOOGLE TAG", cls: "normal" },
  LOW_REVIEWS: { text: "⭐ LOW REVIEWS (<25)", cls: "warn" }
};

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get(["lsp_leads", "lsp_license", "lsp_is_pro"]);
  if (stored.lsp_is_pro && stored.lsp_license) {
    isPro = true;
    document.getElementById("licenseInput").value = stored.lsp_license;
    setProUI(true, "Pro Lifetime License Active");
  }
  if (Array.isArray(stored.lsp_leads) && stored.lsp_leads.length > 0) {
    allLeads = stored.lsp_leads;
    renderLeads();
  }

  document.getElementById("toggleLicenseBtn").addEventListener("click", () => {
    const box = document.getElementById("licenseBox");
    box.style.display = box.style.display === "none" ? "block" : "none";
  });

  document.getElementById("activateBtn").addEventListener("click", handleActivateLicense);
  document.getElementById("startBtn").addEventListener("click", startScraping);
  document.getElementById("stopBtn").addEventListener("click", stopScraping);
  document.getElementById("filterLeaksOnly").addEventListener("change", renderLeads);
  document.getElementById("exportCsvBtn").addEventListener("click", exportToCsv);
  document.getElementById("clearBtn").addEventListener("click", clearLeads);
  document.getElementById("demoBtn").addEventListener("click", loadDemoLeads);
  document.getElementById("openMapsBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.google.com/maps/search/Med+Spa+Miami" });
  });
});

function setProUI(active, msg) {
  isPro = active;
  const badge = document.getElementById("planBadge");
  const status = document.getElementById("licenseStatus");
  if (active) {
    badge.textContent = "PRO UNLIMITED";
    badge.classList.add("active");
    status.textContent = "✅ " + msg;
    status.style.color = "#34d399";
  } else {
    badge.textContent = "STARTER";
    badge.classList.remove("active");
    status.textContent = msg;
    status.style.color = "#fb7185";
  }
}

async function handleActivateLicense() {
  const key = document.getElementById("licenseInput").value.trim();
  const status = document.getElementById("licenseStatus");
  status.textContent = "Verifying with Whop...";
  chrome.runtime.sendMessage({ type: "VERIFY_LICENSE", licenseKey: key }, async (res) => {
    if (res && res.valid) {
      await chrome.storage.local.set({ lsp_license: key, lsp_is_pro: true });
      setProUI(true, res.message || "License Activated!");
      renderLeads();
    } else {
      setProUI(false, (res && res.message) || "Invalid license key.");
    }
  });
}

async function getActiveMapsTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function startScraping() {
  const tab = await getActiveMapsTab();
  if (!tab || !tab.url || !tab.url.includes("google.com/maps")) {
    chrome.tabs.create({ url: "https://www.google.com/maps/search/Roofing+Contractors+Dallas" });
    return;
  }
  document.getElementById("startBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;

  chrome.tabs.sendMessage(tab.id, { type: "START_SCRAPE" }).catch(async () => {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    chrome.tabs.sendMessage(tab.id, { type: "START_SCRAPE" });
  });
}

async function stopScraping() {
  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
  const tab = await getActiveMapsTab();
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "STOP_SCRAPE" }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "NEW_LEADS_BATCH" && Array.isArray(msg.leads)) {
    for (const raw of msg.leads) {
      if (!isPro && allLeads.length >= FREE_LIMIT) {
        stopScraping();
        setProUI(false, `Starter limit (${FREE_LIMIT} leads) reached. Unlock Pro for unlimited leads!`);
        break;
      }
      if (allLeads.some((l) => l.name === raw.name && l.phone === raw.phone)) continue;

      const lead = {
        ...raw,
        emails: [],
        socials: { instagram: "", facebook: "", linkedin: "", tiktok: "" },
        leaks: raw.website ? [] : ["NO_WEBSITE"],
        leakScore: raw.website ? 40 : 95,
        recommendedPitch: "Scanning website funnel...",
        scanned: false
      };
      allLeads.unshift(lead);
      enrichLeadInBackground(lead);
    }
    chrome.storage.local.set({ lsp_leads: allLeads });
    renderLeads();
  }
});

function enrichLeadInBackground(lead) {
  chrome.runtime.sendMessage(
    {
      type: "DEEP_SCAN_WEBSITE",
      url: lead.website,
      rating: lead.rating,
      reviews: lead.reviews
    },
    (resp) => {
      if (resp && resp.ok && resp.data) {
        Object.assign(lead, resp.data, { scanned: true });
        chrome.storage.local.set({ lsp_leads: allLeads });
        renderLeads();
      }
    }
  );
}

function renderLeads() {
  const container = document.getElementById("leadsContainer");
  const emptyState = document.getElementById("emptyState");
  const leaksOnly = document.getElementById("filterLeaksOnly").checked;

  const filtered = leaksOnly
    ? allLeads.filter((l) => (l.leaks && l.leaks.length > 0) || l.leakScore >= 50)
    : allLeads;

  document.getElementById("statTotal").textContent = allLeads.length;
  document.getElementById("statEmails").textContent = allLeads.filter((l) => (l.emails && l.emails.length > 0) || l.phone).length;
  document.getElementById("statLeaks").textContent = allLeads.filter((l) => l.leaks && l.leaks.length > 0).length;
  document.getElementById("exportCount").textContent = filtered.length;

  Array.from(container.querySelectorAll(".lead-card")).forEach((el) => el.remove());

  if (filtered.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  filtered.forEach((lead) => {
    const card = document.createElement("div");
    card.className = "lead-card";

    const badgesHtml = (lead.leaks || [])
      .map((code) => {
        const meta = LEAK_LABELS[code] || { text: code, cls: "normal" };
        return `<span class="leak-tag ${meta.cls}">${meta.text}</span>`;
      })
      .join("");

    const emailText = lead.emails && lead.emails.length > 0 ? `✉️ ${lead.emails[0]}` : "✉️ No email on site";
    const phoneText = lead.phone ? `📞 ${lead.phone}` : "📞 No phone";
    const ratingText = lead.rating ? `⭐ ${lead.rating} (${lead.reviews} reviews)` : "⭐ No rating";

    card.innerHTML = `
      <div class="lead-top">
        <div>
          <div class="lead-title">${escapeHtml(lead.name)}</div>
          <div class="lead-meta">${escapeHtml(lead.category)} · ${ratingText}</div>
        </div>
        <span class="score-pill">Leak Score: ${lead.leakScore || 50}/99</span>
      </div>
      <div class="leak-badges">${badgesHtml || '<span class="leak-tag">✅ Healthy Funnel</span>'}</div>
      <div class="contact-row">
        <span>${escapeHtml(phoneText)}</span>
        <span>${escapeHtml(emailText)}</span>
      </div>
      <div class="pitch-box">${escapeHtml(lead.recommendedPitch || "")}</div>
      <div class="card-actions">
        <button class="btn-audit" data-id="${lead.id}">📄 1-Click Client Audit PDF</button>
        <button class="btn-copy-pitch" data-id="${lead.id}">📋 Copy Cold Email</button>
      </div>
    `;

    card.querySelector(".btn-audit").addEventListener("click", () => openClientAuditReport(lead));
    card.querySelector(".btn-copy-pitch").addEventListener("click", (e) => copyColdEmailForLead(lead, e.target));
    container.appendChild(card);
  });
}

function copyColdEmailForLead(lead, btn) {
  const firstProblem =
    lead.leaks && lead.leaks.includes("NO_WEBSITE")
      ? "didn't have a website linked on your Google Maps profile"
      : lead.leaks && lead.leaks.includes("NO_CHAT_WIDGET")
      ? "doesn't have an instant booking or 24/7 chat capture widget for after-hours visitors"
      : lead.leaks && lead.leaks.includes("NO_FB_PIXEL")
      ? "doesn't have a Meta retargeting pixel installed, so 95% of visitors leave without being retargeted"
      : `currently sits at ${lead.reviews || "under 25"} Google reviews compared to local competitors`;

  const script = `Subject: Quick question about ${lead.name} on Google Maps\n\nHi ${lead.name} team,\n\nI was looking at top ${lead.category} businesses on Google Maps today and noticed ${lead.name} ${firstProblem}.\n\nI put together a 1-page Revenue Leak Audit showing exactly how fixing this can add 15–30 extra booked appointments per month — completely free to review.\n\nCan I send over the 1-page PDF for you to check out?\n\nBest,\n[Your Name]`;

  navigator.clipboard.writeText(script);
  const orig = btn.textContent;
  btn.textContent = "✅ Copied!";
  setTimeout(() => (btn.textContent = orig), 1500);
}

function openClientAuditReport(lead) {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const checkRow = (label, ok, impact) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;">${label}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">
        <span style="padding:3px 8px;border-radius:99px;font-size:12px;font-weight:700;background:${ok ? "#dcfce7" : "#ffe4e6"};color:${ok ? "#166534" : "#9f1239"};">
          ${ok ? "PASSED" : "CRITICAL LEAK"}
        </span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;">${impact}</td>
    </tr>
  `;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Digital Funnel Audit — ${escapeHtml(lead.name)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; background: #f8fafc; color: #0f172a; padding: 32px; }
    .page { max-width: 780px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .top { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 18px; margin-bottom: 24px; }
    .score-box { background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; padding: 12px 18px; border-radius: 10px; text-align: center; }
    .score-box .num { font-size: 28px; font-weight: 900; display: block; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { text-align: left; padding: 10px 12px; background: #f1f5f9; font-size: 12px; text-transform: uppercase; color: #475569; }
    .cta-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 18px; border-radius: 10px; margin-top: 24px; }
    .print-btn { background: #10b981; color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 700; cursor: pointer; margin-bottom: 20px; }
    @media print { .print-btn { display: none; } body { padding: 0; background: #fff; } .page { box-shadow: none; border: none; } }
  </style>
</head>
<body>
  <div style="max-width:780px;margin:0 auto;">
    <button class="print-btn" onclick="window.print()">🖨️ Save / Print as Client PDF</button>
  </div>
  <div class="page">
    <div class="top">
      <div>
        <div style="font-size:12px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:1px;">Executive Local Funnel &amp; Reputation Audit</div>
        <h1 style="margin:6px 0 4px;font-size:24px;">${escapeHtml(lead.name)}</h1>
        <div style="color:#64748b;font-size:13px;">Category: ${escapeHtml(lead.category)} · Date: ${dateStr}</div>
      </div>
      <div class="score-box">
        <span class="num">${lead.leakScore || 75}/99</span>
        <span style="font-size:11px;font-weight:700;">REVENUE LEAK RISK</span>
      </div>
    </div>

    <p style="font-size:14px;line-height:1.6;color:#334155;">
      Our automated diagnostic scanned <strong>${escapeHtml(lead.name)}</strong> across Google Maps and your web presence. Below are the exact conversion bottlenecks currently costing you inbound calls and booked appointments:
    </p>

    <table>
      <thead>
        <tr><th>Diagnostic Check</th><th>Status</th><th>Estimated Business Impact</th></tr>
      </thead>
      <tbody>
        ${checkRow("Active Website Connected", Boolean(lead.website) && !(lead.leaks || []).includes("SITE_UNREACHABLE"), "Customers clicking your Google Maps listing need a working mobile landing page.")}
        ${checkRow("HTTPS / SSL Security", Boolean(lead.hasSSL), "Browsers display 'Not Secure' warnings on non-HTTPS sites, dropping trust by 68%.")}
        ${checkRow("24/7 Instant Booking / AI Chat Widget", Boolean(lead.hasChatOrBooking), "Over 62% of local inquiries happen after 5 PM. Without instant chat/booking, leads call a competitor.")}
        ${checkRow("Meta / Facebook Retargeting Pixel", Boolean(lead.hasFbPixel), "Without a retargeting pixel, 96% of website visitors leave and never return.")}
        ${checkRow("Google Tag & Conversion Tracking", Boolean(lead.hasGoogleTag), "Required to measure which keywords and ads generate actual phone calls.")}
        ${checkRow("Google Maps Review Velocity (25+ Reviews)", (lead.reviews || 0) >= 25 && (lead.rating || 0) >= 4.3, `Currently at ${lead.rating || 0}★ (${lead.reviews || 0} reviews). Top 3 Map Pack winners average 65+ reviews.`)}
      </tbody>
    </table>

    <div class="cta-box">
      <h3 style="margin:0 0 6px;color:#065f46;font-size:16px;">Recommended 48-Hour Remediation Plan</h3>
      <p style="margin:0;color:#047857;font-size:14px;line-height:1.5;">
        <strong>Primary Priority:</strong> ${escapeHtml(lead.recommendedPitch)}<br/>
        Fixing the red items above typically recovers <strong>15 to 35+ missed local customer inquiries per month</strong> within the first 30 days.
      </p>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  chrome.tabs.create({ url });
}

function exportToCsv() {
  if (allLeads.length === 0) return;
  const headers = [
    "Business Name", "Category", "Rating", "Reviews", "Phone", "Primary Email",
    "All Emails", "Website", "Instagram", "Facebook", "LinkedIn",
    "Leak Score", "Funnel Leaks", "Recommended Pitch", "Google Maps URL"
  ];
  const rows = allLeads.map((l) => [
    l.name || "",
    l.category || "",
    l.rating || 0,
    l.reviews || 0,
    l.phone || "",
    (l.emails && l.emails[0]) || "",
    (l.emails || []).join("; "),
    l.website || "",
    (l.socials && l.socials.instagram) || "",
    (l.socials && l.socials.facebook) || "",
    (l.socials && l.socials.linkedin) || "",
    l.leakScore || 0,
    (l.leaks || []).join(" | "),
    l.recommendedPitch || "",
    l.mapsUrl || ""
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leadsniper_pro_leads_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function clearLeads() {
  allLeads = [];
  chrome.storage.local.set({ lsp_leads: [] });
  renderLeads();
}

function loadDemoLeads() {
  allLeads = [
    {
      id: "demo_1",
      name: "Apex Smile Dental Studio",
      category: "Cosmetic Dentist",
      address: "1420 Brickell Ave, Miami, FL",
      rating: 4.1,
      reviews: 14,
      phone: "(305) 555-0192",
      website: "http://apexsmiledental-miami.com",
      emails: ["frontdesk@apexsmiledental-miami.com"],
      socials: { instagram: "https://instagram.com/apexsmilemiami", facebook: "", linkedin: "", tiktok: "" },
      hasSSL: false,
      hasFbPixel: false,
      hasGoogleTag: true,
      hasChatOrBooking: false,
      leaks: ["NO_SSL", "NO_CHAT_WIDGET", "NO_FB_PIXEL", "LOW_REVIEWS"],
      leakScore: 92,
      recommendedPitch: "No 24/7 Booking Widget + Unsecured HTTP site + Only 14 reviews. Pitch $1,500 Funnel & Review Upgrade."
    },
    {
      id: "demo_2",
      name: "Lone Star Premier Roofing",
      category: "Roofing Contractor",
      address: "4810 Cedar Springs Rd, Dallas, TX",
      rating: 4.6,
      reviews: 19,
      phone: "(214) 555-0148",
      website: "",
      emails: ["estimates@lonestarroofingtx.com"],
      socials: { instagram: "", facebook: "https://facebook.com/lonestarroofing", linkedin: "", tiktok: "" },
      hasSSL: false,
      hasFbPixel: false,
      hasGoogleTag: false,
      hasChatOrBooking: false,
      leaks: ["NO_WEBSITE", "LOW_REVIEWS"],
      leakScore: 95,
      recommendedPitch: "No website connected on Google Maps — pitch $997 48-Hour High-Converting Local Landing Page + Storm Lead Capture."
    },
    {
      id: "demo_3",
      name: "Aura Glow MedSpa & Laser",
      category: "Medical Spa",
      address: "8500 Melrose Ave, Los Angeles, CA",
      rating: 4.8,
      reviews: 64,
      phone: "(310) 555-0184",
      website: "https://auraglowmedspa.com",
      emails: ["concierge@auraglowmedspa.com"],
      socials: { instagram: "https://instagram.com/auraglowla", facebook: "", linkedin: "", tiktok: "" },
      hasSSL: true,
      hasFbPixel: false,
      hasGoogleTag: true,
      hasChatOrBooking: false,
      leaks: ["NO_CHAT_WIDGET", "NO_FB_PIXEL"],
      leakScore: 68,
      recommendedPitch: "Leaking Ad & Organic Traffic — Missing both 24/7 AI Consultation Booking widget AND Meta Retargeting Pixel."
    }
  ];
  chrome.storage.local.set({ lsp_leads: allLeads });
  renderLeads();
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
