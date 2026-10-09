import Link from "next/link";
import { FiSearch } from "react-icons/fi";

export default function SilasHeader({ brand, onSearch }) {
  return (
    <header className="silas-header">
      <Link className="silas-wordmark" href="/" aria-label={`${brand} – Startseite`}>
        {brand}
      </Link>
      <button className="silas-search" type="button" onClick={onSearch}>
        <FiSearch aria-hidden="true" />
        <span>Dienste suchen</span>
        <kbd aria-hidden="true">Ctrl/⌘ K</kbd>
      </button>
    </header>
  );
}
