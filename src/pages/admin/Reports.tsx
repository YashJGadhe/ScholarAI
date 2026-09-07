import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../../lib/api";
import { PageHeader } from "../../components/ui";
import { IcDownload, IcReport, IcBook } from "../../components/icons";

type ReportType = "year-wise" | "month-wise" | "date-range";
type Platform = "WOS" | "SCOPUS" | "GOOGLE_SCHOLAR";

interface Department {
  name: string;
  faculty_count: number;
}

interface YearWiseReport {
  report_type: string;
  department: string;
  start_year: number;
  end_year: number;
  platforms: Platform[];
  years: number[];
  faculty_count: number;
  rows: any[];
  totals: Record<string, Record<number | "total", number>>;
  averages: Record<string, Record<number | "total", number>>;
}

interface MonthWiseReport {
  report_type: string;
  department: string;
  year: number;
  start_month: number;
  end_month: number;
  platforms: Platform[];
  months: number[];
  faculty_count: number;
  rows: any[];
  totals: Record<string, Record<number | "total", number>>;
  averages: Record<string, Record<number | "total", number>>;
}

interface DateRangeReport {
  report_type: string;
  department: string;
  from_date: string;
  to_date: string;
  platforms: Platform[];
  faculty_count: number;
  rows: any[];
  totals: Record<string, { papers: number; citations: number }>;
  averages: Record<string, { papers: number; citations: number }>;
}

type Report = YearWiseReport | MonthWiseReport | DateRangeReport;

const PLATFORM_LABELS: Record<Platform, string> = {
  WOS: "Web of Science",
  SCOPUS: "Scopus",
  GOOGLE_SCHOLAR: "Google Scholar",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  WOS: "#1299b8",
  SCOPUS: "#e9711c",
  GOOGLE_SCHOLAR: "#3d6de0",
};

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ReportsPage() {
  const navigate = useNavigate();
  const [reportType, setReportType] = useState<ReportType>("year-wise");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["WOS", "SCOPUS", "GOOGLE_SCHOLAR"]);

  // Year-wise
  const [startYear, setStartYear] = useState(2020);
  const [endYear, setEndYear] = useState(2026);

  // Month-wise
  const [year, setYear] = useState(2026);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);

  // Date range
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-12-31");

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/reports/departments", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
        if (data.length > 0) setSelectedDept(data[0].name);
      }
    } catch (err) {
      console.error("Failed to fetch departments", err);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    setError("");
    setReport(null);

    try {
      const params = new URLSearchParams({
        department: selectedDept,
        platforms: platforms.join(","),
      });

      if (reportType === "year-wise") {
        params.append("start_year", startYear.toString());
        params.append("end_year", endYear.toString());
      } else if (reportType === "month-wise") {
        params.append("year", year.toString());
        params.append("start_month", startMonth.toString());
        params.append("end_month", endMonth.toString());
      } else {
        params.append("from_date", fromDate);
        params.append("to_date", toDate);
      }

      const res = await fetch(`/reports/${reportType}?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to generate report");
      }

      const data = await res.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (format: "excel" | "csv" | "pdf") => {
    const params = new URLSearchParams({
      department: selectedDept,
      platforms: platforms.join(","),
      fmt: format,
    });

    if (reportType === "year-wise") {
      params.append("start_year", startYear.toString());
      params.append("end_year", endYear.toString());
    } else if (reportType === "month-wise") {
      params.append("year", year.toString());
      params.append("start_month", startMonth.toString());
      params.append("end_month", endMonth.toString());
    } else {
      params.append("from_date", fromDate);
      params.append("to_date", toDate);
    }

    const res = await fetch(`/reports/${reportType}/download?${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (!res.ok) {
      setError("Failed to download report");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const togglePlatform = (plat: Platform) => {
    if (platforms.includes(plat)) {
      if (platforms.length > 1) {
        setPlatforms(platforms.filter((p) => p !== plat));
      }
    } else {
      setPlatforms([...platforms, plat]);
    }
  };

  const renderReportPreview = () => {
    if (!report) return null;

    if (report.report_type === "YEAR_WISE") {
      const r = report as YearWiseReport;
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className="border border-ink-300 bg-ink-800 text-white p-2 text-center">
                  Sr. No.
                </th>
                <th rowSpan={2} className="border border-ink-300 bg-ink-800 text-white p-2 text-center">
                  Faculty Name
                </th>
                {r.platforms.map((plat) => (
                  <th
                    key={plat}
                    colSpan={r.years.length + 1}
                    className="border border-ink-300 text-white p-2 text-center font-bold"
                    style={{ backgroundColor: PLATFORM_COLORS[plat] }}
                  >
                    Citations in {PLATFORM_LABELS[plat]}
                  </th>
                ))}
              </tr>
              <tr>
                {r.platforms.map((plat) =>
                  r.years.map((year) => (
                    <th
                      key={`${plat}-${year}`}
                      className="border border-ink-300 text-white p-1 text-center text-xs"
                      style={{ backgroundColor: PLATFORM_COLORS[plat] }}
                    >
                      {year}
                    </th>
                  ))
                )}
                {r.platforms.map((plat) => (
                  <th
                    key={`${plat}-total`}
                    className="border border-ink-300 text-white p-1 text-center text-xs font-bold"
                    style={{ backgroundColor: PLATFORM_COLORS[plat] }}
                  >
                    Total
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-ink-50"}>
                  <td className="border border-ink-200 p-1 text-center">{row.sr_no}</td>
                  <td className="border border-ink-200 p-1">{row.faculty_name}</td>
                  {r.platforms.map((plat) =>
                    r.years.map((year) => {
                      const val = row[plat]?.[year];
                      return (
                        <td key={`${plat}-${year}`} className="border border-ink-200 p-1 text-center">
                          {val === null || val === undefined ? "NA" : val}
                        </td>
                      );
                    })
                  )}
                  {r.platforms.map((plat) => (
                    <td key={`${plat}-total`} className="border border-ink-200 p-1 text-center font-bold">
                      {row[plat]?.total || 0}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-ink-100 font-bold">
                <td colSpan={2} className="border border-ink-200 p-1 text-center">Total</td>
                {r.platforms.map((plat) =>
                  r.years.map((year) => (
                    <td key={`${plat}-${year}`} className="border border-ink-200 p-1 text-center">
                      {r.totals[plat]?.[year] || 0}
                    </td>
                  ))
                )}
                {r.platforms.map((plat) => (
                  <td key={`${plat}-total`} className="border border-ink-200 p-1 text-center">
                    {r.totals[plat]?.total || 0}
                  </td>
                ))}
              </tr>
              <tr className="bg-ink-100 font-bold">
                <td colSpan={2} className="border border-ink-200 p-1 text-center">Average</td>
                {r.platforms.map((plat) =>
                  r.years.map((year) => (
                    <td key={`${plat}-${year}`} className="border border-ink-200 p-1 text-center">
                      {r.averages[plat]?.[year]?.toFixed(2) || "0.00"}
                    </td>
                  ))
                )}
                {r.platforms.map((plat) => (
                  <td key={`${plat}-total`} className="border border-ink-200 p-1 text-center">
                    {r.averages[plat]?.total?.toFixed(2) || "0.00"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (report.report_type === "MONTH_WISE") {
      const r = report as MonthWiseReport;
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className="border border-ink-300 bg-ink-800 text-white p-2 text-center">
                  Sr. No.
                </th>
                <th rowSpan={2} className="border border-ink-300 bg-ink-800 text-white p-2 text-center">
                  Faculty Name
                </th>
                {r.platforms.map((plat) => (
                  <th
                    key={plat}
                    colSpan={r.months.length + 1}
                    className="border border-ink-300 text-white p-2 text-center font-bold"
                    style={{ backgroundColor: PLATFORM_COLORS[plat] }}
                  >
                    Citations in {PLATFORM_LABELS[plat]}
                  </th>
                ))}
              </tr>
              <tr>
                {r.platforms.map((plat) =>
                  r.months.map((month) => (
                    <th
                      key={`${plat}-${month}`}
                      className="border border-ink-300 text-white p-1 text-center text-xs"
                      style={{ backgroundColor: PLATFORM_COLORS[plat] }}
                    >
                      {MONTH_NAMES[month]}
                    </th>
                  ))
                )}
                {r.platforms.map((plat) => (
                  <th
                    key={`${plat}-total`}
                    className="border border-ink-300 text-white p-1 text-center text-xs font-bold"
                    style={{ backgroundColor: PLATFORM_COLORS[plat] }}
                  >
                    Total
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-ink-50"}>
                  <td className="border border-ink-200 p-1 text-center">{row.sr_no}</td>
                  <td className="border border-ink-200 p-1">{row.faculty_name}</td>
                  {r.platforms.map((plat) =>
                    r.months.map((month) => {
                      const val = row[plat]?.[month];
                      return (
                        <td key={`${plat}-${month}`} className="border border-ink-200 p-1 text-center">
                          {val === null || val === undefined ? "NA" : val}
                        </td>
                      );
                    })
                  )}
                  {r.platforms.map((plat) => (
                    <td key={`${plat}-total`} className="border border-ink-200 p-1 text-center font-bold">
                      {row[plat]?.total || 0}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-ink-100 font-bold">
                <td colSpan={2} className="border border-ink-200 p-1 text-center">Total</td>
                {r.platforms.map((plat) =>
                  r.months.map((month) => (
                    <td key={`${plat}-${month}`} className="border border-ink-200 p-1 text-center">
                      {r.totals[plat]?.[month] || 0}
                    </td>
                  ))
                )}
                {r.platforms.map((plat) => (
                  <td key={`${plat}-total`} className="border border-ink-200 p-1 text-center">
                    {r.totals[plat]?.total || 0}
                  </td>
                ))}
              </tr>
              <tr className="bg-ink-100 font-bold">
                <td colSpan={2} className="border border-ink-200 p-1 text-center">Average</td>
                {r.platforms.map((plat) =>
                  r.months.map((month) => (
                    <td key={`${plat}-${month}`} className="border border-ink-200 p-1 text-center">
                      {r.averages[plat]?.[month]?.toFixed(2) || "0.00"}
                    </td>
                  ))
                )}
                {r.platforms.map((plat) => (
                  <td key={`${plat}-total`} className="border border-ink-200 p-1 text-center">
                    {r.averages[plat]?.total?.toFixed(2) || "0.00"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (report.report_type === "DATE_RANGE") {
      const r = report as DateRangeReport;
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-ink-300 bg-ink-800 text-white p-2 text-center">Sr. No.</th>
                <th className="border border-ink-300 bg-ink-800 text-white p-2 text-center">Faculty Name</th>
                {r.platforms.map((plat) => (
                  <th
                    key={`${plat}-papers`}
                    className="border border-ink-300 text-white p-2 text-center font-bold"
                    style={{ backgroundColor: PLATFORM_COLORS[plat] }}
                  >
                    {PLATFORM_LABELS[plat]} Papers
                  </th>
                ))}
                {r.platforms.map((plat) => (
                  <th
                    key={`${plat}-citations`}
                    className="border border-ink-300 text-white p-2 text-center font-bold"
                    style={{ backgroundColor: PLATFORM_COLORS[plat] }}
                  >
                    {PLATFORM_LABELS[plat]} Citations
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-ink-50"}>
                  <td className="border border-ink-200 p-1 text-center">{row.sr_no}</td>
                  <td className="border border-ink-200 p-1">{row.faculty_name}</td>
                  {r.platforms.map((plat) => (
                    <td key={`${plat}-papers`} className="border border-ink-200 p-1 text-center">
                      {row[plat]?.papers === null || row[plat]?.papers === undefined ? "NA" : row[plat].papers}
                    </td>
                  ))}
                  {r.platforms.map((plat) => (
                    <td key={`${plat}-citations`} className="border border-ink-200 p-1 text-center">
                      {row[plat]?.citations === null || row[plat]?.citations === undefined ? "NA" : row[plat].citations}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-ink-100 font-bold">
                <td colSpan={2} className="border border-ink-200 p-1 text-center">Total</td>
                {r.platforms.map((plat) => (
                  <td key={`${plat}-papers`} className="border border-ink-200 p-1 text-center">
                    {r.totals[plat]?.papers || 0}
                  </td>
                ))}
                {r.platforms.map((plat) => (
                  <td key={`${plat}-citations`} className="border border-ink-200 p-1 text-center">
                    {r.totals[plat]?.citations || 0}
                  </td>
                ))}
              </tr>
              <tr className="bg-ink-100 font-bold">
                <td colSpan={2} className="border border-ink-200 p-1 text-center">Average</td>
                {r.platforms.map((plat) => (
                  <td key={`${plat}-papers`} className="border border-ink-200 p-1 text-center">
                    {r.averages[plat]?.papers?.toFixed(2) || "0.00"}
                  </td>
                ))}
                {r.platforms.map((plat) => (
                  <td key={`${plat}-citations`} className="border border-ink-200 p-1 text-center">
                    {r.averages[plat]?.citations?.toFixed(2) || "0.00"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Reports"
        sub="Generate comprehensive citation and publication reports for faculty"
      />

      <div className="bg-white rounded-lg shadow-sm border border-ink-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-ink-700 mb-2">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-3 py-2 border border-ink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="year-wise">Year Wise</option>
              <option value="month-wise">Month Wise</option>
              <option value="date-range">Custom Date Range</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink-700 mb-2">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 border border-ink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {departments.map((dept) => (
                <option key={dept.name} value={dept.name}>
                  {dept.name} ({dept.faculty_count})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-ink-700 mb-2">Platforms</label>
            <div className="flex gap-2">
              {(["WOS", "SCOPUS", "GOOGLE_SCHOLAR"] as Platform[]).map((plat) => (
                <button
                  key={plat}
                  onClick={() => togglePlatform(plat)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    platforms.includes(plat)
                      ? "text-white"
                      : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                  }`}
                  style={platforms.includes(plat) ? { backgroundColor: PLATFORM_COLORS[plat] } : {}}
                >
                  {PLATFORM_LABELS[plat]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {reportType === "year-wise" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">Start Year</label>
              <input
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value))}
                min={2000}
                max={2100}
                className="w-full px-3 py-2 border border-ink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">End Year</label>
              <input
                type="number"
                value={endYear}
                onChange={(e) => setEndYear(parseInt(e.target.value))}
                min={2000}
                max={2100}
                className="w-full px-3 py-2 border border-ink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}

        {reportType === "month-wise" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                min={2000}
                max={2100}
                className="w-full px-3 py-2 border border-ink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">Start Month</label>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-ink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {MONTH_NAMES[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">End Month</label>
              <select
                value={endMonth}
                onChange={(e) => setEndMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-ink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {MONTH_NAMES[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {reportType === "date-range" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-ink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-ink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={generateReport}
            disabled={loading || !selectedDept}
            className="px-6 py-2 bg-primary-600 text-white rounded-md font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Generating..." : "Generate Report"}
          </button>

          {report && (
            <>
              <button
                onClick={() => downloadReport("excel")}
                className="px-4 py-2 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <IcDownload size={18} /> Download Excel
              </button>
              <button
                onClick={() => downloadReport("csv")}
                className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <IcReport size={18} /> Download CSV
              </button>
              <button
                onClick={() => downloadReport("pdf")}
                className="px-4 py-2 bg-red-600 text-white rounded-md font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <IcBook size={18} /> Download PDF
              </button>
            </>
          )}
        </div>

        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>}
      </div>

      {report && (
        <div className="bg-white rounded-lg shadow-sm border border-ink-200 p-6">
          <h3 className="text-lg font-bold text-ink-900 mb-4">Report Preview</h3>
          {renderReportPreview()}
        </div>
      )}
    </div>
  );
}
