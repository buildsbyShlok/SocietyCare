import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle,
  Search,
  X,
  Filter,
  RotateCcw,
  AlertCircle,
  Inbox,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ClipboardList,
  CircleDot,
  Clock3,
  CircleCheck,
} from 'lucide-react';
import { complaints as complaintsApi } from '../api/index';
import { useAuth } from '../context/AuthContext';
import { ROLES, CATEGORY_LABELS } from '../utils/constants';
import ComplaintCard from '../components/ComplaintCard';
import AssetFilter from '../components/AssetFilter';
import Metric from '../components/Metric';
import { Load, useResource } from '../components/Workspace';
import './Complaints.css';

const STATUS_TABS = [
  { label: 'All Issues', value: '' },
  { label: 'Open', value: 'OPEN' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
];

/**
 * Complaints Board — Resident & Admin Ticket Management Interface (Phase 4A)
 */
export default function Complaints() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;
  const residentStats = useResource(isAdmin ? null : '/dashboard');
  const [searchParams, setSearchParams] = useSearchParams();
  const archived = searchParams.get('archived') === 'true';

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  // Filter state
  const statusFilter = searchParams.get('status') || '';
  const sourceFilter = isAdmin ? searchParams.get('source') || '' : '';
  const assetFilter = isAdmin ? searchParams.get('assetId') || '' : '';
  function setQuery(key, value) {
    setPage(1);
    setSearchParams(previous => { const next = new URLSearchParams(previous); value ? next.set(key, value) : next.delete(key); return next; });
  }
  const setStatusFilter = value => setQuery('status', value);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const hasActiveFilters = Boolean(
    statusFilter || categoryFilter || priorityFilter || searchFilter || dateFilter || sourceFilter || assetFilter
  );

  // Reset to first page when any search filter is updated
  useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter, priorityFilter, searchFilter, dateFilter, archived, sourceFilter, assetFilter]);

  useEffect(() => {
    let cancelled = false;
    async function fetchComplaints() {
      setLoading(true);
      setError('');
      try {
        const params = { page, limit: 10 };
        if (archived) params.archived = true;
        if (statusFilter) params.status = statusFilter;
        if (categoryFilter) params.category = categoryFilter;
        if (priorityFilter) params.priority = priorityFilter;
        if (searchFilter) params.search = searchFilter;
        if (isAdmin && dateFilter) params.date = dateFilter;
        if (sourceFilter) params.source = sourceFilter;
        if (assetFilter) params.assetId = assetFilter;

        const data = await complaintsApi.list(params, token);
        if (cancelled) return;
        setComplaints(data.items || []);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.totalItems || 0);
        setHasNextPage(data.hasNextPage || false);
        setHasPreviousPage(data.hasPreviousPage || false);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load complaints');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchComplaints();
    return () => { cancelled = true; };
  }, [statusFilter, categoryFilter, priorityFilter, searchFilter, dateFilter, page, token, isAdmin, archived, sourceFilter, assetFilter]);

  function clearFilters() {
    setSearchParams(archived ? { archived: 'true' } : {});
    setCategoryFilter('');
    setPriorityFilter('');
    setSearchFilter('');
    setDateFilter('');
    setPage(1);
  }

  return (
    <div className="page complaints-board">
      {/* Page Header */}
      <header className="page-header">
        <div className="page-header-title">
          <h1>{archived ? 'Archived Complaints' : isAdmin ? 'Maintenance Backlog' : 'My Reported Issues'}</h1>
          <p className="page-header-subtitle">
            {isAdmin
              ? 'Oversee, review, and progress society maintenance tickets'
              : 'Track status and updates on your submitted maintenance requests'}
          </p>
        </div>
        <div className="workspace-actions">
          {!isAdmin && (
            <Link to="/complaints/new" className="btn btn-primary">
              <PlusCircle size={15} />
              <span>Report Issue</span>
            </Link>
          )}
        </div>
      </header>

      {!isAdmin && (
        <Load source={residentStats}>
          {(stats) => (
            <section className="resident-complaint-summary" aria-labelledby="complaint-summary-heading">
              <div className="resident-complaint-summary-heading">
                <div>
                  <h2 id="complaint-summary-heading">Your complaint summary</h2>
                  <p>Track every active request without leaving this board.</p>
                </div>
              </div>
              <div className="metric-grid resident-metric-grid">
                <Metric label="Total" value={stats.totalComplaints} icon={ClipboardList} note="Active requests" />
                <Metric label="Open" value={stats.byStatus.OPEN} icon={CircleDot} tone="open" note="Awaiting review" />
                <Metric label="In progress" value={stats.byStatus.IN_PROGRESS} icon={Clock3} tone="progress" note="Being worked on" />
                <Metric label="Resolved" value={stats.byStatus.RESOLVED} icon={CircleCheck} tone="success" note="Completed requests" />
              </div>
            </section>
          )}
        </Load>
      )}

      <div className="workspace-actions complaint-lifecycle-filter" role="group" aria-label="Complaint lifecycle">
        {[false, true].map(value => (
          <button key={String(value)} type="button" aria-pressed={archived === value}
            className={'btn btn-sm ' + (archived === value ? 'btn-primary' : 'btn-secondary')}
            onClick={() => setQuery('archived', value ? 'true' : '')}>
            {value ? 'Archived complaints' : 'Active complaints'}
          </button>
        ))}
      </div>
      {/* Horizontal Status Filter Tabs */}
      <div className="status-filter-tabs" role="tablist" aria-label="Filter issues by status">
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`status-tab-btn${isActive ? ' is-active' : ''}`}
              onClick={() => setStatusFilter(tab.value)}
            >
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  className="status-tab-indicator"
                  layoutId="statusTabIndicator"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Search & Secondary Filter Toolbar */}
      <div className="complaints-toolbar">
        <div className="toolbar-search-box">
          <Search size={15} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search keywords, title, or flat..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            aria-label="Search complaints"
          />
          {searchFilter && (
            <button
              type="button"
              className="toolbar-search-clear"
              onClick={() => setSearchFilter('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="toolbar-dropdowns">
          {isAdmin && <>
            <select className="toolbar-select" aria-label="Filter by complaint source" value={sourceFilter} onChange={event => setQuery('source', event.target.value)}><option value="">All complaints</option><option value="QR">QR complaints</option><option value="MANUAL">Manual complaints</option></select>
            <AssetFilter value={assetFilter} onChange={value => setQuery('assetId', value)} />
          </>}
          <div className="toolbar-select-wrap">
            <select
              className="toolbar-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-select-wrap">
            <select
              className="toolbar-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter by priority"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          {isAdmin && (
            <div className="toolbar-date-wrap">
              <input
                type="date"
                className="toolbar-date-input"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="Filter by creation date"
                title="Filter by creation date"
              />
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn btn-secondary btn-sm toolbar-clear-btn"
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Item Counter */}
      <div className="complaints-meta-bar">
        <span className="complaints-count-text">
          Showing <strong className="text-primary">{complaints.length}</strong> of{' '}
          <strong className="text-primary">{totalItems}</strong> Issue
          {totalItems !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Main Issue Backlog Output */}
      {loading ? (
        <div className="complaints-skeleton-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="complaints-skeleton-row">
              <div className="skeleton-left">
                <div className="skeleton" style={{ width: '45px', height: '18px', borderRadius: '4px' }} />
                <div className="skeleton-text-group">
                  <div className="skeleton" style={{ width: '220px', height: '16px' }} />
                  <div className="skeleton" style={{ width: '130px', height: '12px' }} />
                </div>
              </div>
              <div className="skeleton-right">
                <div className="skeleton" style={{ width: '60px', height: '20px', borderRadius: '9999px' }} />
                <div className="skeleton" style={{ width: '70px', height: '20px', borderRadius: '9999px' }} />
                <div className="skeleton" style={{ width: '80px', height: '14px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : complaints.length === 0 ? (
        <div className="card empty-state complaints-empty">
          <div className="empty-state-icon-box">
            <Inbox size={32} />
          </div>
          <h3>{hasActiveFilters ? 'No Matching Issues' : archived ? 'No Archived Complaints' : 'No Active Complaints'}</h3>
          <p className="empty-state-desc">
            {hasActiveFilters
              ? 'Try widening or clearing your filters to see more results.'
              : archived
              ? 'Complaints you archive will appear here.'
              : isAdmin
              ? 'All clear. There are currently no maintenance issues in the queue.'
              : 'You have no active maintenance requests.'}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="btn btn-secondary btn-sm"
            >
              <RotateCcw size={13} />
              <span>Clear Filter Selections</span>
            </button>
          ) : !isAdmin && !archived ? (
            <Link to="/complaints/new" className="btn btn-primary btn-sm">
              <PlusCircle size={14} />
              <span>Report an Issue</span>
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <div className="complaints-list-container">
            {complaints.map((complaint, index) => (
              <ComplaintCard key={complaint.id} complaint={complaint} index={index} showAsset={isAdmin} />
            ))}
          </div>

          {/* Server-Side Pagination Bar */}
          {totalPages > 1 && (
            <div className="pagination-bar">
              <button
                type="button"
                className="btn btn-secondary btn-sm pagination-btn"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={!hasPreviousPage}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <div className="pagination-indicator">
                Page <span className="pagination-current">{page}</span> of{' '}
                <span className="pagination-total">{totalPages}</span>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm pagination-btn"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={!hasNextPage}
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
