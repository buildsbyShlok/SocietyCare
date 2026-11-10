import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Calendar, AlertTriangle, User, Paperclip } from 'lucide-react';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { CATEGORY_LABELS } from '../utils/constants';
import { formatDate } from '../utils/helpers';
import './ComplaintCard.css';

/**
 * ComplaintCard — Modernized SaaS Issue Row with subtle animations & JetBrains Mono ID
 */
export default function ComplaintCard({ complaint, index = 0 }) {
  const shortId = complaint.id ? `#${complaint.id.slice(-6).toUpperCase()}` : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Link to={`/complaints/${complaint.id}`} className="complaint-list-row-item">
        <div className="complaint-row-info">
          <span className="complaint-row-mono-id" title={`Complaint ID: ${complaint.id}`}>
            {shortId}
          </span>
          <div className="complaint-row-text">
            <span className="complaint-row-title">{complaint.title}</span>
            <div className="complaint-row-subtitles">
              <span className="complaint-row-category">
                {CATEGORY_LABELS[complaint.category] || complaint.category}
              </span>
              {complaint.photoUrl && (
                <>
                  <span className="bullet-separator" aria-hidden="true">·</span>
                  <span className="complaint-attachment-indicator" title="Has attachment">
                    <Paperclip size={11} /> Photo
                  </span>
                </>
              )}
              {complaint.resident && (
                <>
                  <span className="bullet-separator" aria-hidden="true">·</span>
                  <span className="complaint-row-resident">
                    <User size={11} className="resident-icon" />
                    Flat {complaint.resident.flatNumber}
                    {complaint.resident.name ? ` · ${complaint.resident.name}` : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="complaint-row-controls">
          <div className="complaint-row-badges">
            {complaint.isOverdue && (
              <span className="badge badge-danger overdue-badge">
                <AlertTriangle size={11} /> Overdue
              </span>
            )}
            <PriorityBadge priority={complaint.priority} />
            <StatusBadge status={complaint.status} />
          </div>
          <div className="complaint-row-date">
            <Calendar size={12} className="date-icon" />
            <span>{formatDate(complaint.createdAt)}</span>
          </div>
          <ChevronRight size={16} className="complaint-row-chevron" />
        </div>
      </Link>
    </motion.div>
  );
}
