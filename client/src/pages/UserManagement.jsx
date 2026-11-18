import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, X, ShieldCheck, User, Home, Phone, Mail, AlertCircle, CheckCircle2, Users, UserMinus, Trash2, Eye, Pencil } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { users as usersApi } from "../api/index";
import { performResidentAction } from "./resident-actions";
import "./UserManagement.css";

export default function UserManagement() {
  const { user: currentUser, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [search,setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error,setError] = useState("");
  const [successMessage,setSuccessMessage] = useState("");
  const [actioningId,setActioningId] = useState(null);
  const requestVersion=useRef(0), busy=useRef(false);
  useEffect(()=>{
    let active=true;
    const version=++requestVersion.current;
    setLoading(true); setError("");
    usersApi.list({search},token).then(response=>{
      if(active && version===requestVersion.current) setUsers(response.data || []);
    }).catch(err=>{if(active && version===requestVersion.current)setError(err.message);})
      .finally(()=>{if(active && version===requestVersion.current)setLoading(false);});
    return ()=>{active=false;};
  },[search,token]);
  async function manage(account,role) {
    if(busy.current || loading)return;
    busy.current=true;
    setActioningId(account.id); setError(""); setSuccessMessage("");
    ++requestVersion.current;
    try {
      const result=await performResidentAction({account,currentUser,role,token,api:usersApi,confirm:message=>window.confirm(message)});
      if(!result)return;
      setUsers(previous=>role ? previous.map(u=>u.id===account.id?{...u,role}:u) : previous.filter(u=>u.id!==account.id));
      setSuccessMessage(result.message);
    } catch(err) { setError(err.message || "Could not complete the account action."); }
    finally { busy.current=false; setActioningId(null); setLoading(false); }
  }
  async function approve(account) {
    if (busy.current || !window.confirm('Approve this request only after independently confirming that this resident made the request and lives in the stated unit.')) return;
    busy.current = true;
    setActioningId(account.id); setError(''); setSuccessMessage('');
    try {
      await usersApi.approveEnrollment(account.id, token);
      setUsers(previous => previous.map(u => u.id === account.id ? { ...u, disabled: false, enrollmentPending: false } : u));
      setSuccessMessage('Resident enrollment approved.');
    } catch (err) { setError(err.message); }
    finally { busy.current = false; setActioningId(null); }
  }
  const admin=currentUser?.role==="ADMIN";
  return <div className="page user-management-page">
    <header className="page-header"><div className="page-header-title">
      <h1>Resident Directory</h1><p className="page-header-subtitle">Member records and account access</p>
    </div></header>
    <nav className="settings-tabs" aria-label="Account settings">
      <Link to="/settings" className="settings-tab"><User size={14}/>My Profile</Link>
      <Link to="/settings/users" className="settings-tab active" aria-current="page"><Users size={14}/>Resident Directory</Link>
    </nav>
    {successMessage && <div className="alert alert-success" role="status"><CheckCircle2 size={16}/><span>{successMessage}</span></div>}
    {error && <div className="alert alert-error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}
    <div className="card user-management-card">
      <div className="user-management-toolbar">
        <div className="search-bar-wrapper">
          <Search size={16} className="search-icon"/>
          <input className="form-input search-input" value={search} onChange={e=>setSearch(e.target.value)} disabled={Boolean(actioningId)}
            placeholder="Search name, email or flat…" aria-label="Search residents"/>
          {search && <button type="button" className="search-clear-btn" disabled={Boolean(actioningId)} onClick={()=>setSearch("")} aria-label="Clear search"><X size={16}/></button>}
        </div>
        <span className="user-count-badge" role="status">{loading?"Loading members…":users.length+" members listed"}</span>
      </div>
      {loading && !users.length ? <p role="status">Loading resident directory…</p> : !users.length ? <div className="empty-state directory-empty">
        <Users size={28}/><h3>No members found</h3><p>{search ? "Try another name, email or flat number." : "No accounts available."}</p>
        {search && <button type="button" className="btn btn-secondary" onClick={()=>setSearch("")}>Clear search</button>}
      </div> : <div className="directory-table-wrap">
        <table className="user-table"><thead><tr><th>Resident</th><th>Unit</th><th>Phone</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>{users.map(u=>{
            const self=u.id===currentUser.id;
            return <tr key={u.id} className={self?"user-row-self":""}>
              <td className="directory-identity"><div className="user-info-cell">
                <div className="user-avatar-cell">{u.avatarUrl?<img src={u.avatarUrl} alt="" className="user-avatar-img"/>:(u.name||"?").slice(0,1).toUpperCase()}</div>
                <div className="user-name-email"><span className="user-cell-name"><Link to={"/admin/residents/"+u.id}>{u.name}</Link>{self&&<span className="self-tag">You</span>}</span>
                  <span className="user-cell-email"><Mail size={11}/>{u.email}</span>
                </div>
              </div></td>
              <td data-label="Unit"><span className="user-cell-flat-badge"><Home size={12}/>{[u.tower,u.flatNumber].filter(Boolean).join(" / ")||"Not recorded"}</span></td>
              <td data-label="Phone"><span className="user-cell-phone"><Phone size={12}/>{u.phone||"Not provided"}</span></td>
              <td data-label="Role">{u.disabled?<span className="text-muted">{u.enrollmentPending ? 'Pending approval' : 'Deactivated'}</span>:<span className={"role-badge role-badge--"+(u.role==="ADMIN"?"admin":"resident")}>{u.role==="ADMIN"?<ShieldCheck size={12}/>:<User size={12}/>} {u.role}</span>}</td>
              <td className="directory-actions-cell"><div className="directory-actions" role="group" aria-label={"Actions for "+u.name}>
                <Link className="btn btn-secondary btn-sm" to={"/admin/residents/"+u.id}><Eye size={14}/>View</Link>
                {admin && u.enrollmentPending && <button type="button" className="btn btn-secondary btn-sm" disabled={loading || Boolean(actioningId)} onClick={()=>approve(u)}>Approve enrollment</button>}
                {self && <Link className="btn btn-secondary btn-sm" to="/settings"><Pencil size={14}/>Edit profile</Link>}
                {admin && !self && !u.disabled && <button type="button" className="btn btn-secondary btn-sm" disabled={loading || Boolean(actioningId)} onClick={()=>manage(u,u.role==="ADMIN"?"RESIDENT":"ADMIN")}>
                  {u.role==="ADMIN"?<UserMinus size={14}/>:<ShieldCheck size={14}/>}
                  {u.role==="ADMIN"?"Demote":"Promote"}
                </button>}
                {admin && !self && <button type="button" className="btn btn-sm delete-user-btn" disabled={loading || Boolean(actioningId)} onClick={()=>manage(u)}>
                  <Trash2 size={14}/>Delete user
                </button>}
                {actioningId===u.id && <span className="directory-saving" role="status">Saving…</span>}
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </div>
  </div>;
}
