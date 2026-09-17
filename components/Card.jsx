export default function Card({ children, className = "" }) {
  return <div className={`bg-[#163A67] rounded-xl border border-[#21426E] shadow-sm ${className}`}>{children}</div>;
}
