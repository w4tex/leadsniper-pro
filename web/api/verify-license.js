/**
 * Vercel Serverless Function: /api/verify-license
 * Verifies a customer's Whop License Key (membership ID / pass / VIP code)
 * against the live Whop v2 API (biz_mOkULC018JdXuA) and returns entitlement status.
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ valid: false, message: "Method not allowed" });
  }

  const { licenseKey } = req.body || {};
  if (!licenseKey || typeof licenseKey !== "string") {
    return res.status(400).json({ valid: false, message: "Missing licenseKey" });
  }

  const key = licenseKey.trim();

  // 1. Check Creator VIP / Founder Master Keys
  if (key.startsWith("LSP-VIP-") || key.startsWith("LSP-PRO-2026")) {
    return res.status(200).json({
      valid: true,
      tier: "PRO_LIFETIME_VIP",
      message: "VIP Pro Unlimited License Active",
      ebooks: [
        "/downloads/Playbook_1_Local_Client_Acquisition_Outreach_Vault.pdf",
        "/downloads/Playbook_2_48_Hour_Zero_Code_Fulfillment_Blueprint.pdf"
      ]
    });
  }

  // 2. Verify live against Whop API
  const whopApiKey = process.env.WHOP_API_KEY || "apik_Nmrm1ZtgdHaZU_C8124144_C_a92dac7f3781f90cf920d29a03bebb9ebeae2e761b45eb0bbbe672e42063f6";
  try {
    const url = key.startsWith("mem_")
      ? `https://api.whop.com/api/v2/memberships/${encodeURIComponent(key)}`
      : `https://api.whop.com/api/v2/memberships?license_key=${encodeURIComponent(key)}`;

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${whopApiKey}`,
        Accept: "application/json"
      }
    });

    if (resp.ok) {
      const data = await resp.json();
      const membership = data.id ? data : (data.data && data.data[0]);
      if (membership && (membership.valid || membership.status === "active" || membership.status === "completed")) {
        return res.status(200).json({
          valid: true,
          tier: "WHOP_PRO_VERIFIED",
          message: "Whop Pro License Verified!",
          ebooks: [
            "/downloads/Playbook_1_Local_Client_Acquisition_Outreach_Vault.pdf",
            "/downloads/Playbook_2_48_Hour_Zero_Code_Fulfillment_Blueprint.pdf"
          ]
        });
      }
    }
  } catch (_) {}

  return res.status(200).json({
    valid: false,
    message: "License key not found or inactive. Please check your Whop receipt."
  });
}
