import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, AlertTriangle, Paperclip, Box } from 'lucide-react';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { CATEGORY_LABELS } from '../utils/constants';
import { formatDate } from '../utils/helpers';
import './ComplaintCard.css';
import ComplaintSource from './ComplaintSource';

/**
 * ComplaintCard — one ruled row in the complaint list; the asset line sits inside the same row.
 */
export default function ComplaintCard({ complaint, index = 0, showAsset = false }) {
  const shortId = complaint.id ? `#${complaint.id.slice(-6).toUpperCase()}` : '';

  return (
    <motion.div
      className="complaint-row"
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
              {showAsset && <ComplaintSource source={complaint.source} />}
              {showAsset && !complaint.resident && <span>Deleted resident</span>}
              <span className="complaint-row-category">
                {CATEGORY_LABELS[complaint.category] || complaint.category}
              </span>
              {complaint.photoUrl && (
                <>
                  <span className="bullet-separator" aria-hidden="true">·</span>
                  <span className="complaint-attachment-indicator" title="Has attachment">
                    <Paperclip size={12} aria-hidden="true" /> Photo
                  </span>
                </>
              )}
              {complaint.resident && (
                <>
                  <span className="bullet-separator" aria-hidden="true">·</span>
                  <span className="complaint-row-resident">
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
                <AlertTriangle size={12} aria-hidden="true" /> Overdue
              </span>
            )}
            <PriorityBadge priority={complaint.priority} />
            <StatusBadge status={complaint.status} />
          </div>
          <time className="complaint-row-date" dateTime={complaint.createdAt}>
            {formatDate(complaint.createdAt)}
          </time>
          <ChevronRight size={16} className="complaint-row-chevron" aria-hidden="true" />
        </div>
      </Link>
      {showAsset && (
        <div className={'complaint-asset-link' + (complaint.asset ? '' : ' is-empty')}>
          <Box size={13} aria-hidden="true" />
          {complaint.asset ? (
            <Link to={'/assets/' + complaint.asset.id}>
              {complaint.asset.name} <span className="mono">{complaint.asset.assetCode}</span>
            </Link>
          ) : (
            'Not linked to an asset'
          )}
        </div>
      )}
    </motion.div>
  );
}
