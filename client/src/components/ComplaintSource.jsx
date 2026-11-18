import { QrCode, FileText } from 'lucide-react';
import './AssetComplaints.css';
export default function ComplaintSource({ source }) {
  const qr = source === 'QR', Icon = qr ? QrCode : FileText;
  return <span className={'complaint-source' + (qr ? ' is-qr' : '')}><Icon size={13} aria-hidden="true" />{qr ? 'QR' : 'Manual'}</span>;
}
