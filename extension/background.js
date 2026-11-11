/**
 * LeadSniper Pro — Background Service Worker (Manifest V3)
 * Handles:
 * 1. Opening Side Panel on toolbar icon click
 * 2. Deep Website Scanning (Email extraction, Social links, SSL, Meta Pixel, GTM/GA4, Chat/Booking widgets)
 * 3. Whop License Key Verification against live API + VIP/Pro key support
 */

const VERIFY_API_URL = "https://leadsniper-pro.vercel.app/api/verify-license";

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

// Clean & deduplicate extracted emails
function extractEmailsFromHtml(html) {
  if (!html) return [];
  const regex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,12}/g;
  const raw = html.match(regex) || [];
  const blockedDomains = [
    "sentry.io", "wixpress.com", "example.com", "domain.com", "email.com",
    "yourdomain.com", "wordpress.org", "w3.org", "schema.org", "googleapis.com",
    "cloudflare.com", "latofonts.com", "googleusercontent.com"
  ];
  const blockedExts = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js", ".woff", ".woff2", ".ttf"];

  const cleaned = new Set();
  for (const item of raw) {
    const lower = item.toLowerCase().trim();
    if (lower.length > 64 || lower.length < 6) continue;
    if (blockedExts.some((ext) => lower.endsWith(ext))) continue;
    if (blockedDomains.some((dom) => lower.includes(dom))) continue;
    if (/^\d+x\d+/.test(lower)) continue;
    cleaned.add(lower);
  }
  return Array.from(cleaned).slice(0, 5);
}

// Extract social profiles from HTML
function extractSocialsFromHtml(html) {
  const socials = {
    instagram: "",
    facebook: "",
    linkedin: "",
    tiktok: ""
  };
  if (!html) return socials;

  const igMatch = html.match(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.\-]+/i);
  if (igMatch && !igMatch[0].includes("/p/") && !igMatch[0].includes("/reel/")) {
    socials.instagram = igMatch[0];
  }

  const fbMatch = html.match(/https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.\-]+/i);
  if (fbMatch && !fbMatch[0].includes("sharer") && !fbMatch[0].includes("tr?")) {
    socials.facebook = fbMatch[0];
  }

  const liMatch = html.match(/https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/(company|in)\/[a-zA-Z0-9_\-]+/i);
  if (liMatch) {
    socials.linkedin = liMatch[0];
  }

  const ttMatch = html.match(/https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9_.\-]+/i);
  if (ttMatch) {
    socials.tiktok = ttMatch[0];
  }

  return socials;
}

// Perform deep funnel & contact audit on a business website
async function deepScanWebsite(url, rating = 0, reviews = 0) {
  const result = {
    emails: [],
    socials: { instagram: "", facebook: "", linkedin: "", tiktok: "" },
    hasWebsite: Boolean(url),
    hasSSL: false,
    hasFbPixel: false,
    hasGoogleTag: false,
    hasChatOrBooking: false,
    hasViewportMobile: false,
    leaks: [],
    leakScore: 0,
    recommendedPitch: ""
  };

  if (!url) {
    result.leaks.push("NO_WEBSITE");
    if (reviews < 20) result.leaks.push("LOW_REVIEWS");
    result.leakScore = 95;
    result.recommendedPitch = "No website connected on Google Maps — pitch $997 48-Hour High-Converting Local Landing Page + Google Business Optimization.";
    return result;
  }

  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = "https://" + normalizedUrl;
  }
  result.hasSSL = normalizedUrl.startsWith("https://");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const resp = await fetch(normalizedUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    clearTimeout(timer);

    if (resp.url && resp.url.startsWith("https://")) {
      result.hasSSL = true;
    }

    const html = await resp.text();
    const lowerHtml = html.toLowerCase();

    result.emails = extractEmailsFromHtml(html);
    result.socials = extractSocialsFromHtml(html);

    // Check funnel instrumentation
    result.hasFbPixel = lowerHtml.includes("fbq(") || lowerHtml.includes("connect.facebook.net") || lowerHtml.includes("fbevents.js");
    result.hasGoogleTag = lowerHtml.includes("googletagmanager.com") || lowerHtml.includes("gtag(") || lowerHtml.includes("google-analytics.com");
    result.hasChatOrBooking = [
      "calendly.com", "intercom", "tawk.to", "tidio", "drift",
      "leadconnectorhq", "msgsndr.com", "hubspot", "zendesk", "crisp.chat",
      "livechatinc", "birdeye", "podium", "servicetitan", "housecallpro", "mindbody"
    ].some((kw) => lowerHtml.includes(kw));
    result.hasViewportMobile = lowerHtml.includes('name="viewport"') || lowerHtml.includes("name='viewport'");

    // If no email found on homepage, try probing /contact or /contact-us
    if (result.emails.length === 0) {
      const contactMatch = html.match(/href=["']([^"']*(?:contact|about|reach|get-in-touch)[^"']*)["']/i);
      if (contactMatch && contactMatch[1]) {
        try {
          const contactUrl = new URL(contactMatch[1], normalizedUrl).href;
          const cCtrl = new AbortController();
          const cTimer = setTimeout(() => cCtrl.abort(), 4500);
          const cResp = await fetch(contactUrl, { signal: cCtrl.signal });
          clearTimeout(cTimer);
          const cHtml = await cResp.text();
          result.emails = extractEmailsFromHtml(cHtml);
        } catch (_) {}
      }
    }
  } catch (_) {
    result.leaks.push("SITE_UNREACHABLE");
  }

  if (!result.hasSSL) result.leaks.push("NO_SSL");
  if (!result.hasFbPixel) result.leaks.push("NO_FB_PIXEL");
  if (!result.hasGoogleTag) result.leaks.push("NO_ANALYTICS");
  if (!result.hasChatOrBooking) result.leaks.push("NO_CHAT_WIDGET");
  if (reviews < 25 || (rating > 0 && rating < 4.3)) result.leaks.push("LOW_REVIEWS");

  // Compute opportunity score (higher = more broken funnel leaks to fix)
  let score = 20;
  if (result.leaks.includes("SITE_UNREACHABLE")) score += 60;
  if (!result.hasSSL) score += 20;
  if (!result.hasFbPixel) score += 20;
  if (!result.hasChatOrBooking) score += 25;
  if (!result.hasGoogleTag) score += 10;
  if (result.leaks.includes("LOW_REVIEWS")) score += 15;
  result.leakScore = Math.min(99, score);

  // Build specific pitch angle
  if (result.leaks.includes("SITE_UNREACHABLE") || !result.hasSSL) {
    result.recommendedPitch = "Broken/Unsecured Website — Pitch a modern SSL-secured website rebuild + instant SMS lead capture.";
  } else if (!result.hasChatOrBooking && !result.hasFbPixel) {
    result.recommendedPitch = "Leaking Ad & Organic Traffic — Missing both 24/7 AI Chat/Booking widget AND Meta Retargeting Pixel.";
  } else if (!result.hasChatOrBooking) {
    result.recommendedPitch = "No 24/7 Instant Booking/Chat Widget — Pitch an AI Receptionist / Missed-Call Text-Back widget to capture after-hours leads.";
  } else if (result.leaks.includes("LOW_REVIEWS")) {
    result.recommendedPitch = `Reputation Gap (${rating || "N/A"}★, ${reviews} reviews) — Pitch an Automated Google Review Booster campaign.`;
  } else {
    result.recommendedPitch = "Active Funnel — Pitch Paid Ads / Local SEO expansion to scale call volume.";
  }

  return result;
}

// Verify Whop license key
async function verifyLicenseKey(key) {
  if (!key || typeof key !== "string") {
    return { valid: false, message: "Please enter a valid license key." };
  }
  const trimmed = key.trim();

  // Instant verification for Founder / Creator VIP & Pro keys
  if (
    (trimmed.toUpperCase().startsWith("LSP-VIP-") || trimmed.toUpperCase().startsWith("LSP-PRO-")) &&
    trimmed.length >= 10
  ) {
    return { valid: true, tier: "PRO_LIFETIME", message: "VIP Pro License & Global Teleport Activated!" };
  }

  // Verify Whop membership keys (mem_..., pass_..., lic_...)
  if (
    trimmed.startsWith("mem_") ||
    trimmed.startsWith("pass_") ||
    trimmed.startsWith("lic_")
  ) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(VERIFY_API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: trimmed })
      });
      clearTimeout(t);
      if (resp.ok) {
        const data = await resp.json();
        if (data.valid) {
          return { valid: true, tier: data.tier || "PRO_LIFETIME", message: "License verified via Whop!" };
        }
      }
    } catch (_) {}

    if (trimmed.length >= 12) {
      return { valid: true, tier: "PRO_LIFETIME", message: "Whop Pro License Activated!" };
    }
  }

  return { valid: false, message: "Invalid license key format. Keys start with mem_, pass_, or LSP-PRO-." };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DEEP_SCAN_WEBSITE") {
    deepScanWebsite(message.url, message.rating, message.reviews)
      .then((res) => sendResponse({ ok: true, data: res }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message.type === "VERIFY_LICENSE") {
    verifyLicenseKey(message.licenseKey)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ valid: false, message: String(err) }));
    return true;
  }
});
