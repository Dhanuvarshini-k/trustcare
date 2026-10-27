import Link from "next/link";

export default function Custom404() {
  return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
      <h2>404 - Page Not Found</h2>
      <p>The requested page does not exist.</p>
      <Link href="/dashboard" style={{ color: "#2563eb", textDecoration: "underline" }}>
        Go to Dashboard
      </Link>
    </div>
  );
}
