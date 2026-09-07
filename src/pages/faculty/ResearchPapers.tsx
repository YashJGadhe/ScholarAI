/* Faculty Research Papers — Complete research paper view for a selected faculty member.
   Displays all papers from configured platforms (Scopus, WoS, Google Scholar, ORCID).
   Supports search, filtering by year/platform/date range, and export functionality. */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as api from "../../lib/api";
import type { Author, Paper } from "../../lib/core";
import { fmtDate } from "../../lib/core";
import { PageHeader, Skeleton, useToast } from "../../components/ui";
import { IcDownload, IcExternal, IcRefresh, IcSearch } from "../../components/icons";
import { downloadExcel, downloadCSV, downloadJSON } from "../../lib/export";

type Platform = "SCOPUS" | "WOS" | "GOOGLE_SCHOLAR" | "ORCID";

interface PaperWithSources extends Paper {
  platforms: Platform[];
  totalCitations: number;
}

export default function FacultyResearchPapers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  
  const [authors, setAuthors] = useState<Author[] | null>(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("");
  const [papers, setPapers] = useState<PaperWithSources[] | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"ALL" | Platform>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    api.listAuthors(api.getToken()).then(setAuthors).catch((e) => toast("error", e instanceof Error ? e.message : "Load failed."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load faculty from URL params
  useEffect(() => {
    const facultyId = searchParams.get("faculty");
    if (facultyId && authors) {
      setSelectedFacultyId(facultyId);
    }
  }, [searchParams, authors]);

  // Load papers when faculty is selected
  useEffect(() => {
    if (selectedFacultyId) {
      loadPapers(selectedFacultyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFacultyId]);

  const loadPapers = async (facultyId: string) => {
    setLoading(true);
    try {
      const allPapers = await api.listPapers(api.getToken());
      const facultyPapers = allPapers.filter((p: Paper) => p.faculty_ids.includes(facultyId));
      
      // Transform papers to include platform info and total citations
      const transformed: PaperWithSources[] = facultyPapers.map((p: Paper) => {
        const platforms = [...new Set(p.source_records.map((r) => r.platform))] as Platform[];
        const totalCitations = p.source_records.reduce((sum, r) => sum + (r.citation_count ?? 0), 0);
        return { ...p, platforms, totalCitations };
      });
      
      setPapers(transformed);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Failed to load papers");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPapers = async () => {
    if (!selectedFacultyId) return;
    setFetching(true);
    try {
      // Simulate refreshing papers from platforms
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadPapers(selectedFacultyId);
      toast("success", "Papers refreshed from configured platforms");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setFetching(false);
    }
  };

  const handleFacultyChange = (facultyId: string) => {
    setSelectedFacultyId(facultyId);
    setSearchParams({ faculty: facultyId });
  };

  // Filter papers based on search and filters
  const filteredPapers = useMemo(() => {
    if (!papers) return [];
    
    return papers.filter((p) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          p.title.toLowerCase().includes(query) ||
          p.doi?.toLowerCase().includes(query) ||
          p.contributors.some((c) => c.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      
      // Platform filter
      if (platformFilter !== "ALL" && !p.platforms.includes(platformFilter)) {
        return false;
      }
      
      // Year filter
      if (yearFilter && p.publication_year !== parseInt(yearFilter)) {
        return false;
      }
      
      // Date range filter
      if (fromDate && p.publication_date) {
        if (new Date(p.publication_date) < new Date(fromDate)) return false;
      }
      if (toDate && p.publication_date) {
        if (new Date(p.publication_date) > new Date(toDate)) return false;
      }
      
      return true;
    });
  }, [papers, searchQuery, platformFilter, yearFilter, fromDate, toDate]);

  const selectedFaculty = authors?.find((a) => a._id === selectedFacultyId);

  // Export functionality
  const exportPapers = (format: "excel" | "csv" | "json") => {
    if (!filteredPapers || !selectedFaculty) return;
    
    const columns = [
      "Sr. No.", "Research Paper Name", "Publication Year", "Publication Date",
      "DOI", "Research Paper Type", "Contributors Name", "Source Name",
      "ISBN", "ISSN", "URL of Research Paper", "Citation Count", "Source Platform"
    ];
    
    const rows = filteredPapers.map((p, i) => {
      const sourceRecord = p.source_records[0]; // Primary source
      return [
        i + 1,
        p.title,
        p.publication_year,
        p.publication_date ?? "NA",
        p.doi ?? "NA",
        p.paper_type,
        p.contributors.join("; "),
        sourceRecord?.source_name ?? "NA",
        p.isbn.join("; ") || "NA",
        p.issn.join("; ") || "NA",
        sourceRecord?.url ?? p.paper_url ?? "NA",
        p.totalCitations,
        p.platforms.join(", ")
      ];
    });
    
    const report = {
      title: `${selectedFaculty.name} — Research Publications`,
      columns,
      rows
    };
    
    if (format === "excel") {
      downloadExcel(report);
    } else if (format === "csv") {
      downloadCSV(report);
    } else {
      downloadJSON(report);
    }
    
    toast("success", `${format.toUpperCase()} exported with ${filteredPapers.length} papers`);
  };

  // Get unique years for filter
  const uniqueYears = useMemo(() => {
    if (!papers) return [];
    const years = [...new Set(papers.map((p) => p.publication_year))].sort((a, b) => b - a);
    return years;
  }, [papers]);

  return (
    <div>
      <PageHeader 
        title="Faculty Research Papers" 
        sub="Complete research publication view with multi-platform deduplication"
      />

      {/* Faculty Selection */}
      <div className="card p-5 mb-4">
        <label className="label">Select Faculty</label>
        <select
          className="input"
          value={selectedFacultyId}
          onChange={(e) => handleFacultyChange(e.target.value)}
        >
          <option value="">-- Select a faculty member --</option>
          {authors?.map((a) => (
            <option key={a._id} value={a._id}>
              {a.name} — {a.department}
            </option>
          ))}
        </select>
      </div>

      {selectedFaculty && (
        <>
          {/* Faculty Profile Summary */}
          <div className="card p-5 mb-4">
            <h3 className="font-display font-semibold text-ink-900 text-lg mb-3">
              {selectedFaculty.name}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-ink-500 text-xs">Department</div>
                <div className="font-semibold text-ink-900">{selectedFaculty.department}</div>
              </div>
              <div>
                <div className="text-ink-500 text-xs">Designation</div>
                <div className="font-semibold text-ink-900">{selectedFaculty.designation}</div>
              </div>
              <div>
                <div className="text-ink-500 text-xs">ORCID</div>
                <div className="font-mono text-ink-700 text-xs">{selectedFaculty.identifiers.orcid ?? "NA"}</div>
              </div>
              <div>
                <div className="text-ink-500 text-xs">Scopus ID</div>
                <div className="font-mono text-ink-700 text-xs">{selectedFaculty.identifiers.scopus_id ?? "NA"}</div>
              </div>
            </div>
          </div>

          {/* Filters and Actions */}
          <div className="card p-5 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="label">Search</label>
                <div className="relative">
                  <IcSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    className="input pl-9"
                    placeholder="Title, DOI, or author..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="label">Platform</label>
                <select
                  className="input"
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value as any)}
                >
                  <option value="ALL">All Platforms</option>
                  <option value="SCOPUS">Scopus</option>
                  <option value="WOS">Web of Science</option>
                  <option value="GOOGLE_SCHOLAR">Google Scholar</option>
                  <option value="ORCID">ORCID</option>
                </select>
              </div>
              
              <div>
                <label className="label">Year</label>
                <select
                  className="input"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                >
                  <option value="">All Years</option>
                  {uniqueYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="label">From Date</label>
                <input
                  type="date"
                  className="input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">To Date</label>
                <input
                  type="date"
                  className="input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              
              <div className="flex items-end">
                <button
                  className="btn-dark w-full"
                  onClick={handleRefreshPapers}
                  disabled={fetching}
                >
                  {fetching ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <IcRefresh size={15} /> Refresh Papers
                    </>
                  )}
                </button>
              </div>
              
              <div className="flex items-end gap-2">
                <button className="btn-ghost flex-1" onClick={() => exportPapers("excel")}>
                  <IcDownload size={15} /> Excel
                </button>
                <button className="btn-ghost flex-1" onClick={() => exportPapers("csv")}>
                  <IcDownload size={15} /> CSV
                </button>
                <button className="btn-ghost flex-1" onClick={() => exportPapers("json")}>
                  <IcDownload size={15} /> JSON
                </button>
              </div>
            </div>
          </div>

          {/* Papers Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-8">
                <Skeleton className="h-64" />
              </div>
            ) : filteredPapers.length === 0 ? (
              <div className="p-8 text-center text-ink-400">
                {papers?.length === 0 ? "No papers found for this faculty" : "No papers match the current filters"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] border-collapse">
                  <thead>
                    <tr>
                      <th className="th">Sr.</th>
                      <th className="th">Paper Title</th>
                      <th className="th">Year</th>
                      <th className="th">Date</th>
                      <th className="th">DOI</th>
                      <th className="th">Type</th>
                      <th className="th">Contributors</th>
                      <th className="th">Platforms</th>
                      <th className="th text-right">Citations</th>
                      <th className="th">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPapers.map((p, i) => (
                      <tr key={p._id} className="hover:bg-primary-50/30 transition-colors">
                        <td className="td num text-ink-400 text-xs">{i + 1}</td>
                        <td className="td">
                          <div className="font-semibold text-ink-900 text-sm">{p.title}</div>
                        </td>
                        <td className="td num text-ink-700">{p.publication_year}</td>
                        <td className="td text-ink-500 text-xs">{p.publication_date ? fmtDate(p.publication_date) : "NA"}</td>
                        <td className="td">
                          {p.doi ? (
                            <a
                              href={`https://doi.org/${p.doi}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary-600 hover:text-primary-700 text-xs font-mono"
                              title={p.doi}
                            >
                              {p.doi.length > 20 ? p.doi.substring(0, 20) + "..." : p.doi}
                            </a>
                          ) : (
                            <span className="text-ink-300 text-xs">NA</span>
                          )}
                        </td>
                        <td className="td text-ink-600 text-xs">{p.paper_type}</td>
                        <td className="td">
                          <div className="text-xs text-ink-600 max-w-[200px] truncate" title={p.contributors.join(", ")}>
                            {p.contributors.slice(0, 3).join(", ")}
                            {p.contributors.length > 3 && ` +${p.contributors.length - 3} more`}
                          </div>
                        </td>
                        <td className="td">
                          <div className="flex flex-wrap gap-1">
                            {p.platforms.map((plat) => (
                              <span
                                key={plat}
                                className="chip h-5 px-1.5 text-[10px]"
                                style={{
                                  background: plat === "SCOPUS" ? "#e9711c18" : plat === "WOS" ? "#1299b818" : plat === "GOOGLE_SCHOLAR" ? "#3d6de018" : "#7ba23f18",
                                  color: plat === "SCOPUS" ? "#e9711c" : plat === "WOS" ? "#1299b8" : plat === "GOOGLE_SCHOLAR" ? "#3d6de0" : "#7ba23f",
                                }}
                              >
                                {plat === "GOOGLE_SCHOLAR" ? "Scholar" : plat === "WOS" ? "WoS" : plat}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="td text-right num font-semibold text-ink-900">{p.totalCitations}</td>
                        <td className="td">
                          {p.paper_url || p.source_records[0]?.url ? (
                            <a
                              href={p.paper_url || p.source_records[0]?.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary-600 hover:text-primary-700"
                            >
                              <IcExternal size={14} />
                            </a>
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-ink-50">
                      <td colSpan={8} className="td font-semibold text-ink-700">
                        Total Papers: {filteredPapers.length}
                      </td>
                      <td className="td text-right font-semibold text-ink-900 num">
                        {filteredPapers.reduce((sum, p) => sum + p.totalCitations, 0)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
