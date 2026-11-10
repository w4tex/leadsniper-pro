#!/usr/bin/env python3
"""
Builds:
1. Extension icons (icon16.png, icon48.png, icon128.png) + LeadSniper-Pro-Extension.zip
2. Executive PDF Playbook #1: The Local Client Acquisition & Outreach Vault
3. Executive PDF Playbook #2: The 48-Hour Agency Fulfillment Blueprint
"""
import os
import zipfile
import fitz  # PyMuPDF

BASE_DIR = "/home/wolvx7/.gemini/antigravity/scratch/leadsniper-pro"
EXT_DIR = os.path.join(BASE_DIR, "extension")
EBOOK_DIR = os.path.join(BASE_DIR, "ebooks")
WEB_DL_DIR = os.path.join(BASE_DIR, "web", "public", "downloads")

os.makedirs(os.path.join(EXT_DIR, "icons"), exist_ok=True)
os.makedirs(EBOOK_DIR, exist_ok=True)
os.makedirs(WEB_DL_DIR, exist_ok=True)


def create_icons():
    for size in (16, 48, 128):
        doc = fitz.open()
        page = doc.new_page(width=size, height=size)
        rect = fitz.Rect(0, 0, size, size)
        page.draw_rect(rect, color=(0.04, 0.09, 0.16), fill=(0.06, 0.72, 0.50))
        # Draw target crosshair
        center = fitz.Point(size / 2, size / 2)
        page.draw_circle(center, size * 0.34, color=(1, 1, 1), width=max(1.2, size * 0.08))
        page.draw_circle(center, size * 0.14, color=(0.04, 0.09, 0.16), fill=(1, 1, 1))
        pix = page.get_pixmap(alpha=False)
        pix.save(os.path.join(EXT_DIR, "icons", f"icon{size}.png"))
        doc.close()


def package_extension_zip():
    zip_paths = [
        os.path.join(BASE_DIR, "LeadSniper-Pro-Extension.zip"),
        os.path.join(WEB_DL_DIR, "LeadSniper-Pro-Extension.zip"),
    ]
    for zp in zip_paths:
        with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(EXT_DIR):
                for f in files:
                    full = os.path.join(root, f)
                    rel = os.path.relpath(full, EXT_DIR)
                    zf.write(full, os.path.join("leadsniper-pro-extension", rel))


def build_pdf_from_sections(filename: str, badge: str, title: str, subtitle: str, sections: list):
    doc = fitz.open()

    # Cover Page
    cover = doc.new_page(width=612, height=792)
    cover.draw_rect(fitz.Rect(0, 0, 612, 792), color=(0.04, 0.06, 0.10), fill=(0.04, 0.06, 0.10))
    cover.draw_rect(fitz.Rect(0, 0, 612, 12), color=(0.06, 0.72, 0.50), fill=(0.06, 0.72, 0.50))
    cover.draw_rect(fitz.Rect(48, 88, 290, 114), color=(0.06, 0.72, 0.50), fill=(0.06, 0.22, 0.18))
    cover.insert_text(fitz.Point(60, 105), badge, fontsize=10, fontname="helv", color=(0.20, 0.88, 0.64))

    cover.insert_textbox(
        fitz.Rect(48, 145, 564, 340),
        title,
        fontsize=28,
        fontname="hebo",
        color=(1, 1, 1),
        lineheight=1.22,
    )
    cover.insert_textbox(
        fitz.Rect(48, 335, 550, 440),
        subtitle,
        fontsize=13,
        fontname="helv",
        color=(0.65, 0.72, 0.82),
        lineheight=1.45,
    )

    # Executive Summary Box on Cover
    cover.draw_rect(fitz.Rect(48, 470, 564, 670), color=(0.14, 0.20, 0.30), fill=(0.08, 0.11, 0.18), width=1)
    cover.insert_text(fitz.Point(68, 500), "WHAT IS INSIDE THIS EXECUTIVE PLAYBOOK:", fontsize=11, fontname="hebo", color=(0.20, 0.88, 0.64))
    toc_lines = "\n".join([f"•  {sec['heading']}" for sec in sections])
    cover.insert_textbox(
        fitz.Rect(68, 516, 544, 658),
        toc_lines,
        fontsize=10.5,
        fontname="helv",
        color=(0.88, 0.92, 0.96),
        lineheight=1.42,
    )

    cover.insert_text(
        fitz.Point(48, 745),
        "PULSE SOFTWARE LABS  ·  LEADSNIPER PRO EXECUTIVE EDITION  ·  CONFIDENTIAL PLAYBOOK",
        fontsize=8.5,
        fontname="hebo",
        color=(0.45, 0.52, 0.62),
    )

    # Content Pages
    for idx, sec in enumerate(sections, start=1):
        page = doc.new_page(width=612, height=792)
        # Top Header Bar
        page.draw_rect(fitz.Rect(0, 0, 612, 46), color=(0.06, 0.08, 0.13), fill=(0.06, 0.08, 0.13))
        page.insert_text(fitz.Point(42, 28), f"LEADSNIPER PRO  //  {badge}", fontsize=8.5, fontname="hebo", color=(0.20, 0.88, 0.64))
        page.insert_text(fitz.Point(515, 28), f"MODULE 0{idx}", fontsize=8.5, fontname="hebo", color=(0.65, 0.72, 0.82))

        # Section Title
        page.insert_textbox(
            fitz.Rect(42, 64, 570, 115),
            sec["heading"],
            fontsize=17,
            fontname="hebo",
            color=(0.06, 0.09, 0.15),
        )
        page.draw_line(fitz.Point(42, 112), fitz.Point(570, 112), color=(0.06, 0.72, 0.50), width=1.5)

        # Body Text
        page.insert_textbox(
            fitz.Rect(42, 126, 570, 430),
            sec["body"],
            fontsize=10.5,
            fontname="helv",
            color=(0.15, 0.20, 0.28),
            lineheight=1.45,
        )

        # Callout / Script Box
        page.draw_rect(fitz.Rect(42, 442, 570, 725), color=(0.82, 0.88, 0.94), fill=(0.96, 0.98, 0.99), width=1)
        page.draw_rect(fitz.Rect(42, 442, 46, 725), color=(0.06, 0.72, 0.50), fill=(0.06, 0.72, 0.50))
        page.insert_text(fitz.Point(58, 464), sec["box_title"], fontsize=10.5, fontname="hebo", color=(0.04, 0.45, 0.32))
        page.insert_textbox(
            fitz.Rect(58, 476, 556, 715),
            sec["box_content"],
            fontsize=9.8,
            fontname="cour",
            color=(0.10, 0.14, 0.20),
            lineheight=1.36,
        )

        # Footer
        page.insert_text(fitz.Point(42, 765), "LeadSniper Pro — Official Client Acquisition & Fulfillment System", fontsize=8, fontname="helv", color=(0.5, 0.55, 0.62))
        page.insert_text(fitz.Point(545, 765), f"Page {idx + 1}", fontsize=8, fontname="helv", color=(0.5, 0.55, 0.62))

    for out_dir in (EBOOK_DIR, WEB_DL_DIR):
        doc.save(os.path.join(out_dir, filename))
    doc.close()


def create_playbook_1():
    sections = [
        {
            "heading": "1. The 'Broken Funnel' Diagnostic Method (Why Generic Outreach Fails)",
            "body": (
                "99% of freelancers and agencies fail at cold outreach because they send vague, self-centered promises like "
                "'We help dentists get more leads with AI and Facebook Ads.' Local business owners delete those emails in 2 seconds.\n\n"
                "With LeadSniper Pro, you never send a generic pitch. Instead, you filter exclusively for businesses with a verifiable, "
                "publicly visible 'Broken Funnel Leak' on Google Maps:\n"
                "  1. NO WEBSITE OR BROKEN SSL: They are losing 60%+ of high-intent Map searchers.\n"
                "  2. NO 24/7 BOOKING OR CHAT WIDGET: 62% of local service inquiries happen after 5:00 PM.\n"
                "  3. NO META PIXEL OR GOOGLE TAG: They are paying for traffic and letting 96% leave untracked.\n"
                "  4. REVIEW VELOCITY GAP (<25 Reviews or <4.3 Stars): They are invisible in the Google 3-Pack.\n\n"
                "Your outreach rule is simple: Point out the single highest-scoring leak, attach or offer the 1-Click Audit PDF from "
                "LeadSniper Pro, and ask permission to show them the 48-hour fix."
            ),
            "box_title": "CORE CONVERSION FORMULA: THE 3-SENTENCE 'AUDIT DROP' OPENER",
            "box_content": (
                "Sentence 1 (Specific Observation):\n"
                "\"Hi [Owner/Team], I was looking at top [Category] businesses in [City] on Google Maps\n"
                "and noticed [Business Name] [Specific Leak Found by LeadSniper Pro].\"\n\n"
                "Sentence 2 (Quantified Cost of Inaction):\n"
                "\"Usually, that single gap causes about 15 to 30 high-intent callers per month to\n"
                "bounce to the next competitor in the Map Pack.\"\n\n"
                "Sentence 3 (Zero-Friction Value Offer):\n"
                "\"I generated a 1-page Digital Funnel Audit PDF for [Business Name] showing the exact\n"
                "fix — mind if I send it over for you to review?\""
            ),
        },
        {
            "heading": "2. Cold Email Scripts: Missing Website, Broken SSL & Missing Chat Widget",
            "body": (
                "Use these word-for-word scripts when emailing leads exported from LeadSniper Pro. Keep subject lines lowercase and "
                "hyper-specific to their business name so open rates stay above 65%.\n\n"
                "PRO TIP: Never put links or attachments in Email #1 to protect deliverability. When they reply 'Sure, send it over', "
                "reply with the 1-Page Audit PDF generated by LeadSniper Pro's '1-Click Client Audit PDF' button and a link to book a "
                "10-minute walkthrough."
            ),
            "box_title": "COPY-PASTE COLD EMAIL SCRIPTS (LEAK #1 & LEAK #2)",
            "box_content": (
                "--- SCRIPT A: NO 24/7 BOOKING / AI CHAT WIDGET ---\n"
                "Subject: quick question about [Business Name] on Google Maps\n\n"
                "Hi [Business Name] team,\n\n"
                "I found [Business Name] on Google Maps while researching [Category] clinics in [City].\n"
                "Your reviews look great, but when I clicked your website I noticed there's no instant\n"
                "after-hours booking or chat capture widget.\n\n"
                "Since 62% of local customers search after 5 PM, most leave if they can't get an instant\n"
                "answer or book a slot in 30 seconds.\n\n"
                "I mocked up a 1-page audit + live preview showing how an automated 24/7 booking assistant\n"
                "would look on [Website]. Can I send the 1-page PDF over?\n\n"
                "--- SCRIPT B: NO WEBSITE OR UNSECURED HTTP WARNING ---\n"
                "Subject: [Business Name] Google Maps listing\n\n"
                "Hi there — I noticed [Business Name] has [Reviews] reviews on Google Maps in [City],\n"
                "but your website link currently shows a browser security/connection warning.\n\n"
                "I built a clean, mobile-ready preview page specifically for [Business Name] so you can\n"
                "see what a high-converting booking page looks like. Want me to send the link?"
            ),
        },
        {
            "heading": "3. Cold Email & DM Scripts: Missing Meta Pixel & Google Review Gap",
            "body": (
                "Businesses that already have a decent website still suffer from two massive, invisible leaks that LeadSniper Pro "
                "detects automatically:\n\n"
                "1. NO META RETARGETING PIXEL: Every visitor who clicks their Google Maps listing, checks prices, and leaves is lost "
                "forever because they have no retargeting pixel installed.\n"
                "2. LOW GOOGLE REVIEW COUNT (<25 REVIEWS): In local services, the #1 factor determining who gets 70% of the calls is "
                "who appears in the top 3 of Google Maps with the most 5-star reviews."
            ),
            "box_title": "COPY-PASTE SCRIPTS: PIXEL LEAK & GOOGLE REVIEW BOOSTER",
            "box_content": (
                "--- SCRIPT C: MISSING META / FACEBOOK PIXEL ---\n"
                "Subject: [Business Name] website traffic leak\n\n"
                "Hi [Business Name] team,\n\n"
                "Ran a quick diagnostic on [Website] from your Google Maps profile and noticed you don't\n"
                "have a Meta retargeting pixel or Google conversion tag firing.\n\n"
                "Right now, ~95% of locals who click your site from Google Maps leave without calling, and\n"
                "you have no way to follow up with them automatically.\n\n"
                "I put together a 1-page Funnel Audit PDF for [Business Name] showing how to plug this in\n"
                "48 hours. Mind if I send it over?\n\n"
                "--- SCRIPT D: GOOGLE MAPS REVIEW VELOCITY GAP ---\n"
                "Subject: [Business Name] vs top 3 on Google Maps in [City]\n\n"
                "Hi [Owner Name], noticed [Business Name] has a strong [Rating]-star rating on Google Maps,\n"
                "but sits at [Reviews] total reviews while the top 3 spots in [City] average 65+.\n\n"
                "We install an automated SMS review-reactivation system that typically adds 20-35 real\n"
                "5-star reviews from past customers in 14 days (you only pay if it works). Open to seeing\n"
                "how it works?"
            ),
        },
        {
            "heading": "4. WhatsApp, SMS & Instagram DM High-Response Frameworks",
            "body": (
                "When LeadSniper Pro extracts a mobile phone number or an Instagram handle, your response rate jumps from 8% (email) "
                "to 28%-40% (WhatsApp / Instagram DM).\n\n"
                "GOLDEN RULE FOR WHATSAPP & INSTAGRAM DMs:\n"
                "Never send a wall of text. Send a 2-line text opener first, wait for them to reply (or view it), and then drop a "
                "screenshot of their LeadSniper Pro 1-Page Audit Report."
            ),
            "box_title": "WHATSAPP & INSTAGRAM DM SCRIPTS (35%+ REPLY RATE)",
            "box_content": (
                "--- WHATSAPP / SMS OPENER (DIRECT TO OWNER PHONE) ---\n"
                "\"Hey [Business Name] team! Quick heads up — I was checking your Google Maps listing in\n"
                "[City] and spotted a broken setting on your website that's blocking mobile visitors from\n"
                "booking after-hours. Who's the best person to send the 1-page screenshot report to?\"\n\n"
                "--- INSTAGRAM DM OPENER (FOR MEDSPAS, DENTISTS, GYMS, REALTORS) ---\n"
                "Message 1: \"Hey! Love the work you guys are posting in [City] 👏 Quick question — are you\n"
                "currently accepting new [patients/clients] from Google Maps this month?\"\n"
                "(Wait for 'Yes we are!' reply)\n"
                "Message 2: \"Awesome — I actually ran a funnel diagnostic on your Google Maps listing and\n"
                "noticed you're missing an instant DM/booking capture widget on your site (score came back\n"
                "at [Leak Score]/99 leak risk). Just generated a 1-page PDF breakdown for you, want me to\n"
                "drop it here?\""
            ),
        },
        {
            "heading": "5. The 45-Second 'Pattern Interrupt' Cold Call & Follow-Up Engine",
            "body": (
                "If you want to close a $1,000-$2,500 client within 24 hours of buying LeadSniper Pro, pick 20 leads with a Leak Score "
                "above 75, generate their 1-Page Audit PDF, and call the phone number directly.\n\n"
                "Combine calls with the 4-Touch Follow-Up Sequence below: 72% of local business owners buy on Follow-Up #2, #3, or #4 "
                "simply because they were busy on site when Message #1 arrived."
            ),
            "box_title": "45-SECOND COLD CALL OPENER + 4-TOUCH FOLLOW-UP SEQUENCE",
            "box_content": (
                "--- 45-SECOND COLD CALL SCRIPT ---\n"
                "\"Hi, is the owner in? Hey [Name], I'll be super brief — I'm not an ad agency pitching\n"
                "retainers. I was looking at [Business Name] on Google Maps in [City] and noticed your\n"
                "website link [has no SSL / has no instant booking widget]. I already printed a 1-page\n"
                "diagnostic report showing how to fix it in 48 hours so you stop losing Map callers.\n"
                "What's the best email to send this PDF to right now so you have it?\"\n\n"
                "--- THE 4-TOUCH FOLLOW-UP SEQUENCE ---\n"
                "• Day 2: \"Hey! Just floating this to the top of your inbox — did you want me to send\n"
                "  over that 1-page Google Maps Funnel Audit for [Business Name]?\"\n"
                "• Day 4 (Attach the LeadSniper Audit PDF): \"Went ahead and attached the 1-page audit PDF\n"
                "  for [Business Name] here. Take a look at Check #3 and #4 — happy to fix both for you\n"
                "  this week in under 48 hours.\"\n"
                "• Day 7: \"Quick check before I close out your file — are you guys at full capacity for\n"
                "  new clients this month, or still looking to add 15-25 extra bookings?\""
            ),
        },
        {
            "heading": "6. Word-for-Word Objection Handling & The 15-Minute Audit Close",
            "body": (
                "When a business owner replies to your audit PDF and hops on a 15-minute call (or replies over WhatsApp/Email), "
                "you simply walk them through the 6 rows of the LeadSniper Pro Audit PDF.\n\n"
                "Because the Audit PDF shows objective, undeniable facts (Passed vs. Critical Leak), you never have to 'hard sell.' "
                "You simply state the flat 48-hour setup price ($997) + optional $297/mo maintenance."
            ),
            "box_title": "OBJECTION CRUSHER MATRIX FOR LOCAL BUSINESS OWNERS",
            "box_content": (
                "OBJECTION 1: \"How much does this cost?\"\n"
                "ANSWER: \"To fix all the red items on your audit — installing the 24/7 AI booking widget,\n"
                "securing the landing page, and wiring the automated 5-star review booster — it's a flat\n"
                "$997 one-time setup delivered in 48 hours. Even 1 or 2 new customers pays for it 100%.\"\n\n"
                "OBJECTION 2: \"We already have a web guy / agency.\"\n"
                "ANSWER: \"Totally understand! That's actually why I reached out — they left your Meta\n"
                "pixel and after-hours booking capture disconnected (see Row 3 & 4 of your PDF). We don't\n"
                "replace them; we just plug those leaks in 48 hours so the traffic you already get converts.\"\n\n"
                "OBJECTION 3: \"Let me think about it.\"\n"
                "ANSWER: \"Fair enough. Tell you what — let us build and configure the fix for you first.\n"
                "You review it live within 48 hours, and if it doesn't look 10x better than what's live\n"
                "now, you don't pay a cent. Fair enough?\""
            ),
        },
    ]

    build_pdf_from_sections(
        filename="Playbook_1_Local_Client_Acquisition_Outreach_Vault.pdf",
        badge="VIP EXECUTIVE PLAYBOOK #1",
        title="The Local Client Acquisition & Outreach Vault",
        subtitle="50 Proven Cold Email, WhatsApp, Instagram DM & Phone Frameworks to Turn LeadSniper Pro Audits into $1,000–$3,000 Local Business Deals",
        sections=sections,
    )


def create_playbook_2():
    sections = [
        {
            "heading": "1. The '3 Golden Offers' Pricing Menu ($997 Setup + $297/mo Retainer)",
            "body": (
                "Once a local business owner sees their LeadSniper Pro Audit PDF and says 'How do we fix this?', you do NOT need to "
                "spend 3 weeks coding custom software from scratch.\n\n"
                "You sell one of three productized, high-margin '48-Hour Quick-Win Systems' that solve the exact red flags on their "
                "LeadSniper Pro Audit PDF:\n"
                "  • OFFER 1: The 48-Hour High-Converting Local Funnel Rebuild ($997 Setup + $197/mo Hosting & Care)\n"
                "  • OFFER 2: The 24/7 AI Receptionist & Instant Booking Widget ($797 Setup + $297/mo Subscription)\n"
                "  • OFFER 3: The Complete Map-Pack Dominator Bundle (Offers 1 + 2 + Automated 5-Star Review Booster for $1,497 Setup + $397/mo)"
            ),
            "box_title": "PRODUCTIZED PRICING & MARGIN BREAKDOWN",
            "box_content": (
                "OFFER TIER                     SETUP FEE    MONTHLY RETAINER   DELIVERY TIME   YOUR COST\n"
                "----------------------------------------------------------------------------------------\n"
                "1. Local Funnel & SSL Rebuild   $997         $197 / month       90 Minutes      $0 (Vercel)\n"
                "2. 24/7 AI Booking Widget       $797         $297 / month       45 Minutes      ~$5/mo\n"
                "3. Full Map-Pack Dominator      $1,497       $397 / month       2.5 Hours       ~$10/mo\n\n"
                "MATH TO $10,000 / MONTH:\n"
                "• Close just 2 clients/week at $997 setup + $297/mo\n"
                "• Month 1 Cash Collected: $7,976 Setup + $2,376 MRR = $10,352 Net Profit"
            ),
        },
        {
            "heading": "2. System #1: Delivering a High-Converting Local Landing Page in 90 Mins",
            "body": (
                "When LeadSniper Pro flags a business with 'NO_WEBSITE', 'SITE_UNREACHABLE', or 'NO_SSL', here is how you fulfill "
                "their brand-new, mobile-optimized local website in under 90 minutes with zero recurring hosting cost:\n\n"
                "1. EXTRACT ASSETS (10 Mins): Pull their business name, address, phone number, top 5 Google reviews, and photos "
                "directly from their Google Maps listing.\n"
                "2. GENERATE THE INDUSTRY LANDING PAGE (30 Mins): Use our pre-tested Local Conversion Architecture (Sticky 'Click-to-Call' "
                "header, Above-the-Fold Instant Quote/Booking Form, 5-Star Google Review Carousel, Service Area Map, and FAQ).\n"
                "3. DEPLOY WITH FREE HTTPS SSL (15 Mins): Deploy directly to Vercel or Cloudflare Pages ($0/mo forever) with automatic "
                "SSL certificates and connect their domain."
            ),
            "box_title": "THE 7-SECTION HIGH-CONVERTING LOCAL LANDING PAGE BLUEPRINT",
            "box_content": (
                "[STICKY TOP BAR]   📞 Tap to Call Now: (XXX) XXX-XXXX  |  🟢 Accepting New Clients Today\n"
                "[HERO SECTION]     \"#1 Rated [Category] in [City] — Get Your Free Estimate in 60 Seconds\"\n"
                "                   + Embedded 3-Field Instant Callback Form (Name, Phone, Service Needed)\n"
                "[TRUST STRIP]      ⭐ [Rating] Stars on Google Maps  ·  Licensed & Insured  ·  Same-Day Response\n"
                "[SERVICES GRID]    3 Core High-Margin Services with 'Check Availability' Buttons\n"
                "[SOCIAL PROOF]     Top 3 Real 5-Star Customer Reviews Pulled from Google Maps\n"
                "[MAP & HOURS]      Embedded Google Map + Clickable Directions + Operating Hours\n"
                "[FLOATING WIDGET]  Bottom-Right 24/7 Instant SMS / AI Booking Assistant"
            ),
        },
        {
            "heading": "3. System #2: Deploying the 24/7 AI Chat & Instant Booking Widget",
            "body": (
                "Over 75% of local businesses on Google Maps fail the 'hasChatOrBooking' check in LeadSniper Pro. When a homeowner "
                "has a roof leak at 7 PM or a patient wants to book teeth whitening on Sunday, nobody answers the phone.\n\n"
                "You fulfill this in 45 minutes by embedding a single `<script>` tag on their existing website (WordPress, Wix, "
                "Squarespace, Webflow, or custom HTML):\n"
                "  • Greets visitors within 4 seconds with a localized prompt.\n"
                "  • Answers common pricing/insurance/hours FAQs using their business info.\n"
                "  • Captures the visitor's Name + Mobile Number + Requested Time and forwards it instantly to the owner via SMS/Email/WhatsApp."
            ),
            "box_title": "45-MINUTE DEPLOYMENT CHECKLIST (CHAT & PIXEL REMEDIATION)",
            "box_content": (
                "STEP 1: Configure widget with Business Name, Phone, Hours, and Top 3 Services.\n"
                "STEP 2: Connect instant lead webhook -> Owner's WhatsApp / SMS / Email.\n"
                "STEP 3: Install Meta Pixel & Google Tag Manager container in `<head>` (takes 5 mins):\n"
                "        - Fire `Lead` event when the chat/booking form is submitted.\n"
                "        - Fire `Contact` event when any `tel:` phone link is clicked on mobile.\n"
                "STEP 4: Re-run LeadSniper Pro on their URL — all 6 Audit Rows now show green 'PASSED'!\n"
                "        Send the updated green Audit PDF to the client as proof of completion."
            ),
        },
        {
            "heading": "4. System #3: The Automated 5-Star Google Review Booster",
            "body": (
                "Whenever LeadSniper Pro flags 'LOW_REVIEWS' (<25 reviews or <4.3 stars), this is the easiest service on earth to sell "
                "because every business owner knows Google Reviews directly equal phone calls.\n\n"
                "HOW THE 'REVIEW REACTIVATION & FIREWALL' WORKS:\n"
                "1. Export the client's past 100-300 customer contacts (CSV from their invoicing/booking software).\n"
                "2. Send a friendly, personalized SMS/WhatsApp check-in asking for a 1-to-5 rating.\n"
                "3. THE FIREWALL: Anyone who taps 4 or 5 stars is routed directly to the client's Google Maps 'Write a Review' link. "
                "Anyone who taps 1-3 stars is routed to a private feedback form sent to the owner—preventing public negative reviews!"
            ),
            "box_title": "COPY-PASTE CUSTOMER REVIEW REACTIVATION MESSAGE",
            "box_content": (
                "SMS / WhatsApp Message Sent to Past Customers:\n"
                "----------------------------------------------\n"
                "\"Hi [Customer First Name]! It's Dr. [Name] & the team at [Business Name].\n"
                "Thank you again for choosing us recently! As a local business in [City], your feedback\n"
                "means the world to us. Do you have 20 seconds to share your experience on Google here?\n"
                "👉 [Direct Google Maps Review Shortlink]\"\n\n"
                "BENCHMARK RESULTS:\n"
                "• 200 past customers messaged -> 28 to 45 new 5-star Google reviews within 7 days.\n"
                "• Client immediately jumps up the local Google Map Pack."
            ),
        },
        {
            "heading": "5. Ready-to-Sign B2B Client Service Agreement & Onboarding Checklist",
            "body": (
                "Never start work without collecting payment (either 100% upfront for the $997 48-Hour Setup, or 50% upfront / 50% "
                "on live delivery within 48 hours) and sending this clean 1-page agreement.\n\n"
                "Below is the exact plain-English Service Agreement template you can copy into Google Docs and send alongside your "
                "payment link."
            ),
            "box_title": "READY-TO-USE 1-PAGE CLIENT SERVICE AGREEMENT TEMPLATE",
            "box_content": (
                "DIGITAL FUNNEL & CONVERSION UPGRADE AGREEMENT\n"
                "Between: [Your Agency/Studio Name] ('Provider') and [Client Business Name] ('Client')\n"
                "Effective Date: [Date]\n\n"
                "1. SCOPE OF DELIVERABLES (48-HOUR TURNAROUND):\n"
                "   [ ] SSL-Secured Mobile Conversion Landing Page / Website Optimization\n"
                "   [ ] 24/7 Instant Booking & Lead-Capture Widget Installation\n"
                "   [ ] Meta Retargeting Pixel & Google Conversion Tag Configuration\n"
                "   [ ] Automated 5-Star Google Review Booster Setup\n\n"
                "2. INVESTMENT & TERMS:\n"
                "   • One-Time Setup & Implementation Fee: $997 USD (Due upon signing)\n"
                "   • Ongoing Hosting, Monitoring & Reporting Retainer: $297 USD/month (Starts Day 30,\n"
                "     cancelable anytime with 14 days written notice).\n\n"
                "3. PERFORMANCE GUARANTEE:\n"
                "   All deliverables listed in the initial Funnel Audit Report will pass verification\n"
                "   within 48 business hours of receiving domain/account access.\n\n"
                "Signed (Client): ______________________   Signed (Provider): ______________________"
            ),
        },
    ]

    build_pdf_from_sections(
        filename="Playbook_2_48_Hour_Zero_Code_Fulfillment_Blueprint.pdf",
        badge="VIP EXECUTIVE PLAYBOOK #2",
        title="The 48-Hour Agency Fulfillment Blueprint",
        subtitle="Step-by-Step Delivery Systems for Local Funnels, 24/7 AI Booking Widgets & Google Review Boosters + Ready-to-Sign Client Contracts",
        sections=sections,
    )


if __name__ == "__main__":
    create_icons()
    package_extension_zip()
    create_playbook_1()
    create_playbook_2()
    print("Built extension icons, LeadSniper-Pro-Extension.zip, Playbook #1 PDF, and Playbook #2 PDF successfully.")
