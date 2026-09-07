"""CSV report generation."""

import csv
import io

PLATFORM_LABELS = {
    "WOS": "Web of Science",
    "SCOPUS": "Scopus",
    "GOOGLE_SCHOLAR": "Google Scholar",
}

MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def generate_year_wise_csv(report: dict) -> str:
    """Generate CSV for year-wise report."""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")

    platforms = report["platforms"]
    years = report["years"]
    rows = report["rows"]
    totals = report["totals"]
    averages = report["averages"]

    # Title
    w.writerow([f"{report['department']} Department — Citation Report {report['start_year']}-{report['end_year']}"])
    w.writerow([])

    # Header row 1: Platform groups
    header1 = ["Sr. No.", "Faculty Name"]
    for plat in platforms:
        label = PLATFORM_LABELS.get(plat, plat)
        header1.extend([f"Citations in {label}"] + [""] * (len(years)))  # spans columns
    w.writerow(header1)

    # Header row 2: Year columns
    header2 = ["", ""]
    for plat in platforms:
        for year in years:
            header2.append(year)
        header2.append("Total")
    w.writerow(header2)

    # Data rows
    for row in rows:
        data = [row["sr_no"], row["faculty_name"]]
        for plat in platforms:
            plat_data = row.get(plat, {})
            for year in years:
                val = plat_data.get(year)
                data.append("NA" if val is None else val)
            data.append(plat_data.get("total", 0))
        w.writerow(data)

    # Total row
    total_data = ["", "Total"]
    for plat in platforms:
        plat_totals = totals.get(plat, {})
        for year in years:
            total_data.append(plat_totals.get(year, 0))
        total_data.append(plat_totals.get("total", 0))
    w.writerow(total_data)

    # Average row
    avg_data = ["", "Average"]
    for plat in platforms:
        plat_avgs = averages.get(plat, {})
        for year in years:
            avg_data.append(plat_avgs.get(year, 0))
        avg_data.append(plat_avgs.get("total", 0))
    w.writerow(avg_data)

    return "\ufeff" + buf.getvalue()  # UTF-8 BOM for Excel


def generate_month_wise_csv(report: dict) -> str:
    """Generate CSV for month-wise report."""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")

    platforms = report["platforms"]
    months = report["months"]
    rows = report["rows"]
    totals = report["totals"]
    averages = report["averages"]

    w.writerow([f"{report['department']} Department — Citation Report {MONTH_NAMES[report['start_month']]}-{MONTH_NAMES[report['end_month']]} {report['year']}"])
    w.writerow([])

    # Headers
    header1 = ["Sr. No.", "Faculty Name"]
    for plat in platforms:
        label = PLATFORM_LABELS.get(plat, plat)
        header1.extend([f"Citations in {label}"] + [""] * len(months))
    w.writerow(header1)

    header2 = ["", ""]
    for plat in platforms:
        for month in months:
            header2.append(MONTH_NAMES[month])
        header2.append("Total")
    w.writerow(header2)

    # Data
    for row in rows:
        data = [row["sr_no"], row["faculty_name"]]
        for plat in platforms:
            plat_data = row.get(plat, {})
            for month in months:
                val = plat_data.get(month)
                data.append("NA" if val is None else val)
            data.append(plat_data.get("total", 0))
        w.writerow(data)

    # Totals
    total_data = ["", "Total"]
    for plat in platforms:
        plat_totals = totals.get(plat, {})
        for month in months:
            total_data.append(plat_totals.get(month, 0))
        total_data.append(plat_totals.get("total", 0))
    w.writerow(total_data)

    # Averages
    avg_data = ["", "Average"]
    for plat in platforms:
        plat_avgs = averages.get(plat, {})
        for month in months:
            avg_data.append(plat_avgs.get(month, 0))
        avg_data.append(plat_avgs.get("total", 0))
    w.writerow(avg_data)

    return "\ufeff" + buf.getvalue()


def generate_date_range_csv(report: dict) -> str:
    """Generate CSV for date range report."""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")

    platforms = report["platforms"]
    rows = report["rows"]
    totals = report["totals"]
    averages = report["averages"]

    w.writerow([f"{report['department']} Department — Citation Report {report['from_date']} to {report['to_date']}"])
    w.writerow([])

    # Headers
    header1 = ["Sr. No.", "Faculty Name"]
    for plat in platforms:
        label = PLATFORM_LABELS.get(plat, plat)
        header1.extend([f"{label} Papers", f"{label} Citations"])
    w.writerow(header1)

    # Data
    for row in rows:
        data = [row["sr_no"], row["faculty_name"]]
        for plat in platforms:
            plat_data = row.get(plat, {})
            papers_val = plat_data.get("papers")
            cites_val = plat_data.get("citations")
            data.append("NA" if papers_val is None else papers_val)
            data.append("NA" if cites_val is None else cites_val)
        w.writerow(data)

    # Totals
    total_data = ["", "Total"]
    for plat in platforms:
        plat_totals = totals.get(plat, {})
        total_data.append(plat_totals.get("papers", 0))
        total_data.append(plat_totals.get("citations", 0))
    w.writerow(total_data)

    # Averages
    avg_data = ["", "Average"]
    for plat in platforms:
        plat_avgs = averages.get(plat, {})
        avg_data.append(plat_avgs.get("papers", 0))
        avg_data.append(plat_avgs.get("citations", 0))
    w.writerow(avg_data)

    return "\ufeff" + buf.getvalue()
