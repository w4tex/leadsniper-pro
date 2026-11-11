/**
 * LeadSniper Pro — Side Panel Controller (v3.0 Precision Edition)
 * Designed with deep modules (Ousterhout), Graphite telemetry craft (Unslop / Impeccable),
 * and value-first upgrade mechanics (Paywalls).
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
  NO_WEBSITE: { text: "No website", cls: "critical" },
  SITE_UNREACHABLE: { text: "Site unreachable", cls: "critical" },
  NO_SSL: { text: "No SSL (HTTP)", cls: "critical" },
  NO_FB_PIXEL: { text: "No Meta Pixel", cls: "warn" },
  NO_CHAT_WIDGET: { text: "No 24/7 booking", cls: "warn" },
  NO_ANALYTICS: { text: "No Google Tag", cls: "normal" },
  LOW_REVIEWS: { text: "Under 25 reviews", cls: "warn" }
};

function setLocationPillText(text) {
  const textSpan = document.getElementById("detectedLocationText");
  const pill = document.getElementById("detectedLocationPill");
  if (textSpan && textSpan.tagName) {
    textSpan.textContent = text;
  }
  if (pill && (!textSpan || !pill.children || pill.children.length === 0)) {
    pill.textContent = text;
  }
}

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
    setProUI(true, "Pro license active · Global markets enabled");
  } else {
    isPro = false;
    setProUI(false, "Starter tier · Local area only (15 leads per session)");
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

  const dismissBtn = document.getElementById("dismissUpsellBtn");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      document.getElementById("upsellToast").style.display = "none";
    });
  }

  document.getElementById("locationInput").addEventListener("click", () => {
    if (!isPro) {
      triggerLocationPaywall("Custom market selection");
    }
  });
  document.getElementById("unlockLocationBtn").addEventListener("click", () => {
    triggerLocationPaywall("Global market selection");
  });
  document.getElementById("quickEnterKeyBtn").addEventListener("click", () => {
    const box = document.getElementById("licenseBox");
    box.style.display = "block";
    const input = document.getElementById("licenseInput");
    if (!input.value) input.value = "LSP-VIP-FOUNDER";
    input.focus();
  });

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

  ["nicheInput", "locationInput"].forEach((id) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (id === "locationInput" && !isPro) {
          triggerLocationPaywall("Custom market selection");
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
  const label = [userGeo.city, userGeo.country].filter(Boolean).join(", ") || "Local area";
  const locInput = document.getElementById("locationInput");
  locInput.value = isPro ? label : `${label} (Local area only)`;
}

function triggerLocationPaywall(requestedMarket) {
  const toast = document.getElementById("upsellToast");
  toast.style.display = "block";
  const titleEl = toast.querySelector(".upsell-title");
  if (titleEl) {
    titleEl.textContent = `${requestedMarket} requires LeadSniper Pro`;
  }
  const box = document.getElementById("licenseBox");
  box.style.display = "block";
}

async function toggleFounderTierPreview() {
  if (isPro) {
    await chrome.storage.local.set({ lsp_is_pro: false });
    setProUI(false, "Previewing Starter tier (Locked to local area)");
  } else {
    const key = document.getElementById("licenseInput").value.trim() || "LSP-VIP-FOUNDER";
    document.getElementById("licenseInput").value = key;
    await chrome.storage.local.set({ lsp_license: key, lsp_is_pro: true });
    setProUI(true, "Pro license active · Global markets enabled");
  }
}

async function detectUserLocation(forceResetToLocal = false) {
  setLocationPillText("Detecting location");

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
        setLocationPillText("Local area (GPS)");
      },
      { timeout: 5000 }
    );
  } else {
    setLocationPillText("Local area (GPS)");
  }
}

function applyGeoToUI(forceResetToLocal = false) {
  const locInput = document.getElementById("locationInput");
  const emptyTitle = document.getElementById("emptyTitle");
  const label = [userGeo.city, userGeo.country].filter(Boolean).join(", ");

  if (label) {
    setLocationPillText(label);
    if (!isPro) {
      locInput.value = `${label} (Local area only)`;
    } else if (forceResetToLocal || !locInput.value.trim() || locInput.value.includes("Local area only")) {
      locInput.value = label;
    }
    if (emptyTitle) {
      emptyTitle.textContent = `Ready to scan ${isPro ? (locInput.value || label) : label}`;
    }
  } else {
    setLocationPillText("Local area");
    if (!isPro) {
      locInput.value = "Local area only — Pro unlocks global cities";
    } else if (forceResetToLocal || !locInput.value.trim()) {
      locInput.value = "Near me";
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
  const localLabel = [userGeo.city, userGeo.country].filter(Boolean).join(", ") || "Local area";

  if (active) {
    badge.textContent = "Pro";
    badge.classList.add("active");
    status.textContent = msg;
    status.style.color = "#4cc38a";

    locInput.removeAttribute("readonly");
    locInput.placeholder = "Enter any city, region, or country";
    if (!locInput.value || locInput.value.includes("Local area only")) {
      locInput.value = localLabel;
    }
    lockBadge.textContent = "Global markets active";
    lockBadge.classList.add("unlocked");
    unlockBtn.style.display = "none";
    upsellToast.style.display = "none";

    document.querySelectorAll(".city-chip.pro-chip").forEach((chip) => {
      chip.classList.remove("locked-chip");
    });
  } else {
    badge.textContent = "Starter";
    badge.classList.remove("active");
    status.textContent = msg;
    status.style.color = "#a1a1a6";

    locInput.setAttribute("readonly", "readonly");
    locInput.value = `${localLabel} (Local area only)`;
    lockBadge.textContent = "Pro feature";
    lockBadge.classList.remove("unlocked");
    unlockBtn.style.display = "block";
    selectLocalAreaChip();

    document.querySelectorAll(".city-chip.pro-chip").forEach((chip) => {
      chip.classList.add("locked-chip");
    });
  }
}

function buildLocalizedMapsUrl() {
  const niche = (document.getElementById("nicheInput").value || "Dentists").trim();
  chrome.storage.local.set({ lsp_niche: niche });

  const localLabel = [userGeo.city, userGeo.country].filter(Boolean).join(", ");

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

  const customLoc = (document.getElementById("locationInput").value || "").trim();
  const targetLoc = customLoc && !customLoc.includes("Local area only") ? customLoc : localLabel;

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
      setProUI(true, res.message || "Pro license active · Global markets enabled");
      renderLeads();
    } else {
      setProUI(false, (res && res.message) || "Invalid license key");
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
        setProUI(false, `Starter limit (${FREE_LIMIT} leads) reached · Upgrade to Pro for unlimited extraction`);
        triggerLocationPaywall("Unlimited extraction & global markets");
        break;
      }
      if (allLeads.some((l) => l.name === raw.name && l.phone === raw.phone)) continue;

      const lead = {
        ...raw,
        emails: [],
        socials: { instagram: "", facebook: "", linkedin: "", tiktok: "" },
        leaks: raw.website ? [] : ["NO_WEBSITE"],
        leakScore: raw.website ? 40 : 95,
        recommendedPitch: "Auditing website funnel...",
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
        return `<span class="leak-tag ${meta.cls}"><span class="dot"></span>${meta.text}</span>`;
      })
      .join("");

    const emailText = lead.emails && lead.emails.length > 0 ? lead.emails[0] : "No email on site";
    const phoneText = lead.phone ? lead.phone : "No phone listed";
    const ratingText = lead.rating ? `${lead.rating.toFixed(1)} (${lead.reviews} reviews)` : "No reviews";
    const scoreVal = lead.leakScore || 50;
    const scoreCls = scoreVal >= 70 ? "score-pill high-leak" : "score-pill";

    card.innerHTML = `
      <div class="lead-top">
        <div>
          <div class="lead-title">${escapeHtml(lead.name)}</div>
          <div class="lead-meta">${escapeHtml(lead.category)} · ${ratingText}</div>
        </div>
        <span class="${scoreCls}">Leak ${scoreVal}/99</span>
      </div>
      <div class="leak-badges">${badgesHtml || '<span class="leak-tag healthy"><span class="dot"></span>Healthy funnel</span>'}</div>
      <div class="contact-row">
        <span>${escapeHtml(phoneText)}</span>
        <span>${escapeHtml(emailText)}</span>
      </div>
      <div class="pitch-box">${escapeHtml(lead.recommendedPitch || "")}</div>
      <div class="card-actions">
        <button class="btn-audit" data-id="${lead.id}">Client audit PDF</button>
        <button class="btn-copy-pitch" data-id="${lead.id}">Copy outreach email</button>
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
      ? "does not have a website linked on Google Maps"
      : lead.leaks && lead.leaks.includes("NO_CHAT_WIDGET")
      ? "does not have an after-hours booking or instant chat capture widget"
      : lead.leaks && lead.leaks.includes("NO_FB_PIXEL")
      ? "is missing a Meta retargeting pixel, meaning 95% of visitors leave without retargeting"
      : `currently sits at ${lead.reviews || "under 25"} Google reviews compared to local top-3 competitors`;

  const script = `Subject: Quick question about ${lead.name} on Google Maps\n\nHi ${lead.name} team,\n\nI was reviewing ${lead.category} businesses in your area on Google Maps today and noticed ${lead.name} ${firstProblem}.\n\nI prepared a 1-page Funnel & Reputation Audit showing how fixing this typically recovers 15 to 30 missed customer inquiries per month.\n\nMind if I send the 1-page PDF over for you to review?\n\nBest,\n[Your Name]`;

  navigator.clipboard.writeText(script);
  const orig = btn.textContent;
  btn.textContent = "Copied";
  setTimeout(() => (btn.textContent = orig), 1500);
}

function openClientAuditReport(lead) {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const checkRow = (label, ok, impact) => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:500;color:#171717;">${label}</td>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;">
        <span style="display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:4px;background:${ok ? "#f0fdf4" : "#fef2f2"};color:${ok ? "#16a34a" : "#dc2626"};border:1px solid ${ok ? "#bbf7d0" : "#fecaca"};">
          ${ok ? "Passed" : "Critical leak"}
        </span>
      </td>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#525252;font-size:13px;">${impact}</td>
    </tr>
  `;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Funnel Diagnostic — ${escapeHtml(lead.name)}</title>
  <style>
    body { font-family: "Geist", "Inter", -apple-system, sans-serif; background: #fafafa; color: #171717; padding: 32px; line-height: 1.5; }
    .page { max-width: 780px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 36px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 24px; }
    .score-box { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 12px 16px; border-radius: 8px; text-align: right; font-variant-numeric: tabular-nums; }
    .score-box .num { font-family: monospace; font-size: 28px; font-weight: 500; line-height: 1; display: block; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { text-align: left; padding: 10px 12px; background: #f4f4f5; font-size: 12px; font-weight: 500; color: #525252; border-bottom: 1px solid #e5e7eb; }
    .cta-box { background: #f4f4f5; border: 1px solid #e5e7eb; padding: 16px 20px; border-radius: 8px; margin-top: 24px; }
    .print-btn { background: #171717; color: #ffffff; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 500; font-size: 13px; cursor: pointer; margin-bottom: 16px; }
    @media print { .print-btn { display: none; } body { padding: 0; background: #fff; } .page { box-shadow: none; border: none; } }
  </style>
</head>
<body>
  <div style="max-width:780px;margin:0 auto;">
    <button class="print-btn" onclick="window.print()">Save as client PDF</button>
  </div>
  <div class="page">
    <div class="top">
      <div>
        <div style="font-size:12px;color:#737373;margin-bottom:4px;">Executive Local Funnel &amp; Reputation Audit · ${dateStr}</div>
        <h1 style="margin:0 0 4px;font-size:24px;font-weight:500;">${escapeHtml(lead.name)}</h1>
        <div style="color:#525252;font-size:13px;">Category: ${escapeHtml(lead.category)}</div>
      </div>
      <div class="score-box">
        <span class="num">${lead.leakScore || 75}/99</span>
        <span style="font-size:11px;">Leak index</span>
      </div>
    </div>

    <p style="font-size:14px;color:#525252;">
      Diagnostic scan of <strong>${escapeHtml(lead.name)}</strong> across Google Maps and connected web properties. The table below isolates conversion bottlenecks currently reducing inbound calls and booked appointments.
    </p>

    <table>
      <thead>
        <tr><th>Diagnostic check</th><th>Status</th><th>Business impact</th></tr>
      </thead>
      <tbody>
        ${checkRow("Active website linked", Boolean(lead.website) && !(lead.leaks || []).includes("SITE_UNREACHABLE"), "Prospective customers clicking Google Maps require an active mobile landing page.")}
        ${checkRow("HTTPS / SSL encryption", Boolean(lead.hasSSL), "Unencrypted HTTP pages trigger browser security warnings and reduce visitor trust.")}
        ${checkRow("24/7 instant booking or chat capture", Boolean(lead.hasChatOrBooking), "Over 60% of local inquiries occur outside business hours; uncaptured visitors call competitors.")}
        ${checkRow("Meta retargeting pixel", Boolean(lead.hasFbPixel), "Without retargeting, 96% of website visitors leave without converting on their first visit.")}
        ${checkRow("Google Tag conversion tracking", Boolean(lead.hasGoogleTag), "Required to attribute inbound calls and form submissions to search traffic.")}
        ${checkRow("Google Maps review velocity (25+ reviews)", (lead.reviews || 0) >= 25 && (lead.rating || 0) >= 4.3, `Currently at ${lead.rating || 0} stars (${lead.reviews || 0} reviews). Local top-3 listings average 65+ reviews.`)}
      </tbody>
    </table>

    <div class="cta-box">
      <h3 style="margin:0 0 6px;color:#171717;font-size:14px;font-weight:500;">48-hour remediation roadmap</h3>
      <p style="margin:0;color:#525252;font-size:13px;">
        <strong>Recommended action:</strong> ${escapeHtml(lead.recommendedPitch)}
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
  const locCity = (isPro && rawInput && !rawInput.includes("Local area only"))
    ? rawInput
    : (userGeo.city || "Casablanca");

  allLeads = [
    {
      id: "demo_1",
      name: `Clinique Dentaire Prestige (${locCity})`,
      category: "Dental clinic",
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
      recommendedPitch: "Missing 24/7 booking capture, unencrypted HTTP site, and 14 reviews — pitch 48-hour funnel & review upgrade."
    },
    {
      id: "demo_2",
      name: `Atlas Luxury Real Estate (${locCity})`,
      category: "Real estate agency",
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
      recommendedPitch: "No website linked on Google Maps — pitch 48-hour landing page + instant WhatsApp lead capture."
    },
    {
      id: "demo_3",
      name: `Royal Aesthetics & Laser (${locCity})`,
      category: "Medical spa",
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
      recommendedPitch: "Missing both 24/7 consultation booking widget and Meta retargeting pixel."
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
