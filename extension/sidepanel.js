/**
 * LeadSniper Pro — Side Panel Controller (v2.6 Global Teleport Edition)
 * - Starter Tier (Free): Scans only the user's auto-detected local area (up to 15 leads).
 *   Custom Location & Global High-Ticket City Teleport (Miami, Dubai, London, Paris, NYC, Toronto)
 *   are locked behind Pro License.
 * - Pro Tier (Paid / VIP Key): Unlocks Custom Global Location Selector + 1-Click Global City Teleport
 *   + Unlimited Leads + 1-Click Client Audit PDFs.
 */

let allLeads = [];
let isPro = false;
const FREE_LIMIT = 15;

let userGeo = {
  city: "",
  region: "",
  country: "",
  lat: null,
  lon: null,
  detected: false
};

const GLOBAL_CITY_COORDS = {
  "Miami, USA": { lat: 25.7617, lon: -80.1918 },
  "Dubai, UAE": { lat: 25.2048, lon: 55.2708 },
  "London, UK": { lat: 51.5072, lon: -0.1276 },
  "Paris, France": { lat: 48.8566, lon: 2.3522 },
  "New York, USA": { lat: 40.7128, lon: -74.0060 },
  "Toronto, Canada": { lat: 43.6532, lon: -79.3832 }
};

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
  const stored = await chrome.storage.local.get(["lsp_leads", "lsp_license", "lsp_is_pro", "lsp_geo", "lsp_niche"]);

  if (stored.lsp_niche) {
    document.getElementById("nicheInput").value = stored.lsp_niche;
  }

  if (stored.lsp_geo && stored.lsp_geo.city) {
    userGeo = stored.lsp_geo;
  }

  if (stored.lsp_is_pro && stored.lsp_license) {
    isPro = true;
    document.getElementById("licenseInput").value = stored.lsp_license;
    setProUI(true, "Pro Lifetime License + Global Location Active");
  } else {
    isPro = false;
    setProUI(false, "Starter: Local area only (15 leads). Unlock Pro to choose any location worldwide.");
  }

  applyGeoToUI(false);
  detectUserLocation(false);

  if (Array.isArray(stored.lsp_leads) && stored.lsp_leads.length > 0) {
    allLeads = stored.lsp_leads;
    renderLeads();
  }

  document.getElementById("toggleLicenseBtn").addEventListener("click", () => {
    const box = document.getElementById("licenseBox");
    box.style.display = box.style.display === "none" ? "block" : "none";
  });

  document.getElementById("activateBtn").addEventListener("click", handleActivateLicense);
  document.getElementById("switchModeBtn").addEventListener("click", toggleFounderTierPreview);
  document.getElementById("startBtn").addEventListener("click", startScraping);
  document.getElementById("stopBtn").addEventListener("click", stopScraping);
  document.getElementById("filterLeaksOnly").addEventListener("change", renderLeads);
  document.getElementById("exportCsvBtn").addEventListener("click", exportToCsv);
  document.getElementById("clearBtn").addEventListener("click", clearLeads);
  document.getElementById("demoBtn").addEventListener("click", loadDemoLeads);
  document.getElementById("openMapsBtn").addEventListener("click", () => openMapsForTargetLocation(true));
  document.getElementById("refreshGeoBtn").addEventListener("click", () => {
    selectLocalAreaChip();
    detectUserLocation(true);
  });

  // Locked Location Input / Unlock Button clicks
  document.getElementById("locationInput").addEventListener("click", () => {
    if (!isPro) {
      triggerLocationPaywall("Custom Location Search");
    }
  });
  document.getElementById("unlockLocationBtn").addEventListener("click", () => {
    triggerLocationPaywall("Custom Global Location");
  });
  document.getElementById("quickEnterKeyBtn").addEventListener("click", () => {
    const box = document.getElementById("licenseBox");
    box.style.display = "block";
    const input = document.getElementById("licenseInput");
    if (!input.value) input.value = "LSP-VIP-FOUNDER";
    input.focus();
  });

  // Niche quick-chips (Free for everyone, searches in current allowed location)
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const niche = chip.getAttribute("data-niche");
      document.getElementById("nicheInput").value = niche;
      chrome.storage.local.set({ lsp_niche: niche });
      openMapsForTargetLocation(true);
    });
  });

  // City Teleport chips (Local = Free, Global Cities = Paid Pro Feature)
  document.querySelectorAll(".city-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const targetCity = chip.getAttribute("data-city");
      if (targetCity === "__LOCAL__") {
        selectLocalAreaChip();
        openMapsForTargetLocation(true);
        return;
      }
      if (!isPro) {
        triggerLocationPaywall(targetCity);
        return;
      }
      document.querySelectorAll(".city-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      document.getElementById("locationInput").value = targetCity;
      document.getElementById("upsellToast").style.display = "none";
      openMapsForTargetLocation(true);
    });
  });

  // Trigger search on Enter inside niche or location input
  ["nicheInput", "locationInput"].forEach((id) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (id === "locationInput" && !isPro) {
          triggerLocationPaywall("Custom Location");
          return;
        }
        openMapsForTargetLocation(true);
      }
    });
  });
});

function selectLocalAreaChip() {
  document.querySelectorAll(".city-chip").forEach((c) => c.classList.remove("active"));
  const localChip = document.querySelector('.city-chip[data-city="__LOCAL__"]');
  if (localChip) localChip.classList.add("active");
  const label = [userGeo.city, userGeo.country].filter(Boolean).join(", ") || "Near Me";
  const locInput = document.getElementById("locationInput");
  locInput.value = isPro ? label : `📍 ${label} (Local Area Only — Unlock Pro to change)`;
}

function triggerLocationPaywall(requestedMarket) {
  const toast = document.getElementById("upsellToast");
  toast.style.display = "block";
  toast.querySelector(".upsell-title").textContent = `🔒 "${requestedMarket}" Requires LeadSniper Pro`;
  const box = document.getElementById("licenseBox");
  box.style.display = "block";
}

async function toggleFounderTierPreview() {
  if (isPro) {
    await chrome.storage.local.set({ lsp_is_pro: false });
    setProUI(false, "Previewing Free Starter Mode (Location Locked to Local Area)");
  } else {
    const key = document.getElementById("licenseInput").value.trim() || "LSP-VIP-FOUNDER";
    document.getElementById("licenseInput").value = key;
    await chrome.storage.local.set({ lsp_license: key, lsp_is_pro: true });
    setProUI(true, "Pro Lifetime License + Global Location Unlocked!");
  }
}

async function detectUserLocation(forceResetToLocal = false) {
  const pill = document.getElementById("detectedLocationPill");
  pill.textContent = "📍 Detecting your location...";

  const providers = [
    {
      url: "https://ipwho.is/",
      parse: (d) => d && d.success !== false && d.city ? { city: d.city, region: d.region || "", country: d.country || "", lat: d.latitude, lon: d.longitude } : null
    },
    {
      url: "https://ipapi.co/json/",
      parse: (d) => d && d.city ? { city: d.city, region: d.region || "", country: d.country_name || "", lat: d.latitude, lon: d.longitude } : null
    },
    {
      url: "https://freeipapi.com/api/json",
      parse: (d) => d && d.cityName ? { city: d.cityName, region: d.regionName || "", country: d.countryName || "", lat: d.latitude, lon: d.longitude } : null
    }
  ];

  for (const p of providers) {
    try {
      const res = await fetch(p.url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const parsed = p.parse(data);
        if (parsed && parsed.city) {
          userGeo = { ...parsed, detected: true };
          await chrome.storage.local.set({ lsp_geo: userGeo });
          applyGeoToUI(forceResetToLocal);
          return;
        }
      }
    } catch (_) {}
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userGeo.lat = pos.coords.latitude;
        userGeo.lon = pos.coords.longitude;
        userGeo.detected = true;
        applyGeoToUI(forceResetToLocal);
      },
      () => {
        pill.textContent = "📍 Location: Near Me (Auto)";
      },
      { timeout: 5000 }
    );
  } else {
    pill.textContent = "📍 Location: Near Me (Auto)";
  }
}

function applyGeoToUI(forceResetToLocal = false) {
  const pill = document.getElementById("detectedLocationPill");
  const locInput = document.getElementById("locationInput");
  const emptyTitle = document.getElementById("emptyTitle");
  const label = [userGeo.city, userGeo.country].filter(Boolean).join(", ");

  if (label) {
    pill.textContent = `📍 Your Area: ${label}`;
    if (!isPro) {
      locInput.value = `📍 ${label} (Local Only — Pro Unlocks Worldwide)`;
    } else if (forceResetToLocal || !locInput.value.trim() || locInput.value.includes("Local Only")) {
      locInput.value = label;
    }
    if (emptyTitle) {
      emptyTitle.textContent = `Ready to Scan ${isPro ? (locInput.value || label) : label}`;
    }
  } else {
    pill.textContent = "📍 Your Area: Local GPS";
    if (!isPro) {
      locInput.value = "📍 Near Me (Local Only — Pro Unlocks Worldwide)";
    } else if (forceResetToLocal || !locInput.value.trim()) {
      locInput.value = "Near Me";
    }
  }
}

function setProUI(active, msg) {
  isPro = active;
  const badge = document.getElementById("planBadge");
  const status = document.getElementById("licenseStatus");
  const locInput = document.getElementById("locationInput");
  const lockBadge = document.getElementById("locationLockBadge");
  const unlockBtn = document.getElementById("unlockLocationBtn");
  const upsellToast = document.getElementById("upsellToast");
  const localLabel = [userGeo.city, userGeo.country].filter(Boolean).join(", ") || "Near Me";

  if (active) {
    badge.textContent = "PRO UNLIMITED";
    badge.classList.add("active");
    status.textContent = "✅ " + msg;
    status.style.color = "#34d399";

    // Unlock Custom Global Location Input
    locInput.removeAttribute("readonly");
    locInput.placeholder = "🌍 Enter ANY city, state, or country worldwide...";
    if (!locInput.value || locInput.value.includes("Local Only")) {
      locInput.value = localLabel;
    }
    lockBadge.textContent = "🌍 GLOBAL TELEPORT UNLOCKED";
    lockBadge.classList.add("unlocked");
    unlockBtn.style.display = "none";
    upsellToast.style.display = "none";

    // Remove lock icons on global city presets
    document.querySelectorAll(".city-chip.pro-chip").forEach((chip) => {
      chip.classList.remove("locked-chip");
      chip.textContent = chip.textContent.replace("🔒 ", "");
    });
  } else {
    badge.textContent = "STARTER";
    badge.classList.remove("active");
    status.textContent = msg;
    status.style.color = "#fb7185";

    // Lock Location Input to User's Physical Area Only
    locInput.setAttribute("readonly", "readonly");
    locInput.value = `📍 ${localLabel} (Local Only — Pro Unlocks Worldwide)`;
    lockBadge.textContent = "🔒 PRO FEATURE";
    lockBadge.classList.remove("unlocked");
    unlockBtn.style.display = "block";
    selectLocalAreaChip();

    // Show lock icons on global city presets
    document.querySelectorAll(".city-chip.pro-chip").forEach((chip) => {
      chip.classList.add("locked-chip");
      if (!chip.textContent.startsWith("🔒")) {
        chip.textContent = "🔒 " + chip.textContent;
      }
    });
  }
}

function buildLocalizedMapsUrl() {
  const niche = (document.getElementById("nicheInput").value || "Dentists").trim();
  chrome.storage.local.set({ lsp_niche: niche });

  const localLabel = [userGeo.city, userGeo.country].filter(Boolean).join(", ");

  // Starter users are strictly locked to their own detected physical location
  if (!isPro) {
    if (localLabel) {
      const query = encodeURIComponent(`${niche} in ${localLabel}`);
      if (userGeo.lat && userGeo.lon) {
        return `https://www.google.com/maps/search/${query}/@${userGeo.lat},${userGeo.lon},13z`;
      }
      return `https://www.google.com/maps/search/${query}`;
    }
    const query = encodeURIComponent(`${niche} near me`);
    return `https://www.google.com/maps/search/${query}`;
  }

  // Pro users can teleport to ANY custom city/country worldwide!
  const customLoc = (document.getElementById("locationInput").value || "").trim();
  const targetLoc = customLoc && !customLoc.includes("Local Only") ? customLoc : localLabel;

  if (targetLoc && targetLoc.toLowerCase() !== "near me") {
    const query = encodeURIComponent(`${niche} in ${targetLoc}`);
    const presetCoords = GLOBAL_CITY_COORDS[targetLoc];
    if (presetCoords) {
      return `https://www.google.com/maps/search/${query}/@${presetCoords.lat},${presetCoords.lon},12z`;
    }
    if (userGeo.lat && userGeo.lon && targetLoc === localLabel) {
      return `https://www.google.com/maps/search/${query}/@${userGeo.lat},${userGeo.lon},13z`;
    }
    return `https://www.google.com/maps/search/${query}`;
  }

  const query = encodeURIComponent(`${niche} near me`);
  if (userGeo.lat && userGeo.lon) {
    return `https://www.google.com/maps/search/${query}/@${userGeo.lat},${userGeo.lon},13z`;
  }
  return `https://www.google.com/maps/search/${query}`;
}

async function openMapsForTargetLocation(autoStartAfterLoad = true) {
  const url = buildLocalizedMapsUrl();
  const tab = await getActiveMapsTab();

  let targetTabId = null;
  if (tab && tab.url && tab.url.includes("google.com/maps")) {
    await chrome.tabs.update(tab.id, { url });
    targetTabId = tab.id;
  } else {
    const created = await chrome.tabs.create({ url });
    targetTabId = created.id;
  }

  if (autoStartAfterLoad && targetTabId) {
    document.getElementById("startBtn").disabled = true;
    document.getElementById("stopBtn").disabled = false;
    setTimeout(async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: targetTabId },
          files: ["content.js"]
        });
      } catch (_) {}
      chrome.tabs.sendMessage(targetTabId, { type: "START_SCRAPE" }).catch(() => {});
    }, 3800);
  }
}

async function handleActivateLicense() {
  const key = document.getElementById("licenseInput").value.trim();
  const status = document.getElementById("licenseStatus");
  status.textContent = "Verifying license...";
  chrome.runtime.sendMessage({ type: "VERIFY_LICENSE", licenseKey: key }, async (res) => {
    if (res && res.valid) {
      await chrome.storage.local.set({ lsp_license: key, lsp_is_pro: true });
      setProUI(true, res.message || "Pro License & Global Location Unlocked!");
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
  await openMapsForTargetLocation(true);
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
        setProUI(false, `Starter limit (${FREE_LIMIT} leads) reached. Unlock Pro for unlimited leads & Global Locations!`);
        triggerLocationPaywall("Unlimited Leads & Global Locations");
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

  const script = `Subject: Quick question about ${lead.name} on Google Maps\n\nHi ${lead.name} team,\n\nI was looking at top ${lead.category} businesses in your area on Google Maps today and noticed ${lead.name} ${firstProblem}.\n\nI put together a 1-page Revenue Leak Audit showing exactly how fixing this can add 15–30 extra booked appointments per month — completely free to review.\n\nCan I send over the 1-page PDF for you to check out?\n\nBest,\n[Your Name]`;

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
  const rawInput = document.getElementById("locationInput").value.trim();
  const locCity = (isPro && rawInput && !rawInput.includes("Local Only"))
    ? rawInput
    : (userGeo.city || "Local Area");

  allLeads = [
    {
      id: "demo_1",
      name: `Clinique Dentaire Prestige (${locCity})`,
      category: "Dental Clinic",
      address: `Centre Ville, ${locCity}`,
      rating: 4.1,
      reviews: 14,
      phone: "+212 522-481920",
      website: "http://cliniquedentaire-prestige.com",
      emails: ["contact@cliniquedentaire-prestige.com"],
      socials: { instagram: "https://instagram.com/clinique_prestige", facebook: "", linkedin: "", tiktok: "" },
      hasSSL: false,
      hasFbPixel: false,
      hasGoogleTag: true,
      hasChatOrBooking: false,
      leaks: ["NO_SSL", "NO_CHAT_WIDGET", "NO_FB_PIXEL", "LOW_REVIEWS"],
      leakScore: 92,
      recommendedPitch: "No 24/7 WhatsApp/AI Booking Widget + Unsecured HTTP site + Only 14 reviews. Pitch Funnel & Review Upgrade."
    },
    {
      id: "demo_2",
      name: `Atlas Luxury Real Estate (${locCity})`,
      category: "Real Estate Agency",
      address: `Boulevard Principal, ${locCity}`,
      rating: 4.5,
      reviews: 19,
      phone: "+212 661-394012",
      website: "",
      emails: ["info@atlasluxuryimmo.ma"],
      socials: { instagram: "", facebook: "https://facebook.com/atlasluxuryimmo", linkedin: "", tiktok: "" },
      hasSSL: false,
      hasFbPixel: false,
      hasGoogleTag: false,
      hasChatOrBooking: false,
      leaks: ["NO_WEBSITE", "LOW_REVIEWS"],
      leakScore: 95,
      recommendedPitch: "No website connected on Google Maps — pitch 48-Hour High-Converting Local Landing Page + WhatsApp Lead Capture."
    },
    {
      id: "demo_3",
      name: `Royal Aesthetics & Laser Spa (${locCity})`,
      category: "Medical Spa & Clinic",
      address: `Quartier Racine, ${locCity}`,
      rating: 4.7,
      reviews: 52,
      phone: "+212 522-910455",
      website: "https://royalaesthetics-spa.com",
      emails: ["booking@royalaesthetics-spa.com"],
      socials: { instagram: "https://instagram.com/royalaestheticsspa", facebook: "", linkedin: "", tiktok: "" },
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
