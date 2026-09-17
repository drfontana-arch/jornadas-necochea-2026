export default function Card({ children, className = "" }) {
  return <div className={`bg-[#16233F] rounded-xl border border-[#24334F] shadow-sm ${className}`}>{children}</div>;
}
