"""PDF report generation using reportlab."""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

PLATFORM_COLORS = {
    "WOS": colors.HexColor("#1299B8"),
    "SCOPUS": colors.HexColor("#E9711C"),
    "GOOGLE_SCHOLAR": colors.HexColor("#3D6DE0"),
}

PLATFORM_LABELS = {
    "WOS": "Web of Science",
    "SCOPUS": "Scopus",
    "GOOGLE_SCHOLAR": "Google Scholar",
}

MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def generate_year_wise_pdf(report: dict) -> bytes:
    """Generate PDF for year-wise report."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        alignment=1,  # center
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=12,
        alignment=1,
        textColor=colors.grey,
        spaceAfter=12,
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph(f"{report['department']} Department", title_style))
    elements.append(Paragraph(
        f"Citation Report — {report['start_year']} to {report['end_year']}",
        subtitle_style
    ))
    elements.append(Spacer(1, 0.2*inch))
    
    # Build table data
    platforms = report["platforms"]
    years = report["years"]
    rows = report["rows"]
    totals = report["totals"]
    averages = report["averages"]
    
    # Header row 1: Platform groups
    header1 = ["Sr.", "Faculty Name"]
    for plat in platforms:
        label = PLATFORM_LABELS.get(plat, plat)
        header1.append(f"Citations in {label}")
        header1.extend([""] * len(years))  # merged cells
    
    # Header row 2: Year columns
    header2 = ["", ""]
    for plat in platforms:
        for year in years:
            header2.append(str(year))
        header2.append("Total")
    
    table_data = [header1, header2]
    
    # Data rows
    for row in rows:
        data = [str(row["sr_no"]), row["faculty_name"]]
        for plat in platforms:
            plat_data = row.get(plat, {})
            for year in years:
                val = plat_data.get(year)
                data.append("NA" if val is None else str(val))
            data.append(str(plat_data.get("total", 0)))
        table_data.append(data)
    
    # Total row
    total_data = ["", "Total"]
    for plat in platforms:
        plat_totals = totals.get(plat, {})
        for year in years:
            total_data.append(str(plat_totals.get(year, 0)))
        total_data.append(str(plat_totals.get("total", 0)))
    table_data.append(total_data)
    
    # Average row
    avg_data = ["", "Average"]
    for plat in platforms:
        plat_avgs = averages.get(plat, {})
        for year in years:
            avg_data.append(str(plat_avgs.get(year, 0)))
        avg_data.append(str(plat_avgs.get("total", 0)))
    table_data.append(avg_data)
    
    # Create table
    col_widths = [0.4*inch, 2*inch] + [0.5*inch] * (len(table_data[0]) - 2)
    table = Table(table_data, colWidths=col_widths, repeatRows=2)
    
    # Style table
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#29405C")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 8),
        ('FONTNAME', (0, 2), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 2), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BACKGROUND', (0, -2), (-1, -2), colors.HexColor("#F0F0F0")),
        ('FONTNAME', (0, -2), (-1, -2), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#F0F0F0")),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ]
    
    # Color platform headers
    col_offset = 2
    for plat in platforms:
        color = PLATFORM_COLORS.get(plat, colors.HexColor("#29405C"))
        num_cols = len(years) + 1
        table_style.append(('BACKGROUND', (col_offset, 0), (col_offset + num_cols - 1, 0), color))
        table_style.append(('BACKGROUND', (col_offset, 1), (col_offset + num_cols - 1, 1), color))
        table_style.append(('TEXTCOLOR', (col_offset, 1), (col_offset + num_cols - 1, 1), colors.whitesmoke))
        col_offset += num_cols
    
    table.setStyle(TableStyle(table_style))
    elements.append(table)
    
    # Footer
    elements.append(Spacer(1, 0.2*inch))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%d %B %Y')}", footer_style))
    
    doc.build(elements)
    return buf.getvalue()


def generate_month_wise_pdf(report: dict) -> bytes:
    """Generate PDF for month-wise report."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=16, alignment=1, spaceAfter=6)
    subtitle_style = ParagraphStyle('CustomSubtitle', parent=styles['Heading2'], fontSize=12, alignment=1, textColor=colors.grey, spaceAfter=12)
    
    elements = []
    
    start_m = MONTH_NAMES[report["start_month"]]
    end_m = MONTH_NAMES[report["end_month"]]
    elements.append(Paragraph(f"{report['department']} Department", title_style))
    elements.append(Paragraph(f"Citation Report — {start_m} to {end_m} {report['year']}", subtitle_style))
    elements.append(Spacer(1, 0.2*inch))
    
    platforms = report["platforms"]
    months = report["months"]
    rows = report["rows"]
    totals = report["totals"]
    averages = report["averages"]
    
    # Headers
    header1 = ["Sr.", "Faculty Name"]
    for plat in platforms:
        label = PLATFORM_LABELS.get(plat, plat)
        header1.append(f"Citations in {label}")
        header1.extend([""] * len(months))
    
    header2 = ["", ""]
    for plat in platforms:
        for month in months:
            header2.append(MONTH_NAMES[month])
        header2.append("Total")
    
    table_data = [header1, header2]
    
    # Data
    for row in rows:
        data = [str(row["sr_no"]), row["faculty_name"]]
        for plat in platforms:
            plat_data = row.get(plat, {})
            for month in months:
                val = plat_data.get(month)
                data.append("NA" if val is None else str(val))
            data.append(str(plat_data.get("total", 0)))
        table_data.append(data)
    
    # Total
    total_data = ["", "Total"]
    for plat in platforms:
        plat_totals = totals.get(plat, {})
        for month in months:
            total_data.append(str(plat_totals.get(month, 0)))
        total_data.append(str(plat_totals.get("total", 0)))
    table_data.append(total_data)
    
    # Average
    avg_data = ["", "Average"]
    for plat in platforms:
        plat_avgs = averages.get(plat, {})
        for month in months:
            avg_data.append(str(plat_avgs.get(month, 0)))
        avg_data.append(str(plat_avgs.get("total", 0)))
    table_data.append(avg_data)
    
    col_widths = [0.4*inch, 2*inch] + [0.45*inch] * (len(table_data[0]) - 2)
    table = Table(table_data, colWidths=col_widths, repeatRows=2)
    
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#29405C")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 8),
        ('FONTNAME', (0, 2), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 2), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BACKGROUND', (0, -2), (-1, -2), colors.HexColor("#F0F0F0")),
        ('FONTNAME', (0, -2), (-1, -2), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#F0F0F0")),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ]
    
    col_offset = 2
    for plat in platforms:
        color = PLATFORM_COLORS.get(plat, colors.HexColor("#29405C"))
        num_cols = len(months) + 1
        table_style.append(('BACKGROUND', (col_offset, 0), (col_offset + num_cols - 1, 0), color))
        table_style.append(('BACKGROUND', (col_offset, 1), (col_offset + num_cols - 1, 1), color))
        table_style.append(('TEXTCOLOR', (col_offset, 1), (col_offset + num_cols - 1, 1), colors.whitesmoke))
        col_offset += num_cols
    
    table.setStyle(TableStyle(table_style))
    elements.append(table)
    
    elements.append(Spacer(1, 0.2*inch))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%d %B %Y')}", footer_style))
    
    doc.build(elements)
    return buf.getvalue()


def generate_date_range_pdf(report: dict) -> bytes:
    """Generate PDF for date range report."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=16, alignment=1, spaceAfter=6)
    subtitle_style = ParagraphStyle('CustomSubtitle', parent=styles['Heading2'], fontSize=12, alignment=1, textColor=colors.grey, spaceAfter=12)
    
    elements = []
    
    from_dt = datetime.fromisoformat(report["from_date"])
    to_dt = datetime.fromisoformat(report["to_date"])
    
    elements.append(Paragraph(f"{report['department']} Department", title_style))
    elements.append(Paragraph(
        f"Citation Report — {from_dt.strftime('%d %B %Y')} to {to_dt.strftime('%d %B %Y')}",
        subtitle_style
    ))
    elements.append(Spacer(1, 0.2*inch))
    
    platforms = report["platforms"]
    rows = report["rows"]
    totals = report["totals"]
    averages = report["averages"]
    
    # Headers
    header = ["Sr.", "Faculty Name"]
    for plat in platforms:
        label = PLATFORM_LABELS.get(plat, plat)
        header.extend([f"{label} Papers", f"{label} Citations"])
    
    table_data = [header]
    
    # Data
    for row in rows:
        data = [str(row["sr_no"]), row["faculty_name"]]
        for plat in platforms:
            plat_data = row.get(plat, {})
            papers_val = plat_data.get("papers")
            cites_val = plat_data.get("citations")
            data.append("NA" if papers_val is None else str(papers_val))
            data.append("NA" if cites_val is None else str(cites_val))
        table_data.append(data)
    
    # Total
    total_data = ["", "Total"]
    for plat in platforms:
        plat_totals = totals.get(plat, {})
        total_data.append(str(plat_totals.get("papers", 0)))
        total_data.append(str(plat_totals.get("citations", 0)))
    table_data.append(total_data)
    
    # Average
    avg_data = ["", "Average"]
    for plat in platforms:
        plat_avgs = averages.get(plat, {})
        avg_data.append(str(plat_avgs.get("papers", 0)))
        avg_data.append(str(plat_avgs.get("citations", 0)))
    table_data.append(avg_data)
    
    col_widths = [0.4*inch, 2*inch] + [0.8*inch] * (len(table_data[0]) - 2)
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#29405C")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BACKGROUND', (0, -2), (-1, -2), colors.HexColor("#F0F0F0")),
        ('FONTNAME', (0, -2), (-1, -2), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#F0F0F0")),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ]
    
    table.setStyle(TableStyle(table_style))
    elements.append(table)
    
    elements.append(Spacer(1, 0.2*inch))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%d %B %Y')}", footer_style))
    
    doc.build(elements)
    return buf.getvalue()
