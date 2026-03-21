#!/usr/bin/env python3
"""Generate SWOOP GitHub Activity Report PDF for Feb-Mar 2026."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib import colors
from datetime import datetime

# Colors
PRIMARY = HexColor('#0087FF')
DARK = HexColor('#1C1C1E')
MEDIUM = HexColor('#363638')
LIGHT_BG = HexColor('#F8F9FA')
ACCENT = HexColor('#00D4FF')
SUCCESS = HexColor('#00C853')
WARNING = HexColor('#FFB300')
ERROR = HexColor('#FF3B30')
TEXT_SECONDARY = HexColor('#636366')
WHITE = white

OUTPUT_PATH = "/Users/Administrator/Mecanix/.claude/worktrees/sad-fermat/SWOOP_GitHub_Activity_Report_Feb_Mar_2026.pdf"


def create_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        'ReportTitle', parent=styles['Title'],
        fontSize=26, leading=32, textColor=DARK,
        spaceAfter=4, fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'ReportSubtitle', parent=styles['Normal'],
        fontSize=12, leading=16, textColor=TEXT_SECONDARY,
        spaceAfter=20, fontName='Helvetica',
    ))
    styles.add(ParagraphStyle(
        'SectionHeader', parent=styles['Heading1'],
        fontSize=16, leading=22, textColor=PRIMARY,
        spaceBefore=20, spaceAfter=10, fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'SubSection', parent=styles['Heading2'],
        fontSize=13, leading=18, textColor=DARK,
        spaceBefore=14, spaceAfter=6, fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'BodyText2', parent=styles['Normal'],
        fontSize=10, leading=14, textColor=DARK,
        spaceAfter=6, fontName='Helvetica', alignment=TA_JUSTIFY,
    ))
    styles.add(ParagraphStyle(
        'BulletItem', parent=styles['Normal'],
        fontSize=10, leading=14, textColor=DARK,
        spaceAfter=3, fontName='Helvetica', leftIndent=16,
        bulletIndent=6,
    ))
    styles.add(ParagraphStyle(
        'SmallNote', parent=styles['Normal'],
        fontSize=8, leading=10, textColor=TEXT_SECONDARY,
        fontName='Helvetica-Oblique',
    ))
    styles.add(ParagraphStyle(
        'TableHeader', parent=styles['Normal'],
        fontSize=9, leading=12, textColor=WHITE,
        fontName='Helvetica-Bold', alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        'TableCell', parent=styles['Normal'],
        fontSize=9, leading=12, textColor=DARK,
        fontName='Helvetica',
    ))
    styles.add(ParagraphStyle(
        'TableCellCenter', parent=styles['Normal'],
        fontSize=9, leading=12, textColor=DARK,
        fontName='Helvetica', alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        'FooterStyle', parent=styles['Normal'],
        fontSize=7, leading=9, textColor=TEXT_SECONDARY,
        fontName='Helvetica', alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        'VerdictGood', parent=styles['Normal'],
        fontSize=10, leading=14, textColor=HexColor('#00C853'),
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'VerdictWarn', parent=styles['Normal'],
        fontSize=10, leading=14, textColor=HexColor('#FFB300'),
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'VerdictBad', parent=styles['Normal'],
        fontSize=10, leading=14, textColor=HexColor('#FF3B30'),
        fontName='Helvetica-Bold',
    ))
    return styles


def header_footer(canvas_obj, doc):
    canvas_obj.saveState()
    w, h = A4

    # Header line
    canvas_obj.setStrokeColor(PRIMARY)
    canvas_obj.setLineWidth(2)
    canvas_obj.line(20 * mm, h - 15 * mm, w - 20 * mm, h - 15 * mm)

    # Header text
    canvas_obj.setFont('Helvetica-Bold', 8)
    canvas_obj.setFillColor(PRIMARY)
    canvas_obj.drawString(20 * mm, h - 13 * mm, "SWOOP PLATFORM")
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.setFillColor(TEXT_SECONDARY)
    canvas_obj.drawRightString(w - 20 * mm, h - 13 * mm, "GitHub Activity Report  |  Feb-Mar 2026")

    # Footer
    canvas_obj.setStrokeColor(HexColor('#E5E5EA'))
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(20 * mm, 15 * mm, w - 20 * mm, 15 * mm)
    canvas_obj.setFont('Helvetica', 7)
    canvas_obj.setFillColor(TEXT_SECONDARY)
    canvas_obj.drawString(20 * mm, 10 * mm, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    canvas_obj.drawCentredString(w / 2, 10 * mm, "Confidential")
    canvas_obj.drawRightString(w - 20 * mm, 10 * mm, f"Page {doc.page}")

    canvas_obj.restoreState()


def make_table(headers, rows, col_widths=None):
    """Create a styled table."""
    styles = create_styles()
    data = [[Paragraph(h, styles['TableHeader']) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), styles['TableCell']) if i == 0
                      else Paragraph(str(c), styles['TableCellCenter'])
                      for i, c in enumerate(row)])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), WHITE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ('TEXTCOLOR', (0, 1), (-1, -1), DARK),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E5EA')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return t


def build_report():
    styles = create_styles()
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        topMargin=22 * mm,
        bottomMargin=22 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
    )

    story = []
    w = A4[0] - 40 * mm  # usable width

    # ── TITLE PAGE ──
    story.append(Spacer(1, 40 * mm))
    story.append(Paragraph("SWOOP Platform", styles['ReportTitle']))
    story.append(Paragraph("GitHub Activity Report", styles['ReportTitle']))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="40%", thickness=3, color=PRIMARY, spaceAfter=12))
    story.append(Paragraph("February - March 2026", styles['ReportSubtitle']))
    story.append(Spacer(1, 20))
    story.append(Paragraph("<b>Repository:</b> rajakin52/swoop-mobility (Swoop-Soft)", styles['BodyText2']))
    story.append(Paragraph("<b>Report Date:</b> March 21, 2026", styles['BodyText2']))
    story.append(Paragraph("<b>Prepared by:</b> Claude Code (AI-assisted analysis)", styles['BodyText2']))
    story.append(Paragraph("<b>Classification:</b> Internal / Confidential", styles['BodyText2']))
    story.append(Spacer(1, 30))

    # Summary box
    summary_data = [
        ['Total Commits (Feb)', '3', 'Total Commits (Mar)', '0'],
        ['Files Changed', '15', 'Lines Added', '450'],
        ['Lines Removed', '125', 'Net Change', '+325'],
        ['Contributors', '1 (Raja Kurban)', 'AI Co-Author', '100% of commits'],
    ]
    summary_table = Table(summary_data, colWidths=[w * 0.28, w * 0.22, w * 0.28, w * 0.22])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, PRIMARY),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica', ),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), TEXT_SECONDARY),
        ('TEXTCOLOR', (2, 0), (2, -1), TEXT_SECONDARY),
        ('TEXTCOLOR', (1, 0), (1, -1), DARK),
        ('TEXTCOLOR', (3, 0), (3, -1), DARK),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E5EA')),
    ]))
    story.append(summary_table)

    story.append(PageBreak())

    # ── SECTION 1: EXECUTIVE SUMMARY ──
    story.append(Paragraph("1. Executive Summary", styles['SectionHeader']))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#E5E5EA'), spaceAfter=10))
    story.append(Paragraph(
        "The <b>swoop-mobility</b> repository experienced a significant slowdown in February 2026 "
        "and complete inactivity in March 2026. Only 3 commits were made in February (all bug fixes "
        "for production deployment issues), and zero commits were made in March. All commits were "
        "authored by Raja Kurban with AI co-authorship (Claude Opus 4.5).",
        styles['BodyText2']
    ))
    story.append(Paragraph(
        "However, development activity did not stop entirely. Uncommitted documentation work "
        "(product manuals) was created in late February but never committed. Additionally, "
        "two collaborators (<b>zubairov</b> and <b>drobiazko</b>) have write access to the repo "
        "but made zero contributions during this period.",
        styles['BodyText2']
    ))
    story.append(Paragraph(
        "Separately, the <b>Swoop-Soft/fleet-management-app</b> repository (a related SWOOP product) "
        "saw active development in March with 18 commits focused on driver app fixes, attendance "
        "features, and deployment infrastructure. A ClickUp project board shows 45+ open tickets "
        "(predominantly bugs) being tracked and worked on by at least 2-3 team members.",
        styles['BodyText2']
    ))

    # ── SECTION 2: REPO ACCESS & COLLABORATORS ──
    story.append(Paragraph("2. Repository Access & Collaborators", styles['SectionHeader']))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#E5E5EA'), spaceAfter=10))

    collab_table = make_table(
        ['User', 'Role', 'Feb Commits', 'Mar Commits', 'Mar Clones', 'Mar Views'],
        [
            ['rajakin52 (Raja Kurban)', 'Admin / Owner', '3', '0', '0', '~1-2'],
            ['zubairov', 'Write (push/pull)', '0', '0', '0', 'Unknown'],
            ['drobiazko', 'Write (push/pull)', '0', '0', '0', 'Unknown'],
        ],
        col_widths=[w * 0.28, w * 0.17, w * 0.11, w * 0.11, w * 0.11, w * 0.11]
    )
    story.append(collab_table)
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "March traffic data: 0 clones for the entire month. Only 2 page views total "
        "(Mar 11 and Mar 18, 1 unique visitor each). The repo was essentially untouched.",
        styles['BodyText2']
    ))

    # ── SECTION 3: COMMIT ANALYSIS ──
    story.append(Paragraph("3. Detailed Commit Analysis", styles['SectionHeader']))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#E5E5EA'), spaceAfter=10))

    # Commit 1
    story.append(Paragraph("3.1  fix(health): Database connectivity check (Jan 31)", styles['SubSection']))
    story.append(Paragraph("<b>Hash:</b> dd3b3f3 &nbsp; | &nbsp; <b>Files:</b> 4 &nbsp; | &nbsp; <b>+90 / -35 lines</b>", styles['SmallNote']))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Added <font face='Courier' size='9'>/health/deep</font> and "
        "<font face='Courier' size='9'>/health/db</font> endpoints. Made "
        "<font face='Courier' size='9'>/health/ready</font> actually verify DB and Redis "
        "connectivity. Fixed HealthModule imports and refactored Redis health indicator to use "
        "the existing RedisService instead of a non-existent DI token.",
        styles['BodyText2']
    ))
    story.append(Paragraph("Quality: Good", styles['VerdictGood']))
    story.append(Paragraph(
        "Proper fix. The previous readiness probe always returned ready:true without checking anything. "
        "Now uses HTTP 503 for unhealthy state. Module imports correctly added.",
        styles['BodyText2']
    ))

    # Commit 2
    story.append(Paragraph("3.2  fix(web): Mixed content blocking for HTTPS (Feb 2)", styles['SubSection']))
    story.append(Paragraph("<b>Hash:</b> 13f65c1 &nbsp; | &nbsp; <b>Files:</b> 10 &nbsp; | &nbsp; <b>+352 / -82 lines</b>", styles['SmallNote']))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Fixed login failures when admin portal was served via CloudFront (HTTPS) but API URL "
        "was baked as HTTP. Added protocol upgrade logic in 4 places. Created PublicConfigController "
        "for unauthenticated config access. Updated Terraform health check paths.",
        styles['BodyText2']
    ))
    story.append(Paragraph("Quality: Mixed", styles['VerdictWarn']))
    story.append(Paragraph(
        "Root cause analysis is sound, but the mixed-content URL resolution logic is <b>copy-pasted "
        "across 4 files</b> (client.ts, use-websocket.ts, useDispatchWebSocket.ts, dispatch-alerts-store.ts). "
        "This should have been extracted into a single utility function. Maintenance risk.",
        styles['BodyText2']
    ))

    # Commit 3
    story.append(Paragraph("3.3  fix(auth): Automatic session cleanup (Feb 5)", styles['SubSection']))
    story.append(Paragraph("<b>Hash:</b> 6444c86 &nbsp; | &nbsp; <b>Files:</b> 1 &nbsp; | &nbsp; <b>+8 / -8 lines</b>", styles['SmallNote']))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Added @Cron(EVERY_6_HOURS) decorator to schedule session cleanup. Fixed redundant "
        "groupBy query in getSessionStats() by batching into existing Promise.all.",
        styles['BodyText2']
    ))
    story.append(Paragraph("Quality: Good", styles['VerdictGood']))
    story.append(Paragraph(
        "Clean, minimal, surgical fix. Session table was growing unbounded causing 504 timeouts. "
        "The 6-hour cron interval is reasonable.",
        styles['BodyText2']
    ))

    story.append(PageBreak())

    # ── SECTION 4: QUALITY ASSESSMENT ──
    story.append(Paragraph("4. Quality Assessment", styles['SectionHeader']))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#E5E5EA'), spaceAfter=10))

    quality_table = make_table(
        ['Aspect', 'Rating', 'Notes'],
        [
            ['Correctness', '8 / 10', 'All 3 fixes address real production issues properly'],
            ['Code Style', '6 / 10', 'Significant duplication in commit #2 (mixed content logic x4)'],
            ['Commit Hygiene', '9 / 10', 'Excellent commit messages with context and rationale'],
            ['Testing', '3 / 10', 'No tests added in any commit'],
            ['Scope Discipline', '7 / 10', 'Commit #2 bundles infra + frontend + backend'],
            ['Overall', '6.5 / 10', 'Production firefighting -- correct but rushed'],
        ],
        col_widths=[w * 0.20, w * 0.12, w * 0.68]
    )
    story.append(quality_table)

    # ── SECTION 5: TIME & AI ESTIMATION ──
    story.append(Paragraph("5. Time & AI Usage Estimation", styles['SectionHeader']))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#E5E5EA'), spaceAfter=10))

    story.append(Paragraph(
        "All 3 commits are co-authored by <b>Claude Opus 4.5</b> (Co-Authored-By header present). "
        "This means 100% of committed code in this period was AI-assisted.",
        styles['BodyText2']
    ))

    time_table = make_table(
        ['Commit', 'Total Time', 'AI Time', 'Human Time', 'AI %'],
        [
            ['Health check fix (Jan 31)', '~1.5 hours', '~30 min', '~1 hour', '35%'],
            ['Mixed content fix (Feb 2)', '~3-4 hours', '~1.5 hours', '~2-2.5 hours', '40%'],
            ['Session cleanup (Feb 5)', '~30 min', '~10 min', '~20 min', '35%'],
            ['TOTALS', '~5-6 hours', '~2 hours', '~3.5-4 hours', '~37%'],
        ],
        col_widths=[w * 0.28, w * 0.15, w * 0.15, w * 0.17, w * 0.10]
    )
    story.append(time_table)
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<b>Human contribution:</b> Problem identification, deployment testing, directing AI, "
        "code review, and production verification. <b>AI contribution:</b> Code generation, "
        "refactoring, Terraform changes, and new controller creation.",
        styles['BodyText2']
    ))

    # ── SECTION 6: UNCOMMITTED WORK ──
    story.append(Paragraph("6. Uncommitted Work (Feb 18-26)", styles['SectionHeader']))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#E5E5EA'), spaceAfter=10))

    story.append(Paragraph(
        "The working tree contains several files created in late February that were never committed:",
        styles['BodyText2']
    ))

    uncommitted_table = make_table(
        ['File', 'Modified', 'Size', 'Type'],
        [
            ['SWOOP_PRODUCT_MANUAL.md', 'Feb 18', '4,262 lines', 'Product manual'],
            ['SWOOP_PRODUCT_MANUAL.pdf', 'Feb 18', 'PDF', 'Generated from above'],
            ['docs/SWOOP_CONTACTLESS_CAR_RENTAL_PRODUCT_MANUAL.md', 'Feb 23', '1,126 lines', 'Product strategy'],
            ['docs/SWOOP_AUTONOMOUS_RIDE_HAILING_PRODUCT_MANUAL.md', 'Feb 23', '1,094 lines', 'Product strategy'],
            ['github-recovery-codes.txt', 'Feb 26', '--', 'SECURITY RISK'],
        ],
        col_widths=[w * 0.42, w * 0.12, w * 0.16, w * 0.20]
    )
    story.append(uncommitted_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Total: ~6,500 lines of product documentation written but never committed. "
        "Estimated effort: 3-5 hours (AI generation + human review).",
        styles['BodyText2']
    ))
    story.append(Paragraph(
        "WARNING: github-recovery-codes.txt is in the repo root. This is a security risk "
        "and should be removed immediately.",
        styles['VerdictBad']
    ))

    story.append(PageBreak())

    # ── SECTION 7: FLEET MANAGEMENT APP ──
    story.append(Paragraph("7. Swoop-Soft/fleet-management-app (March Activity)", styles['SectionHeader']))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#E5E5EA'), spaceAfter=10))

    story.append(Paragraph(
        "While swoop-mobility was dormant, the related <b>fleet-management-app</b> repo under the "
        "Swoop-Soft organization saw active development in March:",
        styles['BodyText2']
    ))

    fleet_table = make_table(
        ['Date', 'Commits', 'Key Changes'],
        [
            ['Mar 11', '5', 'Driver vehicle fix, attendance features, UI cleanup, loading indicator'],
            ['Mar 17', '10', 'Data lookup fixes, Prisma ESM crash, Dockerfile Node 22, revert accidental commits'],
            ['Mar 20', '2', 'Driver app v1.0.16, active check-in restore'],
        ],
        col_widths=[w * 0.12, w * 0.10, w * 0.68]
    )
    story.append(fleet_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Contributor: <b>Kin52 Admin</b> (same person as Raja Kurban, different Git identity). "
        "This repo appears to be the operational/commercial SWOOP product with active users.",
        styles['BodyText2']
    ))

    # ── SECTION 8: CLICKUP BOARD ──
    story.append(Paragraph("8. ClickUp Project Board Analysis", styles['SectionHeader']))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#E5E5EA'), spaceAfter=10))

    story.append(Paragraph(
        "A ClickUp board for the SWOOP project shows 45+ tickets across 5 workflow columns:",
        styles['BodyText2']
    ))

    clickup_table = make_table(
        ['Column', 'Count', 'Description'],
        [
            ['New', '22', 'Tickets logged but not triaged or started'],
            ['Backlog', '6', 'Triaged and accepted, waiting to be picked up'],
            ['In Progress', '4', 'Actively being worked on'],
            ['Ready for Review', '4', 'Work done, waiting for review'],
            ['Approved', '9', 'Reviewed and accepted'],
        ],
        col_widths=[w * 0.18, w * 0.10, w * 0.62]
    )
    story.append(clickup_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Key Observations:", styles['SubSection']))
    bullets = [
        "22 items stuck in 'New' vs only 4 'In Progress' -- intake far outpaces execution",
        "Board is overwhelmingly bugs, not features -- product is in stabilization phase",
        "Many 'Question' tickets -- specs/requirements unclear for developers to start work",
        "4 items waiting for review -- potential bottleneck on reviewer (likely Raja)",
        "At least 2-3 assignees visible (ID, OV, RK) -- team is active but constrained",
        "100% vehicle-related tickets -- focused on Fleet/Vehicle Management module",
    ]
    for b in bullets:
        story.append(Paragraph(f"<bullet>&bull;</bullet> {b}", styles['BulletItem']))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Estimated Effort to Clear the Board:", styles['SubSection']))

    effort_table = make_table(
        ['Category', 'Count (est.)', 'Hours (Low)', 'Hours (High)'],
        [
            ['Question tickets (write + answer)', '~10', '5h', '15h'],
            ['Small bugs (UI/display)', '~15', '15h', '45h'],
            ['Medium bugs (logic/data)', '~15', '45h', '120h'],
            ['Large bugs (cross-cutting)', '~5', '40h', '80h'],
            ['Testing & review overhead', '~30%', '30h', '78h'],
            ['TOTAL', '45+', '~135 hours', '~340 hours'],
        ],
        col_widths=[w * 0.35, w * 0.15, w * 0.18, w * 0.18]
    )
    story.append(effort_table)

    story.append(Spacer(1, 6))

    duration_table = make_table(
        ['Scenario', 'Estimated Duration'],
        [
            ['1 developer, full-time', '3.5 to 8.5 weeks'],
            ['2 developers (ID + OV), full-time', '2 to 4 weeks'],
            ['2 devs + AI-assisted (60% speedup)', '1 to 2.5 weeks'],
            ['Current pace (4 in progress, review bottleneck)', '4 to 8 weeks'],
        ],
        col_widths=[w * 0.50, w * 0.35]
    )
    story.append(duration_table)

    story.append(PageBreak())

    # ── SECTION 9: CONCLUSIONS ──
    story.append(Paragraph("9. Conclusions & Recommendations", styles['SectionHeader']))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#E5E5EA'), spaceAfter=10))

    story.append(Paragraph("Key Findings:", styles['SubSection']))
    findings = [
        "<b>swoop-mobility is dormant.</b> Last commit was Feb 5 -- 44 days of inactivity. "
        "No code, no commits, no clones in March.",
        "<b>Development shifted elsewhere.</b> Active work moved to fleet-management-app (18 commits "
        "in March) and other projects (petty-pro, Mecanix).",
        "<b>All committed code was AI-assisted.</b> Every commit carries a Claude Opus 4.5 co-author "
        "tag. AI accounted for ~37% of estimated total effort.",
        "<b>Quality is acceptable but has gaps.</b> Overall 6.5/10. Good correctness, good commit "
        "messages, but no tests and significant code duplication.",
        "<b>Review bottleneck exists.</b> ClickUp shows 4 items stuck in 'Ready for Review'. "
        "Two collaborators (zubairov, drobiazko) have write access but made zero contributions.",
        "<b>Backlog is growing.</b> 22 new tickets with only 4 in progress. At current pace, "
        "the backlog will take 4-8 weeks to clear.",
        "<b>Security concern.</b> GitHub recovery codes file sitting uncommitted in the repo root.",
    ]
    for f in findings:
        story.append(Paragraph(f"<bullet>&bull;</bullet> {f}", styles['BulletItem']))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Recommendations:", styles['SubSection']))
    recs = [
        "<b>Unblock the review pipeline.</b> The 4 items in 'Ready for Review' should be reviewed "
        "immediately to keep developers productive.",
        "<b>Answer the 'Question' tickets.</b> 10+ clarification tickets are blocking work from "
        "starting. A focused product decision session could clear these in 1-2 hours.",
        "<b>Extract shared utilities.</b> The mixed-content URL logic duplicated across 4 files "
        "should be refactored into a single utility function before it causes bugs.",
        "<b>Add test coverage.</b> None of the February commits included tests. The health check "
        "and session cleanup features are particularly important to test.",
        "<b>Activate collaborators.</b> zubairov and drobiazko have write access but zero activity. "
        "Clarify their roles and expected contribution levels.",
        "<b>Remove security-sensitive files.</b> Delete github-recovery-codes.txt from the working "
        "tree and store it securely elsewhere.",
        "<b>Commit or discard uncommitted docs.</b> 6,500 lines of product documentation sitting "
        "uncommitted since Feb 23. Either commit them or move to a proper docs repository.",
    ]
    for r in recs:
        story.append(Paragraph(f"<bullet>&bull;</bullet> {r}", styles['BulletItem']))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#E5E5EA'), spaceAfter=10))
    story.append(Paragraph(
        "End of Report",
        styles['SmallNote']
    ))

    # Build
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"Report generated: {OUTPUT_PATH}")


if __name__ == '__main__':
    build_report()
