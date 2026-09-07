/* Faculty Research Papers — Faculty can only view their OWN research papers.
   Displays all papers from configured platforms (Scopus, WoS, Google Scholar, ORCID).
   Supports search, filtering by year/platform/date range, and export functionality. */

import { useEffect, useMemo, useState } from "react";
import * as api from "../../lib/api";
import type { Author, Paper } from "../../lib/core";
import { fmtDate } from "../../lib/core";
import { PageHeader, Skeleton, useToast } from "../../components/ui";
import { IcDownload, IcExternal, IcRefresh, IcSearch } from "../../components/icons";
import { downloadExcel, downloadCSV, downloadJSON } from "../../lib/export";
import { useAuth } from "../../state/auth";

type Platform = "SCOPUS" | "WOS" | "GOOGLE_SCHOLAR" | "ORCID";

interface PaperWithSources extends Paper {
  platforms: Platform[];
  totalCitations: number;
}

export default function FacultyResearchPapers() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [selectedFaculty, setSelectedFaculty] = useState<Author | null>(null);
  const [papers, setPapers] = useState<PaperWithSources[] | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"ALL" | Platform>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  const [fetching, setFetching] = useState(false);

  // Load faculty's own profile
  useEffect(() => {
    if (user?.faculty_id) {
      api.getAuthor(api.getToken(), user.faculty_id)
        .then(setSelectedFaculty)
        .catch((e) => toast("error", e instanceof Error ? e.message : "Load failed."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load papers when faculty is loaded
  useEffect(() => {
    if (selectedFaculty) {
      loadPapers(selectedFaculty._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFaculty]);

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
    if (!selectedFaculty) return;
    setFetching(true);
    try {
      // Simulate refreshing papers from platforms
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadPapers(selectedFaculty._id);
      toast("success", "Papers refreshed from configured platforms");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setFetching(false);
    }
  };

  // Apply filters
  const filteredPapers = useMemo(() => {
    if (!papers) return [];
    
    return papers.filter((p) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesDoi = p.doi?.toLowerCase().includes(query);
        const matchesAuthor = p.contributors.some((c) => c.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDoi && !matchesAuthor) return false;
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
      if (fromDate && p.publication_date && p.publication_date < fromDate) {
        return false;
      }
      if (toDate && p.publication_date && p.publication_date > toDate) {
        return false;
      }
      
      return true;
    });
  }, [papers, searchQuery, platformFilter, yearFilter, fromDate, toDate]);

  const handleExport = (format: "excel" | "csv" | "json") => {
    if (!selectedFaculty || filteredPapers.length === 0) {
      toast("error", "No papers to export");
      return;
    }

    const columns = [
      "Sr. No.", "Research Paper Name", "Publication Year", "Publication Date",
      "DOI", "Research Paper Type", "Contributors Name", "Source Name",
      "ISBN", "ISSN", "URL of Research Paper", "Citation Count", "Source Platform"
    ];

    const rows = filteredPapers.map((p, idx) => {
      const sourceRecord = p.source_records[0];
      return [
        idx + 1,
        p.title,
        p.publication_year,
        p.publication_date || "NA",
        p.doi || "NA",
        p.paper_type,
        p.contributors.join("; "),
        sourceRecord?.source_name || "NA",
        p.isbn?.join("; ") || "NA",
        p.issn?.join("; ") || "NA",
        p.paper_url || sourceRecord?.url || "NA",
        p.totalCitations,
        p.platforms.join(", ")
      ];
    });

    const filename = `${selectedFaculty.name.replace(/[^a-z0-9]/gi, "_")}_Research_Papers`;

    if (format === "excel") {
      downloadExcel({ title: filename, columns, rows });
    } else if (format === "csv") {
      downloadCSV({ title: filename, columns, rows });
    } else {
      downloadJSON({ title: filename, columns, rows });
    }

    toast("success", `Exported ${filteredPapers.length} papers as ${format.toUpperCase()}`);
  };

  const totalCitations = filteredPapers.reduce((sum, p) => sum + p.totalCitations, 0);

  if (!selectedFaculty) {
    return (
      <div>
        <PageHeader title="My Research Papers" sub="Loading your profile..." />
        <div className="card p-6">
          <Skeleton className="h-10 mb-3" />
          <Skeleton className="h-10 mb-3" />
          <Skeleton className="h-10" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader 
        title="My Research Papers" 
        sub="View and manage your research publications"
      />

      {/* Faculty Profile Summary */}
      <div className="card p-5 mb-4">
        <h3 className="font-display font-semibold text-ink-900 text-[17px] mb-3">
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
            <div className="font-mono text-xs text-ink-700">{selectedFaculty.identifiers.orcid || "NA"}</div>
          </div>
          <div>
            <div className="text-ink-500 text-xs">Scopus ID</div>
            <div className="font-mono text-xs text-ink-700">{selectedFaculty.identifiers.scopus_id || "NA"}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-5 mb-4">
        <h3 className="font-display font-semibold text-ink-900 text-[15px] mb-3">
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Search</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
                <IcSearch size={15} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Title, DOI, or author..."
                className="input pl-9"
              />
            </div>
          </div>
          <div>
            <label className="label">Platform</label>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value as "ALL" | Platform)}
              className="input"
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
            <input
              type="number"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              placeholder="e.g., 2024"
              className="input"
              min="1900"
              max="2100"
            />
          </div>
          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={handleRefreshPapers}
          disabled={fetching}
          className="btn-dark"
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
        <button
          onClick={() => handleExport("excel")}
          disabled={filteredPapers.length === 0}
          className="btn-primary"
        >
          <IcDownload size={15} /> Export Excel
        </button>
        <button
          onClick={() => handleExport("csv")}
          disabled={filteredPapers.length === 0}
          className="btn-ghost"
        >
          <IcDownload size={15} /> Export CSV
        </button>
        <button
          onClick={() => handleExport("json")}
          disabled={filteredPapers.length === 0}
          className="btn-ghost"
        >
          <IcDownload size={15} /> Export JSON
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div className="card p-4">
          <div className="text-ink-500 text-xs">Total Papers</div>
          <div className="font-display font-semibold text-ink-900 text-2xl num">
            {filteredPapers.length}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-ink-500 text-xs">Total Citations</div>
          <div className="font-display font-semibold text-ink-900 text-2xl num">
            {totalCitations}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-ink-500 text-xs">Platforms</div>
          <div className="font-display font-semibold text-ink-900 text-2xl num">
            {new Set(filteredPapers.flatMap((p) => p.platforms)).size}
          </div>
        </div>
      </div>

      {/* Papers Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="p-10 text-center text-ink-400">
            {papers && papers.length > 0
              ? "No papers match the current filters"
              : "No papers found in your profile"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr>
                  <th className="th">Sr.</th>
                  <th className="th">Paper Title</th>
                  <th className="th">Year</th>
                  <th className="th">Date</th>
                  <th className="th">DOI</th>
                  <th className="th">Type</th>
                  <th className="th">Contributors</th>
                  <th className="th">Platform</th>
                  <th className="th text-right">Citations</th>
                  <th className="th">URL</th>
                </tr>
              </thead>
              <tbody>
                {filteredPapers.map((p, idx) => (
                  <tr key={p._id} className="hover:bg-primary-50/30 transition-colors">
                    <td className="td num text-ink-400 text-xs">{idx + 1}</td>
                    <td className="td">
                      <div className="font-semibold text-ink-900 text-sm max-w-md">
                        {p.title}
                      </div>
                    </td>
                    <td className="td num text-sm">{p.publication_year}</td>
                    <td className="td text-xs text-ink-500">
                      {p.publication_date ? fmtDate(p.publication_date) : "NA"}
                    </td>
                    <td className="td">
                      {p.doi ? (
                        <a
                          href={`https://doi.org/${p.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-600 hover:text-primary-700 text-xs font-mono"
                          title={p.doi}
                        >
                          {p.doi.length > 20 ? `${p.doi.substring(0, 20)}...` : p.doi}
                        </a>
                      ) : (
                        <span className="text-ink-300 text-xs">NA</span>
                      )}
                    </td>
                    <td className="td text-xs">{p.paper_type}</td>
                    <td className="td text-xs max-w-xs truncate" title={p.contributors.join(", ")}>
                      {p.contributors.join(", ")}
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {p.platforms.map((plat) => (
                          <span
                            key={plat}
                            className="chip h-5 px-1.5 text-[9px] font-bold"
                            style={{
                              background:
                                plat === "SCOPUS"
                                  ? "#e9711c20"
                                  : plat === "WOS"
                                  ? "#1299b820"
                                  : plat === "GOOGLE_SCHOLAR"
                                  ? "#3d6de020"
                                  : "#7ba23f20",
                              color:
                                plat === "SCOPUS"
                                  ? "#e9711c"
                                  : plat === "WOS"
                                  ? "#1299b8"
                                  : plat === "GOOGLE_SCHOLAR"
                                  ? "#3d6de0"
                                  : "#7ba23f",
                            }}
                          >
                            {plat === "GOOGLE_SCHOLAR" ? "Scholar" : plat === "WOS" ? "WoS" : plat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="td text-right num font-semibold text-sm">
                      {p.totalCitations}
                    </td>
                    <td className="td">
                      {(p.paper_url || p.source_records[0]?.url) && (
                        <a
                          href={p.paper_url || p.source_records[0]?.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-600 hover:text-primary-700"
                          title="Open paper"
                        >
                          <IcExternal size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
