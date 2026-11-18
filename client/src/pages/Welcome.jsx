import { Link } from 'react-router-dom';
import Courtyard from '../components/Courtyard';
import { Brand } from '../components/Workspace';
export default function Welcome() {
  return (
    <main className="page ws-page">
      <Link className="brand-logo-wrapper ws-brand" to="/">
        <Brand />
        <strong>
          Society<span>Care</span>
        </strong>
      </Link>
      <section className="estate estate-scene">
        <div className="estate-copy">
          <span className="estate-index">RESIDENT SERVICES</span>
          <h1>SocietyCare</h1>
          <p>
            Sign in to see your society’s notices, service requests and community conversations.
          </p>
          <div className="ws-inline">
            <Link className="btn btn-primary" to="/login">
              Sign in
            </Link>
            <Link className="btn btn-secondary" to="/register">
              Register as a resident
            </Link>
          </div>
        </div>
        <Courtyard />
      </section>
    </main>
  );
}
